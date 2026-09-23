import collections
import math
import os
import threading
import time
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.responses import JSONResponse
import re

from backend.db.database import (
    create_session,
    create_user,
    get_user_auth_by_id,
    get_user_by_email,
    log_activity,
    revoke_all_user_sessions,
    revoke_session,
    update_user_password,
    update_user_profile,
    verify_dummy_password,
    verify_password,
)
from backend.schemas.auth import (
    AdminLoginRequest,
    AuthResponse,
    ChangePasswordRequest,
    COMMON_PASSWORDS,
    LoginRequest,
    RegisterRequest,
    UpdateProfileRequest,
    UserResponse,
)
from backend.utils.auth_deps import (
    get_client_ip,
    get_user_agent,
    require_authenticated_user,
)
from backend.utils.rate_limiter import enforce_rate_limit

router = APIRouter(prefix="/api/auth", tags=["Authentication"])

# SECURITY FIX: cookie settings
# When ENVIRONMENT=production, strictly enforce COOKIE_SECURE=True to prevent
# transmission over unencrypted connections regardless of env var oversight.
_ENV = os.getenv("ENVIRONMENT", "development").strip().lower()
if _ENV == "production":
    _COOKIE_SECURE: bool = True
    if os.getenv("COOKIE_SECURE", "").strip().lower() == "false":
        import logging as _auth_logging
        _auth_logging.getLogger(__name__).warning(
            "COOKIE_SECURE was set to false, but ENVIRONMENT=production enforces secure=True."
        )
else:
    _COOKIE_SECURE: bool = os.getenv("COOKIE_SECURE", "false").strip().lower() == "true"

_COOKIE_MAX_AGE_DEFAULT = 7 * 24 * 3600   # 7 days in seconds
_COOKIE_MAX_AGE_REMEMBER = 30 * 24 * 3600  # 30 days


import secrets


def _set_auth_cookie(response: Response, token: str, max_age: int = _COOKIE_MAX_AGE_DEFAULT) -> None:
    """Attach the httpOnly session cookie and readable CSRF token cookie to a response."""
    response.set_cookie(
        key="auth_token",
        value=token,
        httponly=True,            # Not accessible to JavaScript — XSS-safe
        samesite="lax",           # Allows normal navigation; blocks foreign CSRF
        secure=_COOKIE_SECURE,    # Strictly True in production (HTTPS), False in dev (HTTP)
        max_age=max_age,
        path="/",
    )
    csrf_token = secrets.token_urlsafe(24)
    response.set_cookie(
        key="csrf_token",
        value=csrf_token,
        httponly=False,           # Readable by frontend Axios for Double-Submit CSRF protection
        samesite="lax",
        secure=_COOKIE_SECURE,
        max_age=max_age,
        path="/",
    )


def _clear_auth_cookie(response: Response) -> None:
    """Clear the session and CSRF cookies (expire immediately)."""
    response.delete_cookie(key="auth_token", path="/", samesite="lax", secure=_COOKIE_SECURE)
    response.delete_cookie(key="csrf_token", path="/", samesite="lax", secure=_COOKIE_SECURE)

# ── Configuration: Specific Auth Errors vs Generic Message ─────────────────────
# When True: distinct INVALID_EMAIL vs INVALID_PASSWORD errors.
# When False: unified generic "Invalid email or password" message (prevents account enumeration).
SPECIFIC_AUTH_ERRORS = os.getenv("SPECIFIC_AUTH_ERRORS", "true").strip().lower() == "true"

# ── Brute-Force Lockout Protection: 5 failed attempts within 15 minutes ─────────
_failed_auth_attempts: Dict[str, List[float]] = collections.defaultdict(list)
_auth_lock = threading.Lock()
MAX_FAILED_ATTEMPTS = 5
LOCKOUT_WINDOW_SECONDS = 15 * 60  # 15 minutes


def mask_email(email: str) -> str:
    """Mask email address for privacy in audit logs, e.g. j***e@domain.com."""
    if not email or "@" not in email:
        return "anonymous"
    user_part, domain = email.split("@", 1)
    if len(user_part) <= 2:
        masked_user = user_part[0] + "*"
    else:
        masked_user = user_part[0] + "*" * (len(user_part) - 2) + user_part[-1]
    return f"{masked_user}@{domain}"


