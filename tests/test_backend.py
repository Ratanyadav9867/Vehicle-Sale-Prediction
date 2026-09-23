"""
tests/test_backend.py
=====================
Comprehensive pytest suite for the Vehicle Sales Prediction FastAPI backend.

Tests:
  - Model loading
  - GET /api/health
  - GET /api/model-info
  - GET /api/options
  - POST /api/predict  (valid + all invalid cases)

Uses FastAPI TestClient with raise_server_exceptions=True.
Model is loaded explicitly via a session-scoped autouse fixture.
"""

import sys
from pathlib import Path

import pytest
from starlette.testclient import TestClient

# ── Make sure the project root is on sys.path ─────────────────────────────────
PROJECT_ROOT = Path(__file__).parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.main import app           # noqa: E402
from backend.model.loader import model_store  # noqa: E402


# ── Session fixture: load model once before all tests ─────────────────────────
@pytest.fixture(scope="session", autouse=True)
def load_model_for_tests():
    """Explicitly load the model before any test runs.

    TestClient does not trigger FastAPI lifespan events, so we replicate
    the startup behaviour here.
    """
    if not model_store.is_ready:
        model_store.load()
    yield


@pytest.fixture(scope="session")
def auth_headers():
    """Authenticated user headers for predict tests."""
    from backend.db.database import init_db
    init_db()
    res = client.post("/api/auth/login", json={
        "email": "admin@vehicleai.com",
        "password": "Admin@12345",
    })
    if res.status_code != 200:
        res = client.post("/api/auth/admin-login", json={
            "email": "admin@vehicleai.com",
            "password": "Admin@12345",
        })
    token = res.json()["token"]
    return {"Authorization": f"Bearer {token}"}


# ── Test Client ───────────────────────────────────────────────────────────────
client = TestClient(app, raise_server_exceptions=True)

# ── Valid baseline payload ────────────────────────────────────────────────────
VALID_PAYLOAD = {
    "brand": "Maruti",
    "year": 2018,
    "present_price": 6.5,
    "kms_driven": 25000,
    "fuel_type": "Petrol",
    "seller_type": "Dealer",
    "transmission": "Manual",
    "owner": 0,
}


# =============================================================================
# 1. Model Loading
# =============================================================================
class TestModelLoading:
    def test_model_store_is_ready(self):
        """Model must be loaded successfully before any endpoint test."""
        assert model_store.is_ready, (
            f"Model not ready. Error: {model_store.load_error}"
        )

    def test_pipeline_has_correct_steps(self):
        """Pipeline must have 'pre' (ColumnTransformer) and 'mdl' steps."""
        steps = list(model_store.pipeline.named_steps.keys())
        assert "pre" in steps, f"Missing 'pre' step. Got: {steps}"
        assert "mdl" in steps, f"Missing 'mdl' step. Got: {steps}"

    def test_metadata_has_required_keys(self):
        """Metadata JSON must contain all required keys."""
        required = {"model_name", "mae", "rmse", "r2", "feature_columns",
                    "training_rows", "testing_rows", "target",
                    "numerical_features", "categorical_features",
                    "available_categories"}
        missing = required - set(model_store.metadata.keys())
        assert not missing, f"Missing metadata keys: {missing}"

    def test_r2_is_positive(self):
        """R² must be positive (model has predictive power)."""
        assert model_store.metadata["r2"] > 0.5, (
            f"R² too low: {model_store.metadata['r2']}"
        )


