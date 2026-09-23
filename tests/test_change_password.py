"""
tests/test_change_password.py
==============================
Comprehensive tests for PUT /api/auth/change-password endpoint:
- Authentication required (401 for unauthenticated)
- Invalid current password (401 INVALID_CURRENT_PASSWORD)
- Password mismatch (400 PASSWORD_MISMATCH)
- Same password as current (400 SAME_PASSWORD)
- Weak password complexity failures (400 WEAK_PASSWORD)
- Successful password change for regular user
- Successful password change for admin
- Session invalidation (old sessions revoked, new session active)
- Activity logging audit (no plain passwords in logs, masked email)
"""

import pytest
from starlette.testclient import TestClient
from backend.main import app
from backend.db.database import (
    init_db,
    get_connection,
    get_user_by_email,
    get_logs,
)

client = TestClient(app)

TEST_USER_EMAIL = "changepw_user@example.com"
TEST_USER_PASS = "InitialPass#123"
TEST_ADMIN_EMAIL = "changepw_admin@example.com"
TEST_ADMIN_PASS = "InitialAdminPass#123"


@pytest.fixture(scope="module", autouse=True)
def setup_change_pw_users():
    init_db()
    with get_connection() as conn:
        conn.execute("DELETE FROM users WHERE email IN (?, ?);", (TEST_USER_EMAIL, TEST_ADMIN_EMAIL))
        conn.commit()

    # Register regular user
    reg_user = client.post("/api/auth/register", json={
        "name": "ChangePW User",
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASS,
        "confirm_password": TEST_USER_PASS,
    })
    assert reg_user.status_code == 201

    # Register admin user via DB promotion
    reg_admin = client.post("/api/auth/register", json={
        "name": "ChangePW Admin",
        "email": TEST_ADMIN_EMAIL,
        "password": TEST_ADMIN_PASS,
        "confirm_password": TEST_ADMIN_PASS,
    })
    assert reg_admin.status_code == 201

    with get_connection() as conn:
        conn.execute("UPDATE users SET role = 'admin' WHERE email = ?;", (TEST_ADMIN_EMAIL,))
        conn.commit()


def test_change_password_unauthenticated():
    """Unauthenticated request to change-password must return 401."""
    client.cookies.clear()
    res = client.put("/api/auth/change-password", json={
        "current_password": "SomePass#123",
        "new_password": "NewPass#12345",
        "confirm_new_password": "NewPass#12345",
    })
    assert res.status_code == 401


def test_change_password_invalid_current():
    """Incorrect current password must return 401 with INVALID_CURRENT_PASSWORD."""
    login_res = client.post("/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASS,
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]

    res = client.put(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": "WrongCurrentPass#999",
            "new_password": "ValidNewPass#123",
            "confirm_new_password": "ValidNewPass#123",
        },
    )
    assert res.status_code == 401
    data = res.json()
    assert data["code"] == "INVALID_CURRENT_PASSWORD"
    assert "Current password is incorrect" in data["message"]


def test_change_password_mismatch():
    """Mismatched new password and confirmation must return 400 with PASSWORD_MISMATCH."""
    login_res = client.post("/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASS,
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]

    res = client.put(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": TEST_USER_PASS,
            "new_password": "ValidNewPass#123",
            "confirm_new_password": "DifferentPass#123",
        },
    )
    assert res.status_code == 400
    data = res.json()
    assert data["code"] == "PASSWORD_MISMATCH"
    assert "Passwords do not match" in data["message"]


def test_change_password_same_password():
    """New password identical to current password must return 400 with SAME_PASSWORD."""
    login_res = client.post("/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASS,
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]

    res = client.put(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": TEST_USER_PASS,
            "new_password": TEST_USER_PASS,
            "confirm_new_password": TEST_USER_PASS,
        },
    )
    assert res.status_code == 400
    data = res.json()
    assert data["code"] == "SAME_PASSWORD"
    assert "different from your current password" in data["message"]