def check_auth_lockout(ip: str, email: str) -> Tuple[bool, int]:
    """Check if IP or email is temporarily locked out due to excessive failed attempts."""
    now = time.time()
    cutoff = now - LOCKOUT_WINDOW_SECONDS
    keys = [f"fail_ip:{ip}", f"fail_email:{email.strip().lower()}"]
    with _auth_lock:
        for k in keys:
            _failed_auth_attempts[k] = [t for t in _failed_auth_attempts[k] if t > cutoff]
            if len(_failed_auth_attempts[k]) >= MAX_FAILED_ATTEMPTS:
                oldest = _failed_auth_attempts[k][0]
                remaining_secs = max(1, int(oldest + LOCKOUT_WINDOW_SECONDS - now))
                remaining_mins = max(1, math.ceil(remaining_secs / 60))
                return True, remaining_mins
    return False, 0


def record_failed_auth(ip: str, email: str) -> None:
    """Record timestamp of a failed login or registration attempt."""
    now = time.time()
    keys = [f"fail_ip:{ip}", f"fail_email:{email.strip().lower()}"]
    with _auth_lock:
        for k in keys:
            _failed_auth_attempts[k].append(now)


def clear_failed_auth(ip: str, email: str) -> None:
    """Clear failed attempts upon successful authentication."""
    keys = [f"fail_ip:{ip}", f"fail_email:{email.strip().lower()}"]
    with _auth_lock:
        for k in keys:
            _failed_auth_attempts.pop(k, None)


# ── Registration Endpoint ───────────────────────────────────────────────────────

@router.post("/register", response_model=AuthResponse, status_code=status.HTTP_201_CREATED)
def register_user(req: RegisterRequest, request: Request, response: Response):
    """
    Register a new user account. Role defaults to 'user'.
    Issues session token via httpOnly cookie and in JSON body (backward-compat).
    """
    enforce_rate_limit(request, "auth_reg", max_requests=15, window_seconds=60)
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    norm_email = req.email.strip().lower()

    # Check brute force lockout
    is_locked, rem_mins = check_auth_lockout(ip, norm_email)
    if is_locked:
        msg = f"Too many attempts. Try again in {rem_mins} minutes."
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"code": "TOO_MANY_ATTEMPTS", "message": msg, "detail": msg},
            headers={"Retry-After": str(rem_mins * 60)},
        )

    # Pre-check if email already exists
    existing = get_user_by_email(norm_email)
    if existing:
        record_failed_auth(ip, norm_email)
        log_activity(
            action_type="register_failure",
            category="auth",
            description=f"Registration rejected: email {mask_email(norm_email)} already exists",
            status="failed",
            email=mask_email(norm_email),
            ip_address=ip,
            user_agent=ua,
            metadata={"reason": "EMAIL_EXISTS"},
        )
        msg = "This email is already registered"
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"code": "EMAIL_EXISTS", "message": msg, "detail": msg},
        )

    try:
        user = create_user(
            name=req.name,
            email=norm_email,
            password=req.password,
            role="user",
        )
    except ValueError as e:
        record_failed_auth(ip, norm_email)
        log_activity(
            action_type="register_failure",
            category="auth",
            description=f"Registration failed for {mask_email(norm_email)}: {str(e)}",
            status="failed",
            email=mask_email(norm_email),
            ip_address=ip,
            user_agent=ua,
            metadata={"attempted_email": mask_email(norm_email)},
        )
        msg = "This email is already registered"
        return JSONResponse(
            status_code=status.HTTP_409_CONFLICT,
            content={"code": "EMAIL_EXISTS", "message": msg, "detail": msg},
        )

    clear_failed_auth(ip, norm_email)
    token = create_session(user["id"], expires_days=7)

    log_activity(
        user_id=user["id"],
        user_name=user["name"],
        email=mask_email(norm_email),
        role=user["role"],
        action_type="register_success",
        category="auth",
        description=f"User {user['name']} ({mask_email(norm_email)}) registered successfully",
        status="success",
        ip_address=ip,
        user_agent=ua,
        metadata={"role": user["role"]},
    )

    _set_auth_cookie(response, token, max_age=_COOKIE_MAX_AGE_DEFAULT)
    return AuthResponse(
        token=token,
        user=UserResponse(**user),
        message="Account created. Welcome to Car Worth.",
    )


# ── User Sign In Endpoint ────────────────────────────────────────────────────────────────

