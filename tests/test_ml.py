"""
Tests for ML artifact integrity, pipeline components, and performance sanity checks.
Ensures model artifact reproducibility and compliance with project specs.
"""
from pathlib import Path
import json
import joblib
import numpy as np
import pandas as pd
import pytest
from sklearn.pipeline import Pipeline
from sklearn.compose import ColumnTransformer

PROJECT_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = PROJECT_ROOT / "ml" / "models" / "car_price_model.pkl"
META_PATH = PROJECT_ROOT / "ml" / "artifacts" / "model_metadata.json"
DATA_PATH = PROJECT_ROOT / "ml" / "data" / "car data.csv"


class TestMLArtifacts:
    def test_model_file_exists(self):
        assert MODEL_PATH.is_file(), f"Model artifact missing at {MODEL_PATH}"
        assert MODEL_PATH.stat().st_size > 10_000, "Model file seems too small"

    def test_metadata_file_exists(self):
        assert META_PATH.is_file(), f"Metadata missing at {META_PATH}"

    def test_model_can_be_loaded(self):
        pipeline = joblib.load(MODEL_PATH)
        assert isinstance(pipeline, Pipeline), "Saved artifact must be a scikit-learn Pipeline"
        assert "pre" in pipeline.named_steps, "Pipeline must contain 'pre' ColumnTransformer"
        assert "mdl" in pipeline.named_steps, "Pipeline must contain 'mdl' estimator"

    def test_preprocessor_structure(self):
        pipeline = joblib.load(MODEL_PATH)
        prep = pipeline.named_steps["pre"]
        assert isinstance(prep, ColumnTransformer), "'pre' step must be a ColumnTransformer"
        transformer_names = [name for name, _, _ in prep.transformers]
        assert "num" in transformer_names, "ColumnTransformer must have 'num' transformer"
        assert "cat" in transformer_names, "ColumnTransformer must have 'cat' transformer"

    def test_metadata_metrics(self):
        with open(META_PATH, "r", encoding="utf-8") as f:
            meta = json.load(f)

        assert meta["r2"] >= 0.90, f"R² should exceed 0.90, got {meta['r2']}"
        assert meta["mae"] <= 0.60, f"MAE should be under 0.60 Lakh, got {meta['mae']}"
        assert meta["rmse"] <= 1.00, f"RMSE should be under 1.00 Lakh, got {meta['rmse']}"
        assert meta["training_rows"] > 200
        assert meta["testing_rows"] > 40

    def test_dataset_exists_and_valid(self):
        assert DATA_PATH.is_file(), f"Dataset file missing at {DATA_PATH}"
        df = pd.read_csv(DATA_PATH)
        assert len(df) == 301, f"Expected 301 rows in original CarDekho data, got {len(df)}"
        expected_cols = {
            "Car_Name", "Year", "Selling_Price", "Present_Price",
            "Kms_Driven", "Fuel_Type", "Seller_Type", "Transmission", "Owner"
        }
        assert expected_cols.issubset(set(df.columns)), "Dataset missing required columns"

    def test_batch_inference_consistency(self):
        pipeline = joblib.load(MODEL_PATH)
        batch = pd.DataFrame([
            {
                "Present_Price": 5.59,
                "Kms_Driven": 27000,
                "Fuel_Type": "Petrol",
                "Seller_Type": "Dealer",
                "Transmission": "Manual",
                "Owner": 0,
                "Car_Age": 8,
            },
            {
                "Present_Price": 9.54,
                "Kms_Driven": 43000,
                "Fuel_Type": "Diesel",
                "Seller_Type": "Dealer",
                "Transmission": "Manual",
                "Owner": 0,
                "Car_Age": 9,
            },
        ])
        preds = pipeline.predict(batch)
        assert len(preds) == 2
        assert all(np.isfinite(preds)), "All predictions must be finite numbers"
        assert all(p > 0 for p in preds), "Predictions must be positive"
