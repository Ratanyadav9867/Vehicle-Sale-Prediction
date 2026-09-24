"""
backend/main.py
===============
FastAPI application for Vehicle Sales Prediction.

Endpoints:
  GET  /api/health        — health + model readiness
  GET  /api/model-info    — model metadata and performance metrics
  GET  /api/options       — valid input categories
  POST /api/predict       — predict selling price
  Auth, Users, and Activity Logs routers mounted at /api/auth, /api/admin, /api/me
"""

# Load .env first — must happen before any os.getenv() call in any module
from backend.utils.dotenv_loader import load_dotenv as _load_dotenv
_load_dotenv()

import asyncio
import logging
import secrets
import threading
import time
from contextlib import asynccontextmanager
from typing import Any, Dict, List, Optional

from fastapi import BackgroundTasks, Depends, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, PlainTextResponse

from backend.db.database import (
    close_db_pools,
    get_all_predictions,
    get_connection,
    get_user_predictions,
    init_db,
    log_activity,
    save_prediction,
)
from backend.model.loader import model_store
from backend.routers import auth, logs, support, users
from backend.schemas.auth import PredictionListResponse, PredictionRecordResponse
from backend.schemas.prediction import (
    HealthResponse,
    ModelInfoResponse,
    OptionsResponse,
    PredictRequest,
    PredictResponse,
)
from backend.services.predictor import predict
from backend.utils.auth_deps import (
    _TRUSTED_PROXIES,
    get_client_ip,
    get_current_user_optional,
    get_user_agent,
    is_trusted_proxy,
    require_admin_user,
    require_authenticated_user,
)
from backend.utils.cache import (
    get_cache_stats,
    get_cached_prediction,
    normalize_and_hash,
    set_cached_prediction,
)
from backend.utils.helpers import current_year
from backend.utils.rate_limiter import check_rate_limit, enforce_rate_limit

# ── Logging ───────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(name)s — %(message)s",
)
logger = logging.getLogger(__name__)

# ── Metrics Counters ──────────────────────────────────────────────────────────
REQUEST_COUNT = 0
ERROR_COUNT = 0
TOTAL_DURATION = 0.0
ACTIVE_REQUESTS = 0
METRICS_LOCK = threading.Lock()


# ── Lifespan: load model & init SQLite DB once at startup ────────────────────
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("=== Vehicle Sales Prediction API starting up ===")
    from backend.utils.security_config import validate_production_secrets
    validate_production_secrets()
    init_db()
    model_store.load()
    if model_store.is_ready:
        logger.info("Model ready: %s", model_store.metadata.get("model_name"))
    else:
        logger.error("Model failed to load: %s", model_store.load_error)
    yield
    logger.info("=== API shutting down ===")
    close_db_pools()


# ── App Configuration ─────────────────────────────────────────────────────────
import os as _os
_ENV = _os.getenv("ENVIRONMENT", "development").strip().lower()
_IS_PROD = _ENV == "production"

# ── App ───────────────────────────────────────────────────────────────────────
app = FastAPI(
    title="Vehicle Sales Prediction API",
    description=(
        "Predict the selling price of a used car using a trained "
        "GradientBoostingRegressor pipeline (CarDekho dataset). Includes "
        "role-based authentication, append-only activity audit logging, "
        "Redis prediction caching, and horizontal concurrency scalability."
    ),
    version="2.1.0",
    lifespan=lifespan,
    docs_url=None if _IS_PROD else "/docs",
    redoc_url=None if _IS_PROD else "/redoc",
    openapi_url=None if _IS_PROD else "/openapi.json",
)

# ── Observability & Performance Metrics Middleware ────────────────────────────
@app.middleware("http")
async def metrics_middleware(request: Request, call_next):
    global REQUEST_COUNT, ERROR_COUNT, TOTAL_DURATION, ACTIVE_REQUESTS
    start_time = time.time()
    with METRICS_LOCK:
        ACTIVE_REQUESTS += 1

    try:
        response = await call_next(request)
        duration = time.time() - start_time
        response.headers["X-Response-Time"] = f"{duration * 1000:.2f}ms"
        with METRICS_LOCK:
            REQUEST_COUNT += 1
            TOTAL_DURATION += duration
            if response.status_code >= 500:
                ERROR_COUNT += 1
        return response
    except Exception:
        duration = time.time() - start_time
        with METRICS_LOCK:
            REQUEST_COUNT += 1
            ERROR_COUNT += 1
            TOTAL_DURATION += duration
        raise
    finally:
        with METRICS_LOCK:
            ACTIVE_REQUESTS = max(0, ACTIVE_REQUESTS - 1)