@router.post("/login", response_model=AuthResponse)
def login_user(req: LoginRequest, request: Request, response: Response):
    """
    Sign in with email and password.
    Returns session token in httpOnly cookie and in JSON body (backward-compat).
    """
    enforce_rate_limit(request, "auth_login", max_requests=25, window_seconds=60)
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    norm_email = req.email.strip().lower()

    # Check brute-force lockout
    is_locked, rem_mins = check_auth_lockout(ip, norm_email)
    if is_locked:
        msg = f"Too many attempts. Try again in {rem_mins} minutes."
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"code": "TOO_MANY_ATTEMPTS", "message": msg, "detail": msg},
            headers={"Retry-After": str(rem_mins * 60)},
        )

    user_record = get_user_by_email(norm_email)

    # 1. Email not found -> Run dummy hash check to mitigate timing side-channel
    if not user_record:
        verify_dummy_password(req.password)
        record_failed_auth(ip, norm_email)
        log_activity(
            action_type="login_failure",
            category="auth",
            description=f"Failed login: non-existent email {mask_email(norm_email)}",
            status="failed",
            email=mask_email(norm_email),
            ip_address=ip,
            user_agent=ua,
            metadata={"reason": "INVALID_EMAIL", "portal": "user_login"},
        )
        msg = "Invalid email" if SPECIFIC_AUTH_ERRORS else "Invalid email or password"
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"code": "INVALID_EMAIL", "message": msg, "detail": msg},
        )

    # 2. Email found, verify password
    if not verify_password(req.password, user_record["password_hash"], user_record["salt"]):
        record_failed_auth(ip, norm_email)
        log_activity(
            action_type="login_failure",
            category="auth",
            description=f"Failed login: incorrect password for {mask_email(norm_email)}",
            status="failed",
            email=mask_email(norm_email),
            ip_address=ip,
            user_agent=ua,
            metadata={"reason": "INVALID_PASSWORD", "portal": "user_login"},
        )
        msg = "Invalid password" if SPECIFIC_AUTH_ERRORS else "Invalid email or password"
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"code": "INVALID_PASSWORD", "message": msg, "detail": msg},
        )

    # 3. Account disabled check
    if user_record.get("status") != "active":
        log_activity(
            user_id=user_record["id"],
            user_name=user_record["name"],
            email=mask_email(norm_email),
            role=user_record["role"],
            action_type="login_failure",
            category="auth",
            description=f"Deactivated account login attempt by {mask_email(norm_email)}",
            status="failed",
            ip_address=ip,
            user_agent=ua,
            metadata={"reason": "ACCOUNT_DISABLED"},
        )
        msg = "Your account has been deactivated. Contact support."
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"code": "ACCOUNT_DISABLED", "message": msg, "detail": msg},
        )

    # Clear lockout on successful authentication
    clear_failed_auth(ip, norm_email)

    expires_days = 30 if req.remember_me else 7
    token = create_session(user_record["id"], expires_days=expires_days)
    clean_user = {k: v for k, v in user_record.items() if k not in ["password_hash", "salt"]}

    log_activity(
        user_id=clean_user["id"],
        user_name=clean_user["name"],
        email=mask_email(norm_email),
        role=clean_user["role"],
        action_type="login_success",
        category="auth",
        description=f"User {clean_user['name']} signed in successfully",
        status="success",
        ip_address=ip,
        user_agent=ua,
        metadata={"remember_me": req.remember_me, "role": clean_user["role"]},
    )

    max_age = _COOKIE_MAX_AGE_REMEMBER if req.remember_me else _COOKIE_MAX_AGE_DEFAULT
    _set_auth_cookie(response, token, max_age=max_age)
    return AuthResponse(
        token=token,
        user=UserResponse(**clean_user),
        message="Sign in successful",
    )


# ── Admin Login Gateway Endpoint ────────────────────────────────────────────────