# =============================================================================
# 2. GET /api/health
# =============================================================================
class TestHealth:
    def test_health_returns_200(self):
        resp = client.get("/api/health")
        assert resp.status_code == 200

    def test_health_status_ok(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert data["status"] == "ok"

    def test_health_model_loaded_true(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert data["model_loaded"] is True

    def test_health_returns_model_name(self):
        resp = client.get("/api/health")
        data = resp.json()
        assert data["model_name"] is not None
        assert len(data["model_name"]) > 0


# =============================================================================
# 3. GET /api/model-info
# =============================================================================
class TestModelInfo:
    def test_model_info_returns_200(self):
        resp = client.get("/api/model-info")
        assert resp.status_code == 200

    def test_model_info_has_metrics(self):
        resp = client.get("/api/model-info")
        data = resp.json()
        assert "mae" in data
        assert "rmse" in data
        assert "r2" in data

    def test_metrics_are_numeric(self):
        resp = client.get("/api/model-info")
        data = resp.json()
        assert isinstance(data["mae"],  float)
        assert isinstance(data["rmse"], float)
        assert isinstance(data["r2"],   float)

    def test_r2_greater_than_zero_point_five(self):
        resp = client.get("/api/model-info")
        assert resp.json()["r2"] > 0.5

    def test_model_info_has_feature_columns(self):
        resp = client.get("/api/model-info")
        data = resp.json()
        assert "feature_columns" in data
        assert len(data["feature_columns"]) > 0

    def test_model_info_has_training_testing_rows(self):
        resp = client.get("/api/model-info")
        data = resp.json()
        assert data["training_rows"] > 0
        assert data["testing_rows"] > 0

    def test_target_is_selling_price(self):
        resp = client.get("/api/model-info")
        assert resp.json()["target"] == "Selling_Price"


# =============================================================================
# 4. GET /api/options
# =============================================================================
class TestOptions:
    def test_options_returns_200(self):
        resp = client.get("/api/options")
        assert resp.status_code == 200

    def test_fuel_types_present(self):
        resp = client.get("/api/options")
        data = resp.json()
        assert "fuel_types" in data
        assert len(data["fuel_types"]) >= 2

    def test_seller_types_present(self):
        resp = client.get("/api/options")
        data = resp.json()
        assert "seller_types" in data
        assert "Dealer" in data["seller_types"]
        assert "Individual" in data["seller_types"]

    def test_transmission_types_present(self):
        resp = client.get("/api/options")
        data = resp.json()
        assert "transmission_types" in data
        assert "Manual" in data["transmission_types"]
        assert "Automatic" in data["transmission_types"]

    def test_owner_options_present(self):
        resp = client.get("/api/options")
        data = resp.json()
        assert "owner_options" in data
        assert 0 in data["owner_options"]

    def test_year_range_valid(self):
        resp = client.get("/api/options")
        data = resp.json()
        assert data["year_min"] <= 2000
        assert data["year_max"] >= 2024


# =============================================================================
# 5. POST /api/predict — Authentication Enforcement
# =============================================================================
class TestPredictAuthEnforcement:
    def test_unauthenticated_predict_returns_401(self):
        """Unauthenticated request to POST /api/predict must be strictly rejected with 401."""
        resp = client.post("/api/predict", json=VALID_PAYLOAD)
        assert resp.status_code == 401, f"Expected 401 for unauthenticated request, got {resp.status_code}"
        assert "Authentication required" in resp.text or "detail" in resp.text

    def test_invalid_token_returns_401(self):
        """Invalid bearer token must be rejected with 401."""
        resp = client.post("/api/predict", json=VALID_PAYLOAD, headers={"Authorization": "Bearer invalid-token-xyz"})
        assert resp.status_code == 401


# =============================================================================
# 6. POST /api/predict — Valid cases
# =============================================================================
class TestPredictValid:
    def test_predict_returns_200(self, auth_headers):
        resp = client.post("/api/predict", json=VALID_PAYLOAD, headers=auth_headers)
        assert resp.status_code == 200, resp.text

    def test_predict_has_predicted_price(self, auth_headers):
        resp = client.post("/api/predict", json=VALID_PAYLOAD, headers=auth_headers)
        data = resp.json()
        assert "predicted_price" in data

    def test_predict_price_is_positive(self, auth_headers):
        resp = client.post("/api/predict", json=VALID_PAYLOAD, headers=auth_headers)
        assert resp.json()["predicted_price"] > 0

    def test_predict_price_is_float(self, auth_headers):
        resp = client.post("/api/predict", json=VALID_PAYLOAD, headers=auth_headers)
        assert isinstance(resp.json()["predicted_price"], float)

    def test_predict_currency_is_lakh(self, auth_headers):
        resp = client.post("/api/predict", json=VALID_PAYLOAD, headers=auth_headers)
        assert resp.json()["currency"] == "lakh"

    def test_predict_car_age_is_correct(self, auth_headers):
        from backend.utils.helpers import current_year
        resp = client.post("/api/predict", json=VALID_PAYLOAD, headers=auth_headers)
        expected_age = current_year() - VALID_PAYLOAD["year"]
        assert resp.json()["car_age"] == expected_age

    def test_predict_returns_model_name(self, auth_headers):
        resp = client.post("/api/predict", json=VALID_PAYLOAD, headers=auth_headers)
        data = resp.json()
        assert "model" in data
        assert len(data["model"]) > 0

    def test_predict_diesel_automatic(self, auth_headers):
        """Different valid combination should also work."""
        payload = {**VALID_PAYLOAD, "fuel_type": "Diesel", "transmission": "Automatic"}
        resp = client.post("/api/predict", json=payload, headers=auth_headers)
        assert resp.status_code == 200
        assert resp.json()["predicted_price"] > 0

    def test_predict_price_in_reasonable_range(self, auth_headers):
        """Predicted price should be within a sane range for used cars (0.1–50 Lakh)."""
        resp = client.post("/api/predict", json=VALID_PAYLOAD, headers=auth_headers)
        price = resp.json()["predicted_price"]
        assert 0.1 <= price <= 50.0, f"Price out of range: {price}"

    def test_predict_older_car_lower_price(self, auth_headers):
        """An older car should generally be cheaper than a newer one (same other inputs)."""
        newer = {**VALID_PAYLOAD, "year": 2018}
        older = {**VALID_PAYLOAD, "year": 2008}
        r_new = client.post("/api/predict", json=newer, headers=auth_headers)
        r_old = client.post("/api/predict", json=older, headers=auth_headers)
        assert r_new.json()["predicted_price"] >= r_old.json()["predicted_price"]


# =============================================================================
# 7. POST /api/predict — Invalid / edge cases
# =============================================================================
class TestPredictInvalid:
    def test_invalid_year_future(self, auth_headers):
        """Year in the future should be rejected."""
        payload = {**VALID_PAYLOAD, "year": 2099}
        resp = client.post("/api/predict", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_invalid_year_too_old(self, auth_headers):
        """Year before 1990 should be rejected."""
        payload = {**VALID_PAYLOAD, "year": 1950}
        resp = client.post("/api/predict", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_negative_kms_driven(self, auth_headers):
        """Negative kilometres should be rejected."""
        payload = {**VALID_PAYLOAD, "kms_driven": -1000}
        resp = client.post("/api/predict", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_negative_present_price(self, auth_headers):
        """Negative or zero present_price should be rejected."""
        payload = {**VALID_PAYLOAD, "present_price": -5.0}
        resp = client.post("/api/predict", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_zero_present_price(self, auth_headers):
        """Zero present_price should be rejected (gt=0)."""
        payload = {**VALID_PAYLOAD, "present_price": 0.0}
        resp = client.post("/api/predict", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_invalid_fuel_type(self, auth_headers):
        """Invalid fuel type should be rejected."""
        payload = {**VALID_PAYLOAD, "fuel_type": "Electric"}
        resp = client.post("/api/predict", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_invalid_seller_type(self, auth_headers):
        """Invalid seller type should be rejected."""
        payload = {**VALID_PAYLOAD, "seller_type": "Online"}
        resp = client.post("/api/predict", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_invalid_transmission(self, auth_headers):
        """Invalid transmission should be rejected."""
        payload = {**VALID_PAYLOAD, "transmission": "Semi-Auto"}
        resp = client.post("/api/predict", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_owner_out_of_range(self, auth_headers):
        """Owner > 3 should be rejected."""
        payload = {**VALID_PAYLOAD, "owner": 5}
        resp = client.post("/api/predict", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_missing_required_field(self, auth_headers):
        """Missing required field (year) should return 422."""
        payload = {k: v for k, v in VALID_PAYLOAD.items() if k != "year"}
        resp = client.post("/api/predict", json=payload, headers=auth_headers)
        assert resp.status_code == 422

    def test_empty_body(self, auth_headers):
        """Empty body should return 422."""
        resp = client.post("/api/predict", json={}, headers=auth_headers)
        assert resp.status_code == 422

    def test_error_response_has_detail(self, auth_headers):
        """Validation errors must include a 'detail' field for the UI."""
        payload = {**VALID_PAYLOAD, "year": 1800}
        resp = client.post("/api/predict", json=payload, headers=auth_headers)
        assert resp.status_code == 422
        data = resp.json()
        assert "detail" in data