# ── Request Body Size Limit Middleware ───────────────────────────────────────
# SECURITY FIX: Reject oversized request entities early to prevent memory exhaustion DoS
MAX_BODY_BYTES = 10 * 1024 * 1024  # 10 MB maximum request body size

@app.middleware("http")
async def limit_body_size_middleware(request: Request, call_next):
    content_length = request.headers.get("content-length")
    if content_length:
        try:
            if int(content_length) > MAX_BODY_BYTES:
                return JSONResponse(
                    status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
                    content={"detail": "Request entity too large. Maximum allowed size is 10 MB."},
                )
        except ValueError:
            pass
    return await call_next(request)


# ── Double-Submit Cookie CSRF Middleware ─────────────────────────────────────
# SECURITY FIX: For state-changing requests using cookie authentication, enforce
# that the X-CSRF-Token header matches the csrf_token cookie.
CSRF_EXEMPT_PATHS = {
    "/api/auth/login",
    "/api/auth/admin-login",
    "/api/auth/register",
    "/api/auth/csrf",
    "/api/support/tickets",
    "/api/logs/batch",
    "/api/logs/event",
    "/healthz",
    "/readyz",
    "/metrics",
}

@app.middleware("http")
async def csrf_protect_middleware(request: Request, call_next):
    if request.method in ("POST", "PUT", "PATCH", "DELETE"):
        path = request.url.path
        if path not in CSRF_EXEMPT_PATHS:
            cookie_token = request.cookies.get("__Host-auth_token") or request.cookies.get("auth_token")
            auth_header = request.headers.get("authorization", "")

            # If request is authenticated via browser session cookie (not explicit Bearer header):
            if cookie_token and not (auth_header and auth_header.startswith("Bearer ")):
                from backend.db.database import get_user_from_token
                user = get_user_from_token(cookie_token)
                if user:
                    expected_csrf = request.cookies.get("csrf_token")
                    received_csrf = request.headers.get("x-csrf-token") or request.headers.get("x-xsrf-token")

                    if not expected_csrf or not received_csrf or not secrets.compare_digest(expected_csrf, received_csrf):
                        return JSONResponse(
                            status_code=status.HTTP_403_FORBIDDEN,
                            content={"detail": "CSRF validation failed. Missing or invalid CSRF token header."},
                        )

    return await call_next(request)


# ── CORS ──────────────────────────────────────────────────────────────────────
# SECURITY FIX: Wildcard "*" with allow_credentials=True is rejected by browsers
# and opens CORS-credential abuse. Read allowed origins from ALLOWED_ORIGINS env
# var so staging/prod can set their own domains without touching source code.
# Fallback list covers only localhost dev origins — never includes "*".
import os as _os
_raw_origins = _os.getenv("ALLOWED_ORIGINS", "")
_ALLOWED_ORIGINS: list = (
    [o.strip().rstrip("/") for o in _raw_origins.split(",") if o.strip()]
    if _raw_origins.strip()
    else [
        "http://localhost:5173",   # Vite dev server
        "http://localhost:3000",   # CRA / other React servers
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
    ]
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "Accept", "X-Requested-With", "X-CSRF-Token", "X-XSRF-Token"],
    expose_headers=["X-CSRF-Token", "x-csrf-token"],
)

# ── Security Headers Middleware ───────────────────────────────────────────────
# SECURITY FIX: Inject standard defense-in-depth HTTP security headers on every
# response. CSP restricts script/style/connect sources so XSS has nowhere to load from.
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    # Prevent MIME-type sniffing attacks
    response.headers["X-Content-Type-Options"] = "nosniff"
    # Disallow embedding in iframes (clickjacking)
    response.headers["X-Frame-Options"] = "DENY"
    # Only send origin on cross-origin requests (no full URL in Referer)
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    # Disable camera/mic/geo access from this API origin
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=(), payment=()"
    # Cross-Origin Isolation & Embedding Protections
    response.headers["Cross-Origin-Opener-Policy"] = "same-origin"
    response.headers["Cross-Origin-Resource-Policy"] = "cross-origin"
    # Content-Security-Policy: API only serves JSON; no scripts/styles needed
    response.headers["Content-Security-Policy"] = (
        "default-src 'none'; "
        "frame-ancestors 'none'"
    )

    # Enforce HSTS if running over HTTPS or behind trusted reverse proxy terminating TLS (2 years as per OWASP ASVS)
    direct_peer = request.client.host if request.client else None
    trust_forwarded = is_trusted_proxy(direct_peer)
    is_https = (
        request.url.scheme == "https"
        or (trust_forwarded and request.headers.get("x-forwarded-proto") == "https")
        or _IS_PROD
    )
    if is_https:
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains; preload"

    return response


