"""
tests/test_database_production.py
==================================
Regression tests for Production Database Architecture:
  1. Idempotent initialization across multiple sequential and concurrent executions
  2. Multi-worker safe startup with zero UNIQUE constraint crashes
  3. Automatic PostgreSQL selection when DATABASE_URL is provided
  4. Strict rejection of SQLite fallback when ENVIRONMENT=production
  5. URL normalization (postgres:// -> postgresql://)
  6. Transparent SQL adaptation (? -> %s, LIKE -> ILIKE, RETURNING id)
"""

import concurrent.futures
import os
import pytest
from backend.db.database import (
    _adapt_sql_for_postgres,
    create_user,
    get_connection,
    get_database_type,
    get_database_url,
    get_user_by_email,
    init_db,
)
from backend.utils.security_config import validate_production_secrets


def test_init_db_repeated_runs_idempotent():
    """Verify that calling init_db repeatedly does not cause UNIQUE constraint errors."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin';")
        initial_admin_count = cursor.fetchone()[0]

    for _ in range(5):
        init_db()

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin';")
        final_admin_count = cursor.fetchone()[0]
        assert final_admin_count == initial_admin_count, "Administrator account count must remain strictly constant after multiple init_db runs"


def test_concurrent_multiworker_startup_safety():
    """Simulate 10 concurrent Gunicorn workers running init_db simultaneously."""
    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin';")
        initial_admin_count = cursor.fetchone()[0]

    errors = []

    def worker_task(worker_id: int):
        try:
            init_db()
            return True
        except Exception as e:
            errors.append(f"Worker {worker_id} failed: {e}")
            return False

    with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(worker_task, i) for i in range(10)]
        results = [f.result() for f in futures]

    assert len(errors) == 0, f"Concurrent init_db produced errors: {errors}"
    assert all(results), "All concurrent worker init_db calls must succeed"

    with get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM users WHERE role = 'admin';")
        final_admin_count = cursor.fetchone()[0]
        assert final_admin_count == initial_admin_count, "Concurrent worker init must not produce duplicate admin records"


def test_database_type_selection_with_postgres_url(monkeypatch):
    """Test that PostgreSQL is selected when DATABASE_URL is configured."""
    monkeypatch.setenv("DATABASE_URL", "postgresql://user:secret123456789@postgres.railway.internal:5432/railway")
    monkeypatch.setenv("ENVIRONMENT", "production")

    assert get_database_type() == "postgres"
    assert get_database_url() == "postgresql://user:secret123456789@postgres.railway.internal:5432/railway"


def test_database_url_normalization_postgres_prefix(monkeypatch):
    """Test that postgres:// is normalized to postgresql:// as required by SQLAlchemy and drivers."""
    monkeypatch.setenv("DATABASE_URL", "postgres://user:secret123456789@postgres.railway.internal:5432/railway")
    monkeypatch.setenv("ENVIRONMENT", "production")

    assert get_database_type() == "postgres"
    assert get_database_url() == "postgresql://user:secret123456789@postgres.railway.internal:5432/railway"


def test_sqlite_fallback_strictly_rejected_in_production(monkeypatch):
    """Production must fail fast and refuse to silently fall back to SQLite when DATABASE_URL is missing."""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "production")

    with pytest.raises(RuntimeError) as exc_info:
        get_database_type()
    assert "DATABASE_URL" in str(exc_info.value)
    assert "SQLite fallback is strictly prohibited" in str(exc_info.value)

    monkeypatch.setenv("JWT_SECRET", "super-secret-random-jwt-key-minimum-32-chars-long!")
    with pytest.raises(RuntimeError) as exc_info_val:
        validate_production_secrets()
    assert "DATABASE_URL" in str(exc_info_val.value)


def test_sqlite_url_rejected_in_production(monkeypatch):
    """Production must reject an explicit SQLite connection string."""
    monkeypatch.setenv("DATABASE_URL", "sqlite:///app.db")
    monkeypatch.setenv("ENVIRONMENT", "production")

    with pytest.raises(RuntimeError) as exc_info:
        get_database_type()
    assert "must be a PostgreSQL connection in production, not SQLite" in str(exc_info.value)

    monkeypatch.setenv("JWT_SECRET", "super-secret-random-jwt-key-minimum-32-chars-long!")
    with pytest.raises(RuntimeError) as exc_info_val:
        validate_production_secrets()
    assert "must be a PostgreSQL connection in production" in str(exc_info_val.value)


def test_sqlite_allowed_in_development(monkeypatch):
    """Development environment defaults cleanly to SQLite when DATABASE_URL is not set."""
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("ENVIRONMENT", "development")

    assert get_database_type() == "sqlite"


def test_sql_adapter_parameter_and_returning_translation():
    """Verify query translation for PostgreSQL driver compatibility."""
    # 1. Parameter placeholder replacement: ? -> %s
    sql = "SELECT id, name FROM users WHERE email = ? AND status = ?;"
    adapted, has_ret = _adapt_sql_for_postgres(sql)
    assert adapted == "SELECT id, name FROM users WHERE email = %s AND status = %s;"
    assert not has_ret

    # 2. Case-insensitive search: LIKE -> ILIKE
    search_sql = "SELECT * FROM activity_logs WHERE description LIKE ?;"
    adapted, _ = _adapt_sql_for_postgres(search_sql)
    assert "ILIKE" in adapted
    assert "%s" in adapted

    # 3. Transparent RETURNING id injection for inserts with auto-increment ID
    insert_sql = "INSERT INTO users (name, email) VALUES (?, ?);"
    adapted, has_ret = _adapt_sql_for_postgres(insert_sql)
    assert "RETURNING id;" in adapted
    assert has_ret

    # 4. Do not double-append if RETURNING is already present
    insert_ret = "INSERT INTO users (name, email) VALUES (?, ?) RETURNING id;"
    adapted, has_ret = _adapt_sql_for_postgres(insert_ret)
    assert adapted.count("RETURNING id") == 1


def test_create_user_duplicate_email_raises_value_error():
    """Ensure duplicate user creation handles uniqueness gracefully with ValueError."""
    email = "unique-test-user@example.com"
    # Ensure cleanup first
    with get_connection() as conn:
        conn.execute("DELETE FROM users WHERE email = ?;", (email,))
        conn.commit()

    user1 = create_user("Test User", email, "SecurePassword123!")
    assert user1["email"] == email

    with pytest.raises(ValueError) as exc:
        create_user("Another Name", email, "AnotherPassword123!")
    assert f"An account with email '{email}' already exists." in str(exc.value)

    # Cleanup
    with get_connection() as conn:
        conn.execute("DELETE FROM users WHERE email = ?;", (email,))
        conn.commit()
