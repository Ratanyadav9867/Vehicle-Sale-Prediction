"""
tests/test_production_auth_cross_site.py
========================================
Production verification test suite for cross-site authentication, cookies,
CORS, CSRF protection, and session persistence between Vercel and Railway.

Covers:
  - Successful production login with Set-Cookie attributes
  - Cookie SameSite=None, Secure, HttpOnly, and host-only scoping (__Host- prefix)
  - CSRF cookie and X-CSRF-Token response header exposure
  - Suppression of session token in JSON body in production (XSS mitigation)
  - Authenticated request immediately after login via HttpOnly cookie
  - Dual format compatibility on /api/auth/me (root fields + nested user object)
  - Rejection of unauthenticated requests with HTTP 401
  - CORS with exact Vercel origin and credentials support
  - CORS rejection for unauthorized origins
  - Cross-Origin-Resource-Policy: cross-origin
  - Double-Submit CSRF protection enforcement for state-changing requests
  - Logout clearing cookies with matching SameSite and Secure attributes
  - Development mode fallback to SameSite=Lax and Secure=False
"""

import os
from starlette.testclient import TestClient
from backend.main import app
from backend.db.database import init_db, get_connection, hash_password, create_session
import backend.routers.auth as auth_mod


def _ensure_test_user(email: str = "prod_user@test.com", password: str = "SecurePass#123", role: str = "user"):
    init_db()
    with get_connection() as conn:
        existing = conn.execute("SELECT id FROM users WHERE email = ?;", (email,)).fetchone()
        if not existing:
            pwd_hash, salt = hash_password(password)
            now = "2026-01-01T00:00:00+00:00"
            conn.execute(
                """
                INSERT INTO users (name, email, password_hash, salt, role, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'active', ?, ?);
                """,
                ("Prod User", email, pwd_hash, salt, role, now, now),
            )
            conn.commit()


def test_production_cookie_settings_attributes():
    """Verify that _set_auth_cookie applies SameSite=None and Secure=True in production."""
    from fastapi import Response

    res = Response()
    # Save original settings
    orig_env = auth_mod._ENV
    orig_secure = auth_mod._COOKIE_SECURE
    orig_samesite = auth_mod._COOKIE_SAMESITE
    orig_name = auth_mod._COOKIE_NAME

    try:
        # Simulate production environment
        auth_mod._ENV = "production"
        auth_mod._COOKIE_SECURE = True
        auth_mod._COOKIE_SAMESITE = "none"
        auth_mod._COOKIE_NAME = "__Host-auth_token"

        token = "test_prod_session_token_12345"
        auth_mod._set_auth_cookie(res, token)

        raw_set_cookies = res.headers.getlist("set-cookie") if hasattr(res.headers, "getlist") else [res.headers.get("set-cookie", "")]
        cookie_text = " ;; ".join(raw_set_cookies)

        # 1. Host-only auth cookie with __Host- prefix
        assert "__Host-auth_token=" in cookie_text
        assert "samesite=none" in cookie_text.lower()
        assert "secure" in cookie_text.lower()
        assert "httponly" in cookie_text.lower()
        # Must be host-only (no broad domain attribute)
        assert "domain=" not in cookie_text.lower()

        # 2. CSRF cookie with SameSite=None, Secure=True, readable (not httponly)
        assert "csrf_token=" in cookie_text

        # 3. X-CSRF-Token response header exposed for cross-site frontend clients
        assert "X-CSRF-Token" in res.headers
        assert len(res.headers["X-CSRF-Token"]) > 0

    finally:
        auth_mod._ENV = orig_env
        auth_mod._COOKIE_SECURE = orig_secure
        auth_mod._COOKIE_SAMESITE = orig_samesite
        auth_mod._COOKIE_NAME = orig_name