# ── Include Subrouters ────────────────────────────────────────────────────────
app.include_router(auth.router)
app.include_router(logs.router)
app.include_router(users.router)
app.include_router(support.router)


# ── Exception handlers ────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    log_activity(
        action_type="system_error",
        category="error",
        description=f"Unhandled internal server error on {request.url.path}: {str(exc)}",
        status="failed",
        ip_address=ip,
        user_agent=ua,
        metadata={"path": str(request.url.path), "error": str(exc)}
    )
    return JSONResponse(
        status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
        content={"detail": "An unexpected error occurred. Please try again."},
    )


# ── GET /api/health ───────────────────────────────────────────────────────────
@app.get(
    "/api/health",
    response_model=HealthResponse,
    summary="Backend and model health check",
    tags=["System"],
)
def health() -> HealthResponse:
    """Returns backend status and whether the ML model is loaded and ready."""
    if model_store.is_ready:
        return HealthResponse(
            status="ok",
            model_loaded=True,
            model_name=model_store.metadata.get("model_name"),
        )
    return HealthResponse(
        status="degraded",
        model_loaded=False,
        detail="Model service unavailable." if _IS_PROD else (model_store.load_error or "Model not yet loaded."),
    )


# ── GET /api/model-info ───────────────────────────────────────────────────────
@app.get(
    "/api/model-info",
    response_model=ModelInfoResponse,
    summary="ML model information and performance metrics",
    tags=["Model"],
)
def model_info() -> ModelInfoResponse:
    """Returns model name, feature columns, and real evaluation metrics."""
    if not model_store.is_ready:
        logger.error("Model info requested but model not ready: %s", model_store.load_error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not loaded. Service temporarily unavailable.",
        )
    m = model_store.metadata
    return ModelInfoResponse(
        model_name=m["model_name"],
        target=m["target"],
        feature_columns=m["feature_columns"],
        numerical_features=m["numerical_features"],
        categorical_features=m["categorical_features"],
        training_rows=m["training_rows"],
        testing_rows=m["testing_rows"],
        mae=m["mae"],
        rmse=m["rmse"],
        r2=m["r2"],
        training_date=m["training_date"],
        current_year_used=m["current_year_used"],
    )


# ── GET /api/options ──────────────────────────────────────────────────────────
@app.get(
    "/api/options",
    response_model=OptionsResponse,
    summary="Valid input categories for the prediction form",
    tags=["Model"],
)
def options() -> OptionsResponse:
    """Returns valid categorical values, owner range, and year range."""
    if not model_store.is_ready:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not loaded.",
        )
    cats = model_store.metadata.get("available_categories", {})
    return OptionsResponse(
        fuel_types=cats.get("Fuel_Type", ["Petrol", "Diesel", "Cng"]),
        seller_types=cats.get("Seller_Type", ["Dealer", "Individual"]),
        transmission_types=cats.get("Transmission", ["Manual", "Automatic"]),
        owner_options=cats.get("Owner", [0, 1, 2, 3]),
        year_min=1990,
        year_max=current_year(),
        note=(
            "Car_Name is anonymised in this dataset. Brand field is "
            "accepted for UI display but does not affect the prediction."
        ),
    )


# ── Liveness and Readiness Probes ─────────────────────────────────────────────
@app.get("/healthz", summary="Liveness probe", tags=["System"])
def healthz():
    """Kubernetes / Docker load-balancer liveness probe."""
    return {"status": "ok", "timestamp": time.time()}


@app.get("/readyz", summary="Readiness probe", tags=["System"])
def readyz():
    """Readiness probe checking ML model and database availability."""
    if not model_store.is_ready:
        logger.error("Readiness check failed - model not ready: %s", model_store.load_error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="ML model pipeline is not ready.",
        )
    try:
        with get_connection() as conn:
            conn.execute("SELECT 1;").fetchone()
    except Exception as e:
        logger.exception("Readiness check failed - database probe failed: %s", e)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database probe failed. Service temporarily unavailable.",
        )
    return {"status": "ready", "database": "connected", "model": "loaded"}


# ── Prometheus Metrics Exposition ─────────────────────────────────────────────
_INTERNAL_METRICS_HOSTS = _TRUSTED_PROXIES | {"127.0.0.1", "::1", "localhost", "testclient"}

