"""
Unit tests for backend.services.predictor and prediction business logic.
Verifies inference correctness, feature derivations, boundary checks, and monotonic behaviors.
"""
import pytest
from backend.schemas.prediction import PredictRequest
from backend.services.predictor import predict
from backend.model.loader import model_store


@pytest.fixture(scope="module", autouse=True)
def ensure_model_loaded():
    if not model_store.is_ready:
        model_store.load()
    assert model_store.is_ready, f"Model must be loaded for tests: {model_store.load_error}"


class TestPredictorService:
    def test_predict_standard_car(self):
        req = PredictRequest(
            brand="Maruti",
            year=2018,
            present_price=6.5,
            kms_driven=35000,
            fuel_type="Petrol",
            seller_type="Dealer",
            transmission="Manual",
            owner=0,
        )
        res = predict(req)
        assert res.predicted_price > 0.0
        assert res.currency == "lakh"
        assert res.car_age >= 0
        assert res.fuel_type == "Petrol"
        assert res.transmission == "Manual"

    def test_price_monotonicity_with_present_price(self):
        """A car with higher showroom price should predict higher or equal resale price."""
        cheap = PredictRequest(
            brand="Hyundai",
            year=2017,
            present_price=4.0,
            kms_driven=30000,
            fuel_type="Petrol",
            seller_type="Dealer",
            transmission="Manual",
            owner=0,
        )
        expensive = PredictRequest(
            brand="Hyundai",
            year=2017,
            present_price=12.0,
            kms_driven=30000,
            fuel_type="Petrol",
            seller_type="Dealer",
            transmission="Manual",
            owner=0,
        )
        res_cheap = predict(cheap)
        res_expensive = predict(expensive)
        assert res_expensive.predicted_price > res_cheap.predicted_price

    def test_depreciation_with_age(self):
        """A newer car should retain higher value than an older one."""
        newer = PredictRequest(
            brand="Toyota",
            year=2022,
            present_price=10.0,
            kms_driven=20000,
            fuel_type="Diesel",
            seller_type="Dealer",
            transmission="Automatic",
            owner=0,
        )
        older = PredictRequest(
            brand="Toyota",
            year=2010,
            present_price=10.0,
            kms_driven=20000,
            fuel_type="Diesel",
            seller_type="Dealer",
            transmission="Automatic",
            owner=0,
        )
        res_newer = predict(newer)
        res_older = predict(older)
        assert res_newer.predicted_price > res_older.predicted_price

    def test_all_fuel_types(self):
        for fuel in ["Petrol", "Diesel", "Cng"]:
            req = PredictRequest(
                brand="Maruti",
                year=2016,
                present_price=5.0,
                kms_driven=40000,
                fuel_type=fuel,
                seller_type="Dealer",
                transmission="Manual",
                owner=0,
            )
            res = predict(req)
            assert res.predicted_price > 0.0

    def test_transmissions(self):
        for trans in ["Manual", "Automatic"]:
            req = PredictRequest(
                brand="Honda",
                year=2019,
                present_price=8.0,
                kms_driven=25000,
                fuel_type="Petrol",
                seller_type="Dealer",
                transmission=trans,
                owner=0,
            )
            res = predict(req)
            assert res.predicted_price > 0.0

    def test_seller_types(self):
        for seller in ["Dealer", "Individual"]:
            req = PredictRequest(
                brand="Ford",
                year=2015,
                present_price=7.0,
                kms_driven=50000,
                fuel_type="Diesel",
                seller_type=seller,
                transmission="Manual",
                owner=1,
            )
            res = predict(req)
            assert res.predicted_price > 0.0

    def test_prediction_never_negative(self):
        """Even for extreme depreciation cases, price must be floored >= 0.01."""
        req = PredictRequest(
            brand="Maruti",
            year=2003,
            present_price=0.5,
            kms_driven=400000,
            fuel_type="Petrol",
            seller_type="Individual",
            transmission="Manual",
            owner=3,
        )
        res = predict(req)
        assert res.predicted_price >= 0.01
