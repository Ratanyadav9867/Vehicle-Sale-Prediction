"""
tests/test_scalability.py
=========================
Verification tests for Part 2 Scalability additions:
- GET /healthz (Liveness)
- GET /readyz (Readiness)
- GET /metrics (Prometheus)
- POST /api/logs/batch (Batch client logging)
- Prediction caching and rate limiting
"""

import pytest
from starlette.testclient import TestClient

from backend.main import app
from backend.model.loader import model_store
from backend.db.database import get_user_by_email, create_session, init_db, get_connection

@pytest.fixture(scope="session", autouse=True)
def setup_test_environment():
    init_db()
    if not model_store.is_ready:
        model_store.load()

client = TestClient(app)


def test_healthz_liveness():
    res = client.get("/healthz")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ok"
    assert "timestamp" in data


def test_readyz_readiness():
    res = client.get("/readyz")
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"
    assert data["model"] == "loaded"


def test_prometheus_metrics():
    res = client.get("/metrics")
    assert res.status_code == 200
    text = res.text
    assert "car_worth_http_requests_total" in text
    assert "car_worth_cache_hits_total" in text


def test_batch_logs_endpoint():
    res = client.post("/api/logs/batch", json={
        "events": [
            {
                "action_type": "page_view",
                "category": "navigation",
                "description": "User navigated to /analytics",
                "metadata": {"path": "/analytics"}
            },
            {
                "action_type": "button_click",
                "category": "ui",
                "description": "User clicked explore button",
                "metadata": {"button_id": "explore-btn"}
            }
        ]
    })
    assert res.status_code == 201
    data = res.json()
    assert data["status"] == "recorded"
    assert data["count"] == 2


def test_cached_prediction_flow():
    # Login admin user to get auth token
    with get_connection() as conn:
        row = conn.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1;").fetchone()
    assert row is not None, "Admin user must exist"
    token = create_session(row["id"])
    headers = {"Authorization": f"Bearer {token}"}

    payload = {
        "brand": "Swift",
        "year": 2018,
        "present_price": 7.5,
        "kms_driven": 25000,
        "fuel_type": "Petrol",
        "seller_type": "Dealer",
        "transmission": "Manual",
        "owner": 0,
    }

    # First request: Cache miss -> compute
    res1 = client.post("/api/predict", json=payload, headers=headers)
    assert res1.status_code == 200
    val1 = res1.json()["predicted_price"]

    # Second request: Cache hit -> should return matching valuation instantly
    res2 = client.post("/api/predict", json=payload, headers=headers)
    assert res2.status_code == 200
    val2 = res2.json()["predicted_price"]
    assert val1 == val2