@app.get("/metrics", summary="Prometheus metrics", tags=["System"], response_class=PlainTextResponse)
def prometheus_metrics(request: Request):
    """
    Prometheus exposition metrics for scrape jobs.
    Protected: Accessible only by internal monitoring hosts / trusted proxies or authenticated admins.
    """
    direct_peer = request.client.host if request.client else None
    user = get_current_user_optional(request)
    is_admin = bool(user and user.get("role") == "admin")
    is_internal = is_trusted_proxy(direct_peer)

    if not (is_internal or is_admin):
        logger.warning("Unauthorized attempt to access /metrics from peer %s", direct_peer)
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied. /metrics is restricted to internal monitoring systems and administrators.",
        )

    cache_stats = get_cache_stats()
    avg_latency = (TOTAL_DURATION / REQUEST_COUNT) if REQUEST_COUNT > 0 else 0.0
    lines = [
        "# HELP car_worth_http_requests_total Total number of HTTP requests processed",
        "# TYPE car_worth_http_requests_total counter",
        f"car_worth_http_requests_total {REQUEST_COUNT}",
        "# HELP car_worth_http_errors_total Total number of HTTP 5xx server errors",
        "# TYPE car_worth_http_errors_total counter",
        f"car_worth_http_errors_total {ERROR_COUNT}",
        "# HELP car_worth_http_request_duration_seconds_total Total duration of all requests in seconds",
        "# TYPE car_worth_http_request_duration_seconds_total counter",
        f"car_worth_http_request_duration_seconds_total {TOTAL_DURATION:.4f}",
        "# HELP car_worth_http_avg_latency_seconds Average request latency in seconds",
        "# TYPE car_worth_http_avg_latency_seconds gauge",
        f"car_worth_http_avg_latency_seconds {avg_latency:.4f}",
        "# HELP car_worth_http_active_requests Currently in-flight HTTP requests",
        "# TYPE car_worth_http_active_requests gauge",
        f"car_worth_http_active_requests {ACTIVE_REQUESTS}",
        "# HELP car_worth_cache_hits_total Prediction cache hits",
        "# TYPE car_worth_cache_hits_total counter",
        f"car_worth_cache_hits_total {cache_stats.get('hits', 0)}",
        "# HELP car_worth_cache_misses_total Prediction cache misses",
        "# TYPE car_worth_cache_misses_total counter",
        f"car_worth_cache_misses_total {cache_stats.get('misses', 0)}",
    ]
    return PlainTextResponse("\n".join(lines) + "\n")