@router.post("/admin-login", response_model=AuthResponse)
def admin_login(req: AdminLoginRequest, request: Request, response: Response):
    """
    Dedicated admin sign-in endpoint. Enforces role == 'admin'.
    Issues session token in httpOnly cookie and JSON body (backward-compat).
    """
    enforce_rate_limit(request, "auth_admin", max_requests=15, window_seconds=60)
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    norm_email = req.email.strip().lower()

    # Check brute-force lockout
    is_locked, rem_mins = check_auth_lockout(ip, norm_email)
    if is_locked:
        msg = f"Too many attempts. Try again in {rem_mins} minutes."
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={"code": "TOO_MANY_ATTEMPTS", "message": msg, "detail": msg},
            headers={"Retry-After": str(rem_mins * 60)},
        )

    user_record = get_user_by_email(norm_email)

    if not user_record:
        verify_dummy_password(req.password)
        record_failed_auth(ip, norm_email)
        log_activity(
            action_type="admin_login_failure",
            category="auth",
            description=f"Invalid email on admin portal: {mask_email(norm_email)}",
            status="failed",
            email=mask_email(norm_email),
            ip_address=ip,
            user_agent=ua,
            metadata={"reason": "INVALID_EMAIL", "portal": "admin_login"},
        )
        msg = "Invalid email" if SPECIFIC_AUTH_ERRORS else "Invalid email or password"
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"code": "INVALID_EMAIL", "message": msg, "detail": msg},
        )

    if not verify_password(req.password, user_record["password_hash"], user_record["salt"]):
        record_failed_auth(ip, norm_email)
        log_activity(
            action_type="admin_login_failure",
            category="auth",
            description=f"Invalid password on admin portal for {mask_email(norm_email)}",
            status="failed",
            email=mask_email(norm_email),
            ip_address=ip,
            user_agent=ua,
            metadata={"reason": "INVALID_PASSWORD", "portal": "admin_login"},
        )
        msg = "Invalid password" if SPECIFIC_AUTH_ERRORS else "Invalid email or password"
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={"code": "INVALID_PASSWORD", "message": msg, "detail": msg},
        )

    # Role check: only 'admin' accounts permitted
    if user_record.get("role") != "admin":
        log_activity(
            user_id=user_record["id"],
            user_name=user_record["name"],
            email=mask_email(norm_email),
            role=user_record["role"],
            action_type="admin_login_denied",
            category="auth",
            description=f"Non-admin user {mask_email(norm_email)} attempted to sign into admin portal",
            status="failed",
            ip_address=ip,
            user_agent=ua,
            metadata={"role": user_record["role"], "reason": "ACCESS_DENIED"},
        )
        msg = "Access denied. Admin accounts only. Administrator privileges required."
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"code": "ACCESS_DENIED", "message": msg, "detail": msg},
        )

    if user_record.get("status") != "active":
        msg = "Your account has been deactivated. Contact support."
        return JSONResponse(
            status_code=status.HTTP_403_FORBIDDEN,
            content={"code": "ACCOUNT_DISABLED", "message": msg, "detail": msg},
        )

    clear_failed_auth(ip, norm_email)
    token = create_session(user_record["id"], expires_days=7)
    clean_user = {k: v for k, v in user_record.items() if k not in ["password_hash", "salt"]}

    log_activity(
        user_id=clean_user["id"],
        user_name=clean_user["name"],
        email=mask_email(norm_email),
        role="admin",
        action_type="admin_login_success",
        category="auth",
        description=f"Admin {clean_user['name']} authenticated via admin portal",
        status="success",
        ip_address=ip,
        user_agent=ua,
        metadata={"portal": "admin_portal"},
    )

    _set_auth_cookie(response, token, max_age=_COOKIE_MAX_AGE_DEFAULT)
    return AuthResponse(
        token=token,
        user=UserResponse(**clean_user),
        message="Administrator sign in successful",
    )


@router.get("/csrf")
def get_csrf_token(request: Request, response: Response):
    """Return and set a fresh double-submit CSRF token."""
    token = request.cookies.get("csrf_token") or secrets.token_urlsafe(24)
    response.set_cookie(
        key="csrf_token",
        value=token,
        httponly=False,
        samesite="lax",
        secure=_COOKIE_SECURE,
        max_age=_COOKIE_MAX_AGE_DEFAULT,
        path="/",
    )
    return {"csrf_token": token}


