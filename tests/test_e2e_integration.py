import urllib.request
import json
import urllib.error
import sys

BASE_URL = "http://127.0.0.1:8000"
FRONTEND_URL = "http://localhost:5173"

def make_req(url, method="GET", data=None, headers=None):
    hdrs = {"Content-Type": "application/json", "Accept": "application/json"}
    if headers:
        hdrs.update(headers)
    body = json.dumps(data).encode("utf-8") if data else None
    req = urllib.request.Request(url, data=body, headers=hdrs, method=method)
    try:
        with urllib.request.urlopen(req) as resp:
            content = resp.read().decode("utf-8")
            ct = resp.headers.get("Content-Type", "")
            if "application/json" in ct:
                return resp.status, json.loads(content)
            return resp.status, content
    except urllib.error.HTTPError as e:
        content = e.read().decode("utf-8")
        try:
            return e.code, json.loads(content)
        except Exception:
            return e.code, content

def run_tests():
    print("=== STARTING LIVE E2E AUDIT & AUTH VERIFICATION ===")

    # 1. Frontend
    try:
        with urllib.request.urlopen(FRONTEND_URL) as r:
            html = r.read().decode()
            assert '<div id="root">' in html
            print("[OK] 1. Frontend Vite server is live and serving React index.html")
    except Exception as e:
        print("[FAIL] 1. Frontend failed:", e)
        sys.exit(1)

    # 2. Backend Health
    status, health = make_req(f"{BASE_URL}/api/health")
    assert status == 200 and health.get("status") == "ok"
    print("[OK] 2. Backend is healthy, model is loaded:", health.get("model_name"))

    # 3. Register a new user
    import time
    test_email = f"alex_{int(time.time())}@example.com"
    status, reg_data = make_req(f"{BASE_URL}/api/auth/register", method="POST", data={
        "name": "Alex Morgan",
        "email": test_email,
        "password": "Password123",
        "confirm_password": "Password123"
    })
    assert status in (200, 201), f"Register failed: {reg_data}"
    user_token = reg_data["token"]
    user_id = reg_data["user"]["id"]
    print(f"[OK] 3. Registered new user '{test_email}' (Role: {reg_data['user']['role']})")

    # 4. Standard User Login
    status, login_data = make_req(f"{BASE_URL}/api/auth/login", method="POST", data={
        "email": test_email,
        "password": "Password123"
    })
    assert status == 200
    print("[OK] 4. Standard user logged in successfully")

    # 5. Non-Admin blocked from Admin Login Gateway (403)
    status, admin_gate = make_req(f"{BASE_URL}/api/auth/admin-login", method="POST", data={
        "email": test_email,
        "password": "Password123"
    })
    assert status == 403, f"Expected 403 but got {status}"
    print("[OK] 5. Non-admin user blocked from Admin Gateway (HTTP 403 Access Denied)")

    # 6. Admin Login with default pre-seeded admin credentials
    status, admin_data = make_req(f"{BASE_URL}/api/auth/admin-login", method="POST", data={
        "email": "admin@vehicleai.com",
        "password": "Admin@12345"
    })
    assert status == 200, f"Admin login failed: {admin_data}"
    admin_token = admin_data["token"]
    assert admin_data["user"]["role"] == "admin"
    print("[OK] 6. Pre-seeded Admin authenticated successfully via /api/auth/admin-login")

    # 6b. Unauthenticated call to /api/predict must be rejected with 401
    status_unauth, unauth_data = make_req(f"{BASE_URL}/api/predict", method="POST", data={
        "brand": "Maruti",
        "year": 2018,
        "present_price": 6.5,
        "kms_driven": 35000,
        "fuel_type": "Petrol",
        "seller_type": "Dealer",
        "transmission": "Manual",
        "owner": 0
    })
    assert status_unauth == 401, f"Expected 401 for unauthenticated predict, got {status_unauth}"
    print("[OK] 6b. Unauthenticated POST /api/predict strictly returns HTTP 401 Unauthorized")

    # 7. Valuation predicted by authenticated user and saved to database
    status, pred_data = make_req(f"{BASE_URL}/api/predict", method="POST", data={
        "brand": "Maruti",
        "year": 2018,
        "present_price": 6.5,
        "kms_driven": 35000,
        "fuel_type": "Petrol",
        "seller_type": "Dealer",
        "transmission": "Manual",
        "owner": 0
    }, headers={"Authorization": f"Bearer {user_token}"})
    assert status == 200, f"Predict failed: {pred_data}"
    predicted_price = pred_data["predicted_price"]
    print(f"[OK] 7. Vehicle prediction executed: INR {predicted_price} Lakh (Audited and saved to database)")

    # 7b. User fetches own predictions history (/api/me/predictions)
    status, my_preds = make_req(f"{BASE_URL}/api/me/predictions", headers={"Authorization": f"Bearer {user_token}"})
    assert status == 200
    assert len(my_preds.get("items", [])) >= 1
    print(f"[OK] 7b. User fetched own predictions list ({len(my_preds['items'])} items found)")

    # 7c. Admin fetches all users' predictions history (/api/admin/predictions)
    status, admin_preds = make_req(f"{BASE_URL}/api/admin/predictions", headers={"Authorization": f"Bearer {admin_token}"})
    assert status == 200
    assert len(admin_preds.get("items", [])) >= 1
    print(f"[OK] 7c. Admin fetched all users' predictions list ({len(admin_preds['items'])} items found)")

    # 8. Regular user fetches /api/me/logs
    status, my_logs = make_req(f"{BASE_URL}/api/me/logs", headers={"Authorization": f"Bearer {user_token}"})
    assert status == 200
    assert len(my_logs) > 0
    actions = [l["action_type"] for l in my_logs]
    print(f"[OK] 8. User fetched own activity timeline: {actions}")

    # 9. Regular user blocked from Admin Logs (403)
    status, user_blocked = make_req(f"{BASE_URL}/api/admin/logs", headers={"Authorization": f"Bearer {user_token}"})
    assert status == 403
    print("[OK] 9. Regular user strictly blocked from Admin Logs endpoint (HTTP 403)")

    # 10. Admin fetches Dashboard Stats
    status, stats = make_req(f"{BASE_URL}/api/admin/stats", headers={"Authorization": f"Bearer {admin_token}"})
    assert status == 200
    print(f"[OK] 10. Admin fetched dashboard stats: Total Users={stats['total_users']}, Logs={stats['total_logs']}")

    # 11. Admin fetches and filters Audit Logs
    status, admin_logs = make_req(f"{BASE_URL}/api/admin/logs?limit=10", headers={"Authorization": f"Bearer {admin_token}"})
    assert status == 200
    assert admin_logs["total"] > 0
    print(f"[OK] 11. Admin retrieved paginated audit logs (Total: {admin_logs['total']} records)")

    # 12. Admin exports CSV
    status, csv_data = make_req(f"{BASE_URL}/api/admin/logs/export?format=csv", headers={"Authorization": f"Bearer {admin_token}"})
    assert status == 200
    assert "Timestamp (UTC)" in csv_data
    print("[OK] 12. Admin exported Audit Logs in CSV format (Logged in audit trail)")

    # 13. Admin exports JSON
    status, json_data = make_req(f"{BASE_URL}/api/admin/logs/export?format=json", headers={"Authorization": f"Bearer {admin_token}"})
    assert status == 200
    assert isinstance(json_data, list)
    print(f"[OK] 13. Admin exported Audit Logs in JSON format ({len(json_data)} records exported)")

    print("\nALL 13 END-TO-END VERIFICATION CHECKS PASSED SUCCESSFULLY!")

if __name__ == "__main__":
    run_tests()