# ── POST /api/predict (Authenticated Only, Cached, Async Non-blocking) ────────
@app.post(
    "/api/predict",
    response_model=PredictResponse,
    summary="Predict used-car selling price (Authenticated)",
    tags=["Prediction"],
)
async def predict_price(
    request: PredictRequest,
    raw_request: Request,
    background_tasks: BackgroundTasks,
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
) -> PredictResponse:
    """
    High-concurrency prediction endpoint:
    1. Distributed sliding-window rate limit per user and per IP.
    2. Redis / memory cache check (normalized SHA-256 hash). Returns in <2ms on hit.
    3. Offloads ML inference to thread pool so FastAPI event loop remains unblocked.
    4. Caches successful inference result for 24 hours.
    5. Saves prediction record and audit log asynchronously via background tasks.
    """
    if not model_store.is_ready:
        logger.error("Predict requested but model not ready: %s", model_store.load_error)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Model not loaded. Service temporarily unavailable.",
        )

    ip = get_client_ip(raw_request) if raw_request else "127.0.0.1"
    ua = get_user_agent(raw_request) if raw_request else "Unknown"
    user_id = current_user["id"]

    # Enforce sliding-window rate limit (60 predictions per minute per user)
    allowed, retry_after = check_rate_limit(f"pred_user:{user_id}", max_requests=60, window_seconds=60)
    if not allowed:
        background_tasks.add_task(
            log_activity,
            user_id=user_id,
            user_name=current_user["name"],
            email=current_user["email"],
            role=current_user["role"],
            action_type="rate_limit_exceeded",
            category="system",
            description=f"Rate limit exceeded on /api/predict (> 60/min)",
            status="failed",
            ip_address=ip,
            user_agent=ua,
            metadata={"limit": 60, "retry_after": retry_after},
        )
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Maximum 60 predictions per minute permitted. Please retry in {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )

    # 1. Deterministic cache key generation
    cache_features = {
        "present_price": request.present_price,
        "year": request.year,
        "kms_driven": request.kms_driven,
        "fuel_type": request.fuel_type,
        "seller_type": request.seller_type,
        "transmission": request.transmission,
        "owner": request.owner,
    }
    cache_key = normalize_and_hash(cache_features)

    # 2. Check cache (Redis or Thread-Safe In-Memory LRU)
    cached_data = get_cached_prediction(cache_key)
    if cached_data:
        res = PredictResponse(**cached_data)
        # Asynchronously record to history & audit log without slowing down client response
        background_tasks.add_task(
            save_prediction,
            user_id=current_user["id"],
            user_name=current_user["name"],
            email=current_user["email"],
            brand=request.brand,
            year=request.year,
            present_price=request.present_price,
            kms_driven=request.kms_driven,
            fuel_type=request.fuel_type,
            seller_type=request.seller_type,
            transmission=request.transmission,
            owner=request.owner,
            predicted_price=res.predicted_price,
            car_age=res.car_age,
            currency="Lakh INR",
        )
        background_tasks.add_task(
            log_activity,
            user_id=current_user["id"],
            user_name=current_user["name"],
            email=current_user["email"],
            role=current_user["role"],
            action_type="valuation_predicted",
            category="user",
            description=f"Valuation (Cache Hit): {request.brand} ({request.year}) -> ₹{res.predicted_price} Lakh",
            status="success",
            ip_address=ip,
            user_agent=ua,
            metadata={
                "cache_hit": True,
                "brand": request.brand,
                "year": request.year,
                "predicted_price": res.predicted_price,
            },
        )
        return res

    # 3. Cache miss: Run CPU inference in worker threadpool
    try:
        res = await asyncio.to_thread(predict, request)

        # Cache result
        set_cached_prediction(cache_key, res.model_dump())

        # Asynchronously persist prediction in database and record audit log
        background_tasks.add_task(
            save_prediction,
            user_id=current_user["id"],
            user_name=current_user["name"],
            email=current_user["email"],
            brand=request.brand,
            year=request.year,
            present_price=request.present_price,
            kms_driven=request.kms_driven,
            fuel_type=request.fuel_type,
            seller_type=request.seller_type,
            transmission=request.transmission,
            owner=request.owner,
            predicted_price=res.predicted_price,
            car_age=res.car_age,
            currency="Lakh INR",
        )
        background_tasks.add_task(
            log_activity,
            user_id=current_user["id"],
            user_name=current_user["name"],
            email=current_user["email"],
            role=current_user["role"],
            action_type="valuation_predicted",
            category="user",
            description=f"Valuation: {request.brand} ({request.year}) -> ₹{res.predicted_price} Lakh",
            status="success",
            ip_address=ip,
            user_agent=ua,
            metadata={
                "cache_hit": False,
                "brand": request.brand,
                "year": request.year,
                "present_price": request.present_price,
                "predicted_price": res.predicted_price,
                "car_age": res.car_age,
            },
        )
        return res
    except RuntimeError as exc:
        logger.exception("Prediction runtime error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Prediction service temporarily unavailable.",
        ) from exc
    except Exception as exc:
        logger.exception("Prediction error: %s", exc)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Prediction failed. Please try again.",
        ) from exc


# ── GET /api/me/predictions (User's Own Prediction History) ───────────────────
@app.get(
    "/api/me/predictions",
    response_model=PredictionListResponse,
    summary="Get authenticated user's prediction history",
    tags=["Prediction"],
)
def get_my_predictions(
    current_user: Dict[str, Any] = Depends(require_authenticated_user),
    limit: int = Query(default=50, ge=1, le=200),
):
    """
    Retrieve historical vehicle valuations made by the currently authenticated user account.
    """
    items = get_user_predictions(user_id=current_user["id"], limit=limit)
    return PredictionListResponse(items=items, total=len(items), limit=limit, offset=0)


# ── GET /api/admin/predictions (Admin Only: All Predictions) ──────────────────
@app.get(
    "/api/admin/predictions",
    response_model=PredictionListResponse,
    summary="Get all predictions across all users (Admin only)",
    tags=["Prediction"],
)
def get_admin_predictions(
    admin: Dict[str, Any] = Depends(require_admin_user),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
):
    """
    Administrator endpoint to audit and inspect all vehicle valuations across all users.
    """
    items, total = get_all_predictions(limit=limit, offset=offset)
    return PredictionListResponse(items=items, total=total, limit=limit, offset=offset)


# ── Root redirect to docs ─────────────────────────────────────────────────────
@app.get("/", include_in_schema=False)
def root():
    return {"message": "Vehicle Sales Prediction API", "docs": "/docs"}


if __name__ == "__main__":
    import uvicorn
    port = int(_os.getenv("PORT", "8000"))
    uvicorn.run("backend.main:app", host="0.0.0.0", port=port, reload=False)