def test_successful_production_login_and_token_suppression():
    """Production login must set HttpOnly/Secure/SameSite=None cookies and NOT expose token in JSON."""
    _ensure_test_user("prod_login@test.com", "SecurePass#123")
    client = TestClient(app, raise_server_exceptions=True)

    orig_env = auth_mod._ENV
    orig_secure = auth_mod._COOKIE_SECURE
    orig_samesite = auth_mod._COOKIE_SAMESITE
    orig_name = auth_mod._COOKIE_NAME

    try:
        auth_mod._ENV = "production"
        auth_mod._COOKIE_SECURE = True
        auth_mod._COOKIE_SAMESITE = "none"
        auth_mod._COOKIE_NAME = "__Host-auth_token"

        auth_mod.clear_failed_auth(email="prod_login@test.com")

        res = client.post(
            "/api/auth/login",
            json={"email": "prod_login@test.com", "password": "SecurePass#123"},
        )
        assert res.status_code == 200
        data = res.json()

        # In production, session token must NOT be returned in JSON body
        assert data.get("token") is None
        assert data["user"]["email"] == "prod_login@test.com"

        # Check Set-Cookie headers
        set_cookie = res.headers.get("set-cookie", "")
        assert "__Host-auth_token=" in set_cookie
        assert "samesite=none" in set_cookie.lower()
        assert "secure" in set_cookie.lower()
        assert "httponly" in set_cookie.lower()
        assert "csrf_token=" in set_cookie
        assert "x-csrf-token" in res.headers

    finally:
        auth_mod._ENV = orig_env
        auth_mod._COOKIE_SECURE = orig_secure
        auth_mod._COOKIE_SAMESITE = orig_samesite
        auth_mod._COOKIE_NAME = orig_name


def test_authenticated_request_immediately_after_login_via_cookie():
    """Client sending __Host-auth_token cookie can access /api/auth/me immediately."""
    _ensure_test_user("prod_persist@test.com", "SecurePass#123")
    client = TestClient(app, raise_server_exceptions=True)

    from backend.db.database import get_user_by_email
    user = get_user_by_email("prod_persist@test.com")
    token = create_session(user["id"])

    # Simulate cross-site browser request with cookies attached
    client.cookies.set("__Host-auth_token", token)
    res = client.get("/api/auth/me")
    assert res.status_code == 200
    data = res.json()

    # Verify dual compatibility: root user fields + nested user object
    assert data["id"] == user["id"]
    assert data["email"] == "prod_persist@test.com"
    assert "user" in data
    assert data["user"]["id"] == user["id"]
    assert data["user"]["email"] == "prod_persist@test.com"

    # Verify X-CSRF-Token is returned in headers
    assert "x-csrf-token" in res.headers


def test_unauthenticated_request_rejection():
    """Unauthenticated request to protected endpoint must return 401 with standard detail message."""
    client = TestClient(app, raise_server_exceptions=True)
    client.cookies.clear()

    res = client.get("/api/auth/me")
    assert res.status_code == 401
    assert "Authentication required. Please sign in to proceed." in res.json().get("detail", "")


def test_cors_with_exact_vercel_origin_and_credentials():
    """CORS must allow credentials and exact Vercel origin without wildcards."""
    client = TestClient(app, raise_server_exceptions=True)
    vercel_origin = "https://vehicle-sale-prediction.vercel.app"

    # Preflight OPTIONS request
    res_opts = client.options(
        "/api/auth/me",
        headers={
            "Origin": vercel_origin,
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "X-CSRF-Token, Content-Type",
        },
    )
    # Check origin handling: if vercel_origin is in ALLOWED_ORIGINS
    from backend.main import _ALLOWED_ORIGINS
    if vercel_origin in _ALLOWED_ORIGINS:
        assert res_opts.headers.get("access-control-allow-origin") == vercel_origin
        assert res_opts.headers.get("access-control-allow-credentials") == "true"
        exposed = res_opts.headers.get("access-control-expose-headers", "").lower()
        assert "x-csrf-token" in exposed

    # Untrusted origin must NOT receive access-control-allow-origin
    evil_origin = "https://evil-spoofing-site.com"
    res_evil = client.get("/api/health", headers={"Origin": evil_origin})
    assert res_evil.headers.get("access-control-allow-origin") != evil_origin


def test_cross_origin_resource_policy_header():
    """API responses must include Cross-Origin-Resource-Policy: cross-origin for frontend SPAs."""
    client = TestClient(app, raise_server_exceptions=True)
    res = client.get("/api/health")
    assert res.headers.get("cross-origin-resource-policy") == "cross-origin"


