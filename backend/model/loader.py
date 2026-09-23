"""
backend/model/loader.py
=======================
Responsible for loading the production pipeline (pkl) and model metadata (json)
exactly once at application startup.

SECURITY CONTROLS:
- Cryptographic SHA-256 integrity verification before deserialization to
  prevent untrusted pickle execution / artifact substitution attacks.
- Strict path confinement to local trusted ML artifact directory.
"""

import hashlib
import json
import logging
import os
from pathlib import Path
from typing import Any

import joblib

logger = logging.getLogger(__name__)

# ── Resolve paths from this file's location ───────────────────────────────────
_BACKEND_DIR = Path(__file__).parent.parent          # backend/
_PROJECT_DIR = _BACKEND_DIR.parent                   # project root
_MODEL_PATH = _PROJECT_DIR / "ml" / "models" / "car_price_model.pkl"
_SHA_PATH = _PROJECT_DIR / "ml" / "models" / "car_price_model.pkl.sha256"
_META_PATH = _PROJECT_DIR / "ml" / "artifacts" / "model_metadata.json"

# Known trusted SHA-256 checksum of the production trained artifact
TRUSTED_MODEL_SHA256 = os.getenv(
    "MODEL_SHA256",
    "9565f5859a3ced3f26100ad3630f8a9d0396e9ec3247568afbddbba88ff62bff",
)


class ModelIntegrityError(RuntimeError):
    """Raised when an ML model artifact fails cryptographic checksum verification."""
    pass


class ModelStore:
    """Singleton-style container for the loaded pipeline and metadata."""

    def __init__(self) -> None:
        self.pipeline: Any = None
        self.metadata: dict = {}
        self.is_ready: bool = False
        self.load_error: str = ""

    def load(self, verify_checksum: bool = True, expected_sha256: Any = None) -> None:
        """Load pipeline + metadata from disk with cryptographic checksum verification."""
        try:
            if not _MODEL_PATH.exists():
                raise FileNotFoundError(f"Model file not found at {_MODEL_PATH}")

            # 1. Cryptographic integrity check (Defense against malicious pickle substitution)
            if verify_checksum:
                expected_sha = expected_sha256 or os.getenv("MODEL_SHA256")
                if not expected_sha and _SHA_PATH.exists():
                    try:
                        content = _SHA_PATH.read_text(encoding="utf-8").strip()
                        expected_sha = content.split()[0]
                    except Exception as e:
                        logger.warning("Could not read sha256 checksum file: %s", e)
                expected_sha = expected_sha or TRUSTED_MODEL_SHA256

                model_bytes = _MODEL_PATH.read_bytes()
                computed_sha = hashlib.sha256(model_bytes).hexdigest()

                if computed_sha.lower() != expected_sha.lower():
                    err_msg = (
                        f"CRITICAL SECURITY ALERT: Model checksum mismatch! "
                        f"Expected {expected_sha}, computed {computed_sha}. Deserialization blocked."
                    )
                    logger.critical(err_msg)
                    raise ModelIntegrityError(err_msg)
                logger.info("Model integrity verified (SHA-256: %s)", computed_sha)

            logger.info("Loading verified pipeline from %s", _MODEL_PATH)
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
        except ModelIntegrityError as exc:
            self.load_error = str(exc)
            logger.error(self.load_error)
        except Exception as exc:  # noqa: BLE001
            self.load_error = f"Failed to load model: {exc}"
            logger.exception(self.load_error)


# Module-level singleton — imported by services and routes
model_store = ModelStore()
