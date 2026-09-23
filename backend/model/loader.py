"""
backend/model/loader.py
=======================
Responsible for loading the production pipeline (pkl) and model metadata (json)
exactly once at application startup.

The pipeline is a sklearn.pipeline.Pipeline with two named steps:
  - "pre"  : ColumnTransformer  (StandardScaler + OneHotEncoder)
  - "mdl"  : GradientBoostingRegressor (tuned)

No retraining or preprocessing duplication happens here.
"""

import json
import logging
from pathlib import Path
from typing import Any

import joblib

logger = logging.getLogger(__name__)

# ── Resolve paths from this file's location ───────────────────────────────────
# backend/model/loader.py  →  go up two levels  →  project root  →  ml/
_BACKEND_DIR  = Path(__file__).parent.parent          # backend/
_PROJECT_DIR  = _BACKEND_DIR.parent                   # project root
_MODEL_PATH   = _PROJECT_DIR / "ml" / "models" / "car_price_model.pkl"
_META_PATH    = _PROJECT_DIR / "ml" / "artifacts" / "model_metadata.json"


class ModelStore:
    """Singleton-style container for the loaded pipeline and metadata."""

    def __init__(self) -> None:
        self.pipeline: Any = None
        self.metadata: dict = {}
        self.is_ready: bool = False
        self.load_error: str = ""

    def load(self) -> None:
        """Load pipeline + metadata from disk.  Called once at app startup."""
        try:
            logger.info("Loading pipeline from %s", _MODEL_PATH)
            self.pipeline = joblib.load(_MODEL_PATH)
            logger.info("Pipeline loaded: %s", type(self.pipeline).__name__)

            logger.info("Loading metadata from %s", _META_PATH)
            with open(_META_PATH, "r", encoding="utf-8") as fh:
                self.metadata = json.load(fh)
            logger.info("Metadata loaded — model: %s", self.metadata.get("model_name"))

            self.is_ready = True
            self.load_error = ""

        except FileNotFoundError as exc:
            self.load_error = f"Model file not found: {exc}"
            logger.error(self.load_error)
        except Exception as exc:                        # noqa: BLE001
            self.load_error = f"Failed to load model: {exc}"
            logger.exception(self.load_error)


# Module-level singleton — imported by services and routes
model_store = ModelStore()
