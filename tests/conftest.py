"""
tests/conftest.py
=================
Pytest configuration and session fixtures.
Ensures standard test admin exists in database regardless of local .env settings.
"""

import pytest
from backend.db.database import init_db, get_connection, hash_password


@pytest.fixture(scope="session", autouse=True)
def ensure_test_admin():
    """Ensure admin@vehicleai.com with password Admin@12345 exists for test suite."""
    init_db()
    with get_connection() as conn:
        user = conn.execute("SELECT id FROM users WHERE email = 'admin@vehicleai.com';").fetchone()
        if not user:
            pwd_hash, salt = hash_password("Admin@12345")
            now = "2026-01-01T00:00:00+00:00"
            conn.execute(
                """
                INSERT INTO users (name, email, password_hash, salt, role, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?);
                """,
                ("Test Admin", "admin@vehicleai.com", pwd_hash, salt, now, now),
            )
            conn.commit()
    yield