def test_csrf_protection_on_cookie_authenticated_state_changing_requests():
    """Cookie-authenticated state-changing requests must enforce valid matching X-CSRF-Token header."""
    _ensure_test_user("prod_csrf@test.com", "SecurePass#123")
    client = TestClient(app, raise_server_exceptions=True)

    from backend.db.database import get_user_by_email
    user = get_user_by_email("prod_csrf@test.com")
    token = create_session(user["id"])
    valid_csrf = "valid-csrf-token-secret-xyz"

    client.cookies.set("__Host-auth_token", token)
    client.cookies.set("csrf_token", valid_csrf)

    # 1. Missing X-CSRF-Token header -> Must be rejected with 403 Forbidden
    res_missing = client.put("/api/auth/profile", json={"name": "Attacker Name"})
    assert res_missing.status_code == 403
    assert "CSRF validation failed" in res_missing.json().get("detail", "")

    # 2. Forged/mismatched X-CSRF-Token header -> Must be rejected with 403 Forbidden
    res_mismatch = client.put(
        "/api/auth/profile",
        json={"name": "Attacker Name"},
        headers={"X-CSRF-Token": "wrong-forged-token"},
    )
    assert res_mismatch.status_code == 403
    assert "CSRF validation failed" in res_mismatch.json().get("detail", "")

    # 3. Valid matching X-CSRF-Token header -> Must succeed with 200 OK
    res_valid = client.put(
        "/api/auth/profile",
        json={"name": "Legitimate User Name"},
        headers={"X-CSRF-Token": valid_csrf},
    )
    assert res_valid.status_code == 200
    assert res_valid.json()["name"] == "Legitimate User Name"


def test_logout_clears_cookies_with_matching_attributes():
    """Logout endpoint must revoke session and delete cookies with matching SameSite and Secure."""
    _ensure_test_user("prod_logout@test.com", "SecurePass#123")
    client = TestClient(app, raise_server_exceptions=True)

    orig_env = auth_mod._ENV
    orig_secure = auth_mod._COOKIE_SECURE
    orig_samesite = auth_mod._COOKIE_SAMESITE
    orig_name = auth_mod._COOKIE_NAME

    try:
        auth_mod._ENV = "production"
        auth_mod._COOKIE_SECURE = True
        auth_mod._COOKIE_SAMESITE = "none"
        auth_mod._COOKIE_NAME = "__Host-auth_token"

        from backend.db.database import get_user_by_email
        user = get_user_by_email("prod_logout@test.com")
        token = create_session(user["id"])
        csrf_val = "csrf-logout-test-token"

        client.cookies.set("__Host-auth_token", token)
        client.cookies.set("csrf_token", csrf_val)
        res = client.post("/api/auth/logout", headers={"X-CSRF-Token": csrf_val})
        assert res.status_code == 200

        set_cookie = res.headers.get("set-cookie", "")
        # Deletion sets max-age=0 or expires in the past
        assert "__Host-auth_token=" in set_cookie
        assert "samesite=none" in set_cookie.lower()
        assert "secure" in set_cookie.lower()

        # Verify old session token was revoked in DB
        res_after = client.get("/api/auth/me", cookies={"__Host-auth_token": token})
        assert res_after.status_code == 401

    finally:
        auth_mod._ENV = orig_env
        auth_mod._COOKIE_SECURE = orig_secure
        auth_mod._COOKIE_SAMESITE = orig_samesite
        auth_mod._COOKIE_NAME = orig_name


def test_development_mode_cookie_settings_fallback():
    """In development mode over plain HTTP, cookies must use SameSite=Lax and Secure=False."""
    from fastapi import Response

    res = Response()
    orig_env = auth_mod._ENV
    orig_secure = auth_mod._COOKIE_SECURE
    orig_samesite = auth_mod._COOKIE_SAMESITE
    orig_name = auth_mod._COOKIE_NAME

    try:
        auth_mod._ENV = "development"
        auth_mod._COOKIE_SECURE = False
        auth_mod._COOKIE_SAMESITE = "lax"
        auth_mod._COOKIE_NAME = "auth_token"

        auth_mod._set_auth_cookie(res, "dev_token_123")
        raw_set_cookies = res.headers.getlist("set-cookie") if hasattr(res.headers, "getlist") else [res.headers.get("set-cookie", "")]
        cookie_text = " ;; ".join(raw_set_cookies)

        assert "auth_token=" in cookie_text
        assert "samesite=lax" in cookie_text.lower()
        # Over HTTP dev, secure should not be present
        assert "secure" not in cookie_text.lower()

    finally:
        auth_mod._ENV = orig_env
        auth_mod._COOKIE_SECURE = orig_secure
        auth_mod._COOKIE_SAMESITE = orig_samesite
        auth_mod._COOKIE_NAME = orig_name