def test_change_password_weak_complexity():
    """Weak new password (no special char, too short, no uppercase, etc.) must return 400 with WEAK_PASSWORD."""
    login_res = client.post("/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASS,
    })
    assert login_res.status_code == 200
    token = login_res.json()["token"]

    # Too short
    res = client.put(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": TEST_USER_PASS,
            "new_password": "Ab1!",
            "confirm_new_password": "Ab1!",
        },
    )
    assert res.status_code == 400
    assert res.json()["code"] == "WEAK_PASSWORD"

    # Missing special char
    res = client.put(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {token}"},
        json={
            "current_password": TEST_USER_PASS,
            "new_password": "NoSpecialChar123",
            "confirm_new_password": "NoSpecialChar123",
        },
    )
    assert res.status_code == 400
    assert res.json()["code"] == "WEAK_PASSWORD"


def test_change_password_success_user_and_session_invalidation():
    """
    Successful password change:
    - Revokes existing sessions
    - Issues a fresh session
    - Old password can no longer be used for login
    - New password works for login
    - Activity log audit verifies action_type='password_changed' without plaintext password
    """
    # 1. Login to establish session A
    login_a = client.post("/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASS,
    })
    assert login_a.status_code == 200
    old_token = login_a.json()["token"]

    # 2. Login from 'another device' to establish session B
    login_b = client.post("/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASS,
    })
    assert login_b.status_code == 200
    other_device_token = login_b.json()["token"]

    # Confirm other_device_token works
    me_check = client.get("/api/auth/me", headers={"Authorization": f"Bearer {other_device_token}"})
    assert me_check.status_code == 200

    # 3. Perform password change using session A
    new_pass = "BrandNewSecurePass#999"
    change_res = client.put(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {old_token}"},
        json={
            "current_password": TEST_USER_PASS,
            "new_password": new_pass,
            "confirm_new_password": new_pass,
        },
    )
    assert change_res.status_code == 200
    data = change_res.json()
    assert "Password changed successfully" in data["message"]
    new_token = data.get("token")
    assert new_token is not None
    assert new_token != old_token
    assert new_token != other_device_token

    # 4. Clear client cookies to verify Bearer tokens in isolation
    client.cookies.clear()

    # Verify other_device_token is now REVOKED
    me_revoked = client.get("/api/auth/me", headers={"Authorization": f"Bearer {other_device_token}"})
    assert me_revoked.status_code == 401

    # 5. Verify old_token is also revoked from sessions table
    me_old = client.get("/api/auth/me", headers={"Authorization": f"Bearer {old_token}"})
    assert me_old.status_code == 401

    # 6. Verify newly issued token works
    me_new = client.get("/api/auth/me", headers={"Authorization": f"Bearer {new_token}"})
    assert me_new.status_code == 200
    assert me_new.json()["email"] == TEST_USER_EMAIL

    # 7. Old password fails login
    fail_login = client.post("/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": TEST_USER_PASS,
    })
    assert fail_login.status_code == 401

    # 8. New password succeeds login
    succ_login = client.post("/api/auth/login", json={
        "email": TEST_USER_EMAIL,
        "password": new_pass,
    })
    assert succ_login.status_code == 200

    # 9. Verify activity log
    logs, _ = get_logs(action_type="password_changed", limit=5)
    assert len(logs) > 0
    latest_log = logs[0]
    assert latest_log["action_type"] == "password_changed"
    assert latest_log["status"] == "success"
    # Ensure plaintext passwords are not leaked in log description or metadata
    assert new_pass not in str(latest_log)
    assert TEST_USER_PASS not in str(latest_log)


def test_change_password_admin_success():
    """Admin can also change their password through PUT /api/auth/change-password."""
    admin_login = client.post("/api/auth/login", json={
        "email": TEST_ADMIN_EMAIL,
        "password": TEST_ADMIN_PASS,
    })
    assert admin_login.status_code == 200
    admin_token = admin_login.json()["token"]

    new_admin_pass = "UpdatedAdminPass#456"
    res = client.put(
        "/api/auth/change-password",
        headers={"Authorization": f"Bearer {admin_token}"},
        json={
            "current_password": TEST_ADMIN_PASS,
            "new_password": new_admin_pass,
            "confirm_new_password": new_admin_pass,
        },
    )
    assert res.status_code == 200
    assert "Password changed successfully" in res.json()["message"]

    # Test login with new admin password
    check_login = client.post("/api/auth/login", json={
        "email": TEST_ADMIN_EMAIL,
        "password": new_admin_pass,
    })
    assert check_login.status_code == 200
    assert check_login.json()["user"]["role"] == "admin"
