"""
backend/services/predictor.py
==============================
Prediction service.

Responsibility:
  1. Accept a validated PredictRequest
  2. Compute Car_Age dynamically
  3. Build a one-row DataFrame with the exact column order the pipeline expects
  4. Call pipeline.predict() — no separate preprocessing
  5. Return a PredictResponse

The pipeline (ColumnTransformer + GradientBoostingRegressor) handles
all feature transformation internally, so we only need to pass raw inputs.
"""

import logging

import numpy as np
import pandas as pd

from backend.model.loader import model_store
from backend.schemas.prediction import PredictRequest, PredictResponse
from backend.utils.helpers import calculate_car_age, round_price

logger = logging.getLogger(__name__)

# Feature column order as stored in model_metadata.json
# ['Present_Price', 'Kms_Driven', 'Fuel_Type', 'Seller_Type',
#  'Transmission', 'Owner', 'Car_Age']
_FEATURE_COLUMNS: list[str] = []   # populated lazily from metadata


def _get_feature_columns() -> list[str]:
    """Return the exact feature column order from metadata (lazy init)."""
    global _FEATURE_COLUMNS
    if not _FEATURE_COLUMNS:
        _FEATURE_COLUMNS = model_store.metadata.get("feature_columns", [])
    return _FEATURE_COLUMNS


def predict(request: PredictRequest) -> PredictResponse:
    """
    Run inference using the production pipeline.

    Raises:
        RuntimeError: if the model is not loaded.
        ValueError: if prediction produces an invalid value.
    """
    if not model_store.is_ready:
        raise RuntimeError(
            f"Model is not ready. Load error: {model_store.load_error}"
        )

    car_age = calculate_car_age(request.year)
    feature_cols = _get_feature_columns()

    # Build the input row as a dict keyed by training column names
    raw_input = {
        "Present_Price": request.present_price,
        "Kms_Driven":    request.kms_driven,
        "Fuel_Type":     request.fuel_type,
        "Seller_Type":   request.seller_type,
        "Transmission":  request.transmission,
        "Owner":         request.owner,
        "Car_Age":       car_age,
    }

    # Construct DataFrame in the exact column order the pipeline was trained on
    if feature_cols:
        df_input = pd.DataFrame([{col: raw_input[col] for col in feature_cols}])
    else:
        # Fallback: use canonical order
        df_input = pd.DataFrame([raw_input])

    logger.debug("Input DataFrame:\n%s", df_input.to_string())

    # ── Inference — pipeline handles all preprocessing internally ─────────────
    prediction = model_store.pipeline.predict(df_input)
    price = float(prediction[0])

    if price < 0:
        logger.warning("Negative prediction %.4f — clamped to 0.01", price)
        price = 0.01

    logger.info(
        "Prediction: %.4f Lakh INR | Car_Age=%d | present_price=%.2f",
        price, car_age, request.present_price,
    )

    return PredictResponse(
        predicted_price=round_price(price),
        currency="lakh",
        model=model_store.metadata.get("model_name", "Unknown"),
        car_age=car_age,
        present_price=request.present_price,
        fuel_type=request.fuel_type,
        transmission=request.transmission,
    )
