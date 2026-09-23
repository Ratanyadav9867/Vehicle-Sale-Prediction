"""
tests/test_auth_logs.py
=======================
Tests for Authentication, Role Gating, User Management, and Activity Logging.
"""

import pytest
from starlette.testclient import TestClient
from backend.main import app
from backend.db.database import init_db, get_connection
from backend.model.loader import model_store

client = TestClient(app)


@pytest.fixture(scope="module", autouse=True)
def setup_database_and_model():
    init_db()
    if not model_store.is_ready:
        model_store.load()
    with get_connection() as conn:
        conn.execute("DELETE FROM users WHERE email = 'johndoe@test.com'")
        conn.commit()


class TestAuthEndpoints:
    def test_admin_pre_seeded(self):
        """Pre-seeded admin account can authenticate via /api/auth/admin-login."""
        res = client.post("/api/auth/admin-login", json={
            "email": "admin@vehicleai.com",
            "password": "Admin@12345",
        })
        assert res.status_code == 200, res.text
        data = res.json()
        assert "token" in data
        assert data["user"]["role"] == "admin"
        assert data["user"]["email"] == "admin@vehicleai.com"

    def test_register_and_login_user(self):
        """New user can register and defaults to role 'user'."""
        email = "johndoe@test.com"
        reg_res = client.post("/api/auth/register", json={
            "name": "John Doe",
            "email": email,
            "password": "SecurePass#123",
            "confirm_password": "SecurePass#123",
        })
        # If user already exists from previous run, it might be 400/409
        if reg_res.status_code in (400, 409) and ("already exists" in reg_res.text or "EMAIL_EXISTS" in reg_res.text):
            pass
        else:
            assert reg_res.status_code == 201
            assert reg_res.json()["user"]["role"] == "user"

        # Now login
        login_res = client.post("/api/auth/login", json={
            "email": email,
            "password": "SecurePass#123",
        })
        assert login_res.status_code == 200
        token = login_res.json()["token"]
        assert login_res.json()["user"]["role"] == "user"

        # Non-admin cannot log in via admin-login portal
        admin_login_res = client.post("/api/auth/admin-login", json={
            "email": email,
            "password": "SecurePass#123",
        })
        assert admin_login_res.status_code == 403
        assert "ACCESS_DENIED" in admin_login_res.text or "Access denied" in admin_login_res.text

    def test_password_mismatch_fails_registration(self):
        res = client.post("/api/auth/register", json={
            "name": "Mismatch User",
            "email": "mismatch@test.com",
            "password": "SecurePass#123",
            "confirm_password": "DifferentPassword#123",
        })
        assert res.status_code == 422

    def test_me_profile_and_update(self):
        # Login as user
        login_res = client.post("/api/auth/login", json={
            "email": "johndoe@test.com",
            "password": "SecurePass#123",
        })
        token = login_res.json()["token"]
        headers = {"Authorization": f"Bearer {token}"}

        # Get profile
        me_res = client.get("/api/auth/me", headers=headers)
        assert me_res.status_code == 200
        assert me_res.json()["email"] == "johndoe@test.com"

        # Update profile name
        update_res = client.put("/api/auth/profile", json={"name": "John Updated"}, headers=headers)
        assert update_res.status_code == 200
        assert update_res.json()["name"] == "John Updated"

        # Check own logs
        my_logs = client.get("/api/me/logs", headers=headers)
        assert my_logs.status_code == 200
        logs = my_logs.json()
        assert len(logs) > 0
        actions = [l["action_type"] for l in logs]
        assert "profile_update" in actions or "login_success" in actions


class TestAdminLogsAndUserManagement:
    def get_admin_token(self):
        res = client.post("/api/auth/admin-login", json={
            "email": "admin@vehicleai.com",
            "password": "Admin@12345",
        })
        return res.json()["token"]

    def test_admin_dashboard_stats(self):
        token = self.get_admin_token()
        res = client.get("/api/admin/stats", headers={"Authorization": f"Bearer {token}"})
        assert res.status_code == 200
        stats = res.json()
        assert stats["total_users"] >= 1
        assert "recent_activity" in stats

    def test_admin_logs_listing_and_filtering(self):
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}

        res = client.get("/api/admin/logs?page=1&limit=10", headers=headers)
        assert res.status_code == 200
        data = res.json()
        assert "items" in data
        assert data["total"] >= 1
        assert len(data["items"]) <= 10

        # Filter by category
        res_cat = client.get("/api/admin/logs?category=auth", headers=headers)
        assert res_cat.status_code == 200
        for item in res_cat.json()["items"]:
            assert item["category"] == "auth"

    def test_admin_logs_export_csv_and_json(self):
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}

        # Export CSV
        csv_res = client.get("/api/admin/logs/export?format=csv", headers=headers)
        assert csv_res.status_code == 200
        assert "text/csv" in csv_res.headers.get("content-type", "")
        assert "Timestamp" in csv_res.text

        # Export JSON
        json_res = client.get("/api/admin/logs/export?format=json", headers=headers)
        assert json_res.status_code == 200
        assert "application/json" in json_res.headers.get("content-type", "")

    def test_regular_user_blocked_from_admin_logs(self):
        # Login as regular user
        login_res = client.post("/api/auth/login", json={
            "email": "johndoe@test.com",
            "password": "SecurePass#123",
        })
        user_token = login_res.json()["token"]
        headers = {"Authorization": f"Bearer {user_token}"}

        res = client.get("/api/admin/logs", headers=headers)
        assert res.status_code == 403

        res_stats = client.get("/api/admin/stats", headers=headers)
        assert res_stats.status_code == 403

    def test_valuation_event_is_audited(self):
        """POST /api/predict produces an audit log record when called by authenticated user."""
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        valid = {
            "brand": "Maruti",
            "year": 2018,
            "present_price": 6.5,
            "kms_driven": 35000,
            "fuel_type": "Petrol",
            "seller_type": "Dealer",
            "transmission": "Manual",
            "owner": 0
        }
        pred_res = client.post("/api/predict", json=valid, headers=headers)
        assert pred_res.status_code == 200

        # Check in admin logs that valuation_predicted event was recorded
        log_res = client.get("/api/admin/logs?action_type=valuation_predicted", headers=headers)
        assert log_res.status_code == 200
        items = log_res.json()["items"]
        assert len(items) > 0
        assert items[0]["action_type"] == "valuation_predicted"

    def test_unauthenticated_predict_returns_401_and_logs(self):
        """Unauthenticated call to /api/predict returns 401 and records an unauthorized access log."""
        client.cookies.clear()
        valid = {
            "brand": "Toyota",
            "year": 2019,
            "present_price": 10.0,
            "kms_driven": 20000,
            "fuel_type": "Petrol",
            "seller_type": "Dealer",
            "transmission": "Manual",
            "owner": 0
        }
        pred_res = client.post("/api/predict", json=valid)
        assert pred_res.status_code == 401

        # Check in admin logs that unauthorized_predict_attempt was recorded
        token = self.get_admin_token()
        headers = {"Authorization": f"Bearer {token}"}
        log_res = client.get("/api/admin/logs?action_type=unauthorized_predict_attempt", headers=headers)
        assert log_res.status_code == 200
        items = log_res.json()["items"]
        assert len(items) > 0
        assert items[0]["action_type"] == "unauthorized_predict_attempt"
        assert items[0]["status"] == "failed"