@router.get("/me", response_model=UserResponse)
def get_current_user_profile(
    request: Request,
    response: Response,
    user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Fetch profile of the currently logged-in user and ensure valid CSRF token."""
    if not request.cookies.get("csrf_token"):
        token = secrets.token_urlsafe(24)
        response.set_cookie(
            key="csrf_token",
            value=token,
            httponly=False,
            samesite="lax",
            secure=_COOKIE_SECURE,
            max_age=_COOKIE_MAX_AGE_DEFAULT,
            path="/",
        )
    return UserResponse(**user)


@router.put("/profile", response_model=UserResponse)
def update_profile(
    req: UpdateProfileRequest,
    request: Request,
    user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Update profile name of authenticated user."""
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    old_name = user["name"]

    updated = update_user_profile(user["id"], req.name)

    log_activity(
        user_id=user["id"],
        user_name=updated["name"],
        email=user["email"],
        role=user["role"],
        action_type="profile_update",
        category="profile",
        description=f"User updated name from '{old_name}' to '{req.name}'",
        status="success",
        ip_address=ip,
        user_agent=ua,
        metadata={"old_name": old_name, "new_name": req.name}
    )

    return UserResponse(**updated)


@router.put("/change-password")
def change_password(
    req: ChangePasswordRequest,
    request: Request,
    response: Response,
    user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """
    Change password for authenticated user (regular user or admin).
    Revokes all active sessions for this user, issues a fresh session on current device,
    and returns a success confirmation.
    """
    ip = get_client_ip(request)
    ua = get_user_agent(request)
    norm_email = user["email"].strip().lower()

    # Rate limiting: 10 requests per minute per IP
    enforce_rate_limit(request, "auth_change_pw", max_requests=10, window_seconds=60)

    # 1. Validation: confirm_new_password matches new_password
    if req.new_password != req.confirm_new_password:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={"code": "PASSWORD_MISMATCH", "message": "Passwords do not match"},
        )

    # 2. Validation: new_password cannot be same as current_password
    if req.new_password == req.current_password:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "code": "SAME_PASSWORD",
                "message": "New password must be different from your current password",
            },
        )

    # 3. Validation: new_password complexity (same rules as registration)
    pw = req.new_password
    if len(pw) < 8 or len(pw) > 72:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "code": "WEAK_PASSWORD",
                "message": "New password must be between 8 and 72 characters.",
            },
        )
    if not re.search(r"[A-Z]", pw):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "code": "WEAK_PASSWORD",
                "message": "New password must contain at least one uppercase letter.",
            },
        )
    if not re.search(r"[a-z]", pw):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "code": "WEAK_PASSWORD",
                "message": "New password must contain at least one lowercase letter.",
            },
        )
    if not re.search(r"[0-9]", pw):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "code": "WEAK_PASSWORD",
                "message": "New password must contain at least one number.",
            },
        )
    if not re.search(r"[!@#$%^&*(),.?\":{}|<>\-_=+/\\\[\]~`]", pw):
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "code": "WEAK_PASSWORD",
                "message": "New password must contain at least one special character.",
            },
        )
    if pw.lower() in COMMON_PASSWORDS:
        return JSONResponse(
            status_code=status.HTTP_400_BAD_REQUEST,
            content={
                "code": "WEAK_PASSWORD",
                "message": "This password is too common and easily guessed. Please choose a stronger password.",
            },
        )

    # 4. Verify current_password against user's stored hash and salt
    user_auth = get_user_auth_by_id(user["id"])
    if not user_auth or not verify_password(
        req.current_password, user_auth["password_hash"], user_auth["salt"]
    ):
        log_activity(
            user_id=user["id"],
            user_name=user["name"],
            email=mask_email(norm_email),
            role=user["role"],
            action_type="password_change_failure",
            category="auth",
            description=f"Failed password change attempt: incorrect current password for {mask_email(norm_email)}",
            status="failed",
            ip_address=ip,
            user_agent=ua,
            metadata={"reason": "INVALID_CURRENT_PASSWORD"},
        )
        return JSONResponse(
            status_code=status.HTTP_401_UNAUTHORIZED,
            content={
                "code": "INVALID_CURRENT_PASSWORD",
                "message": "Current password is incorrect",
            },
        )

    # 5. Success: update password in DB
    update_user_password(user["id"], req.new_password)

    # 6. Revoke ALL existing sessions for this user (logs out all other devices)
    revoke_all_user_sessions(user["id"])

    # 7. Create a brand new session for current device and attach cookie
    new_token = create_session(user["id"], expires_days=7)
    _set_auth_cookie(response, new_token)

    # 8. Activity log: mask email, NEVER log plain text passwords
    log_activity(
        user_id=user["id"],
        user_name=user["name"],
        email=mask_email(norm_email),
        role=user["role"],
        action_type="password_changed",
        category="auth",
        description=f"Password changed successfully for {mask_email(norm_email)}",
        status="success",
        ip_address=ip,
        user_agent=ua,
        metadata={"revoked_other_sessions": True},
    )

    return {
        "message": "Password changed successfully. You've been signed out of all other devices.",
        "token": new_token,
    }


@router.post("/logout")
def logout_user(
    request: Request,
    response: Response,
    authorization: Optional[str] = Header(None),
    user: Dict[str, Any] = Depends(require_authenticated_user),
):
    """Revoke session token (cookie + Bearer) and log logout event."""
    ip = get_client_ip(request)
    ua = get_user_agent(request)

    # Revoke session from DB — try cookie token first, then Bearer header
    token = request.cookies.get("auth_token")
    if not token and authorization and authorization.startswith("Bearer "):
        token = authorization.split("Bearer ", 1)[1].strip()
    if token:
        revoke_session(token)

    # Clear the cookie on the client
    _clear_auth_cookie(response)

    log_activity(
        user_id=user["id"],
        user_name=user["name"],
        email=user["email"],
        role=user["role"],
        action_type="logout",
        category="auth",
        description=f"User {user['name']} signed out",
        status="success",
        ip_address=ip,
        user_agent=ua,
    )

    return {"message": "Logged out successfully"}
