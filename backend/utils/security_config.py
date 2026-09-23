"""
backend/utils/security_config.py
================================
Production security startup configuration and secret validation.
Enforces OWASP ASVS 5.0 requirements for secret management and configuration integrity.
"""

import logging
import os
import re
from typing import List

logger = logging.getLogger(__name__)

WEAK_SECRET_PATTERNS = [
    "changeme",
    "changeme123",
    "password",
    "admin",
    "secret",
    "replace-me",
    "replace_me",
    "set_in_secret_manager",
    "default",
    "carpass",
    "123456",
    "12345678",
]


def is_obviously_weak(value: str) -> bool:
    """Return True if secret value is blank, placeholder, or obviously weak."""
    if not value or not value.strip():
        return True
    val_clean = re.sub(r"[^a-zA-Z0-9]", "", value.strip().lower())
    for weak in WEAK_SECRET_PATTERNS:
        clean_weak = re.sub(r"[^a-zA-Z0-9]", "", weak)
        if clean_weak == val_clean or clean_weak in val_clean:
            return True
    return False


def validate_production_secrets() -> None:
    """
    Validate environment configuration upon application startup.
    When ENVIRONMENT=production, abort immediately if any critical security setting
    is missing, blank, or dangerously weak.
    """
    env = os.getenv("ENVIRONMENT", "development").strip().lower()
    if env != "production":
        return

    errors: List[str] = []

    # 1. JWT_SECRET check
    jwt_secret = os.getenv("JWT_SECRET", "").strip()
    if not jwt_secret:
        errors.append("JWT_SECRET environment variable is missing or empty.")
    elif len(jwt_secret) < 32:
        errors.append(f"JWT_SECRET is insufficiently strong ({len(jwt_secret)} chars; min 32 required).")
    elif is_obviously_weak(jwt_secret):
        errors.append("JWT_SECRET contains an insecure default or placeholder value.")

    # 2. ADMIN_PASSWORD check (if provided or initial seed required)
    admin_password = os.getenv("ADMIN_PASSWORD", "").strip()
    if admin_password and is_obviously_weak(admin_password):
        errors.append("ADMIN_PASSWORD contains an insecure default or placeholder value.")

    # 3. DATABASE_URL check (reject fallback carpass or plain changeme)
    db_url = os.getenv("DATABASE_URL", "").strip()
    if db_url and is_obviously_weak(db_url):
        errors.append("DATABASE_URL contains an insecure default or placeholder password.")

    # 4. Insecure debug check
    debug = os.getenv("DEBUG", "false").strip().lower()
    if debug in ("true", "1", "yes", "on"):
        errors.append("DEBUG mode must not be enabled when ENVIRONMENT=production.")

    # 5. Insecure cookie settings check
    cookie_secure = os.getenv("COOKIE_SECURE", "true").strip().lower()
    if cookie_secure in ("false", "0", "no", "off"):
        errors.append("COOKIE_SECURE must not be disabled when ENVIRONMENT=production.")

    # 6. Wildcard credentialed CORS check
    raw_origins = os.getenv("ALLOWED_ORIGINS", "").strip()
    if "*" in [o.strip() for o in raw_origins.split(",")]:
        errors.append("Wildcard '*' in ALLOWED_ORIGINS is strictly prohibited in production.")

    # 7. POSTGRES_PASSWORD check (if set directly in environment)
    postgres_password = os.getenv("POSTGRES_PASSWORD", "").strip()
    if postgres_password and is_obviously_weak(postgres_password):
        errors.append("POSTGRES_PASSWORD contains an insecure default or placeholder value.")

    if errors:
        error_msg = (
            "FATAL PRODUCTION SECURITY ERROR: Application refused to start due to "
            "insecure configuration:\n - " + "\n - ".join(errors)
        )
        logger.critical(error_msg)
        raise RuntimeError(error_msg)

    logger.info("[SECURITY] Production security configuration validated successfully.")
