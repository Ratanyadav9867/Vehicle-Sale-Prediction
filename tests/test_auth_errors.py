"""
tests/test_auth_errors.py
=========================
Tests for granular authentication error codes (INVALID_EMAIL, INVALID_PASSWORD,
ACCESS_DENIED, ACCOUNT_DISABLED, EMAIL_EXISTS) and brute-force lockout (TOO_MANY_ATTEMPTS).
"""

import pytest
from starlette.testclient import TestClient
from backend.main import app
from backend.db.database import init_db, get_connection
from backend.routers.auth import clear_failed_auth

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_db():
    init_db()
    with get_connection() as conn:
        # Create a disabled user
        conn.execute("DELETE FROM users WHERE email IN ('disabled@test.com', 'autherr@test.com', 'lockout@test.com')")
        conn.commit()


def test_login_invalid_email():
    """Non-existent email returns 401 with INVALID_EMAIL."""
    clear_failed_auth("127.0.0.1", "nonexistent_999@test.com")
    res = client.post("/api/auth/login", json={
        "email": "nonexistent_999@test.com",
        "password": "SecurePass#123",
    })
    assert res.status_code == 401
    data = res.json()
    assert data["code"] == "INVALID_EMAIL"
    assert "Invalid email" in data["message"]


def test_login_invalid_password():
    """Valid email but incorrect password returns 401 with INVALID_PASSWORD."""
    # Ensure user exists
    client.post("/api/auth/register", json={
        "name": "Auth Error User",
        "email": "autherr@test.com",
        "password": "SecurePass#123",
        "confirm_password": "SecurePass#123",
    })
    clear_failed_auth("127.0.0.1", "autherr@test.com")

    res = client.post("/api/auth/login", json={
        "email": "autherr@test.com",
        "password": "WrongPassword#999",
    })
    assert res.status_code == 401
    data = res.json()
    assert data["code"] == "INVALID_PASSWORD"
    assert "Invalid password" in data["message"]


def test_login_account_disabled():
    """Deactivated account returns 403 with ACCOUNT_DISABLED."""
    # Register and then deactivate
    client.post("/api/auth/register", json={
        "name": "Disabled User",
        "email": "disabled@test.com",
        "password": "SecurePass#123",
        "confirm_password": "SecurePass#123",
    })
    with get_connection() as conn:
        conn.execute("UPDATE users SET status = 'disabled' WHERE email = 'disabled@test.com'")
        conn.commit()
    clear_failed_auth("testclient", "disabled@test.com")
    clear_failed_auth("127.0.0.1", "disabled@test.com")

    res = client.post("/api/auth/login", json={
        "email": "disabled@test.com",
        "password": "SecurePass#123",
    })
    assert res.status_code == 403
    data = res.json()
    assert data["code"] == "ACCOUNT_DISABLED"
    assert "deactivated" in data["message"].lower()


def test_admin_login_access_denied_for_regular_user():
    """Regular user attempting admin login returns 403 with ACCESS_DENIED."""
    clear_failed_auth("testclient", "autherr@test.com")
    clear_failed_auth("127.0.0.1", "autherr@test.com")
    res = client.post("/api/auth/admin-login", json={
        "email": "autherr@test.com",
        "password": "SecurePass#123",
    })
    assert res.status_code == 403
    data = res.json()
    assert data["code"] == "ACCESS_DENIED"


def test_register_duplicate_email():
    """Attempting to register existing email returns 409 with EMAIL_EXISTS."""
    res = client.post("/api/auth/register", json={
        "name": "Duplicate User",
        "email": "autherr@test.com",
        "password": "SecurePass#123",
        "confirm_password": "SecurePass#123",
    })
    assert res.status_code == 409
    data = res.json()
    assert data["code"] == "EMAIL_EXISTS"
    assert "already registered" in data["message"].lower()


def test_rate_limit_lockout():
    """5 consecutive failed attempts trigger 429 TOO_MANY_ATTEMPTS."""
    email = "lockout@test.com"
    clear_failed_auth("testclient", email)
    clear_failed_auth("127.0.0.1", email)

    for i in range(5):
        res = client.post("/api/auth/login", json={
            "email": email,
            "password": f"WrongPass_{i}#123",
        })
        assert res.status_code == 401

    # 6th attempt should be blocked with 429
    res6 = client.post("/api/auth/login", json={
        "email": email,
        "password": "WrongPass_6#123",
    })
    assert res6.status_code == 429
    data = res6.json()
    assert data["code"] == "TOO_MANY_ATTEMPTS"
    assert "too many attempts" in data["message"].lower()

    # Clean up lockout
    clear_failed_auth("testclient", email)
    clear_failed_auth("127.0.0.1", email)
