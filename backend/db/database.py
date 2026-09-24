"""
backend/db/database.py
======================
Production-ready database abstraction supporting:
  1. PostgreSQL for Production (Railway PostgreSQL, Docker, Kubernetes)
  2. Embedded SQLite with WAL mode for Local Development and Testing

Features:
  - Idempotent table creation and administrator seeding
  - Multi-worker concurrent startup safety (PostgreSQL transaction advisory locks,
    SQLite file/in-process mutex synchronization, ON CONFLICT DO NOTHING)
  - Connection pooling with thread-safe resource checkout and automatic cleanup
  - Dynamic parameter translation (? -> %s) and transparent lastrowid support
  - Strict data preservation (no dropping tables, no resetting production data)
  - Append-only activity audit logging with credential scrubbing
"""

import hashlib
import json
import logging
import os
import re
import secrets
import sqlite3
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Sequence, Tuple, Union

from backend.utils.dotenv_loader import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

DB_DIR = Path(__file__).parent.parent / "data"
DB_DIR.mkdir(parents=True, exist_ok=True)
DB_PATH = DB_DIR / "app.db"

_init_lock = threading.Lock()
_db_initialized = False
_pg_pool = None
_pool_lock = threading.Lock()


# ── Database URL & Driver Selection ───────────────────────────────────────────

def get_database_url() -> Optional[str]:
    """Retrieve DATABASE_URL from environment with protocol normalization."""
    raw_url = os.getenv("DATABASE_URL", "").strip()
    if not raw_url:
        return None
    # Normalize postgres:// (standard on Railway/Heroku) to postgresql://
    if raw_url.startswith("postgres://"):
        raw_url = "postgresql://" + raw_url[len("postgres://"):]
    return raw_url


def get_database_type() -> str:
    """
    Determine whether the active database backend is 'postgres' or 'sqlite'.
    Enforces strict production requirements: SQLite fallback is prohibited in production.
    """
    url = get_database_url()
    env = os.getenv("ENVIRONMENT", "development").strip().lower()

    if url:
        if url.startswith("postgresql://") or url.startswith("postgres://"):
            return "postgres"
        elif url.startswith("sqlite"):
            if env == "production":
                raise RuntimeError(
                    "FATAL: DATABASE_URL must be a PostgreSQL connection in production, not SQLite."
                )
            return "sqlite"
        else:
            return "postgres"

    if env == "production":
        raise RuntimeError(
            "FATAL: DATABASE_URL environment variable must be configured when ENVIRONMENT=production. "
            "SQLite fallback is strictly prohibited in production."
        )

    return "sqlite"


# ── Password Hashing & Constant-Time Verification ─────────────────────────────

def hash_password(password: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """Hash password using PBKDF2-HMAC-SHA256 with 100,000 iterations."""
    if salt is None:
        salt = secrets.token_hex(16)
    pwd_hash = hashlib.pbkdf2_hmac(
        "sha256",
        password.encode("utf-8"),
        salt.encode("utf-8"),
        100_000,
    ).hex()
    return pwd_hash, salt


def verify_password(password: str, stored_hash: str, salt: str) -> bool:
    """Verify a password against stored PBKDF2 hash and salt."""
    pwd_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(pwd_hash, stored_hash)


# Precomputed constant dummy hash and salt for constant-time email mismatch verification
DUMMY_PWD_HASH, DUMMY_SALT = hash_password(
    "dummy_constant_for_timing_mitigation_12345", salt="0123456789abcdef0123456789abcdef"
)


def verify_dummy_password(password: str) -> bool:
    """Run full password hashing against constant dummy hash to prevent timing attacks."""
    return verify_password(password, DUMMY_PWD_HASH, DUMMY_SALT)


# ── PostgreSQL Connection Adapter & Query Translation ─────────────────────────

def _adapt_sql_for_postgres(sql: str) -> Tuple[str, bool]:
    """
    Translate standard/SQLite-style parameterized queries into PostgreSQL syntax.
    1. Replaces '?' placeholders with '%s'.
    2. Converts 'LIKE' to 'ILIKE' for case-insensitive text matching.
    3. Automatically appends 'RETURNING id' for INSERT statements on tables with auto-increment 'id'
       so cursor.lastrowid is populated transparently.
    """
    adapted = sql
    adapted = re.sub(r"\?", "%s", adapted)
    adapted = re.sub(r"\bLIKE\b", "ILIKE", adapted)

    has_returning = bool(re.search(r"\bRETURNING\b", adapted, re.IGNORECASE))
    is_insert_with_id = bool(
        re.search(
            r"INSERT\s+INTO\s+(users|activity_logs|predictions|support_tickets)\b",
            adapted,
            re.IGNORECASE,
        )
    )

    if is_insert_with_id and not has_returning:
        stripped = adapted.strip().rstrip(";")
        adapted = stripped + " RETURNING id;"
        return adapted, True

    return adapted, False


class PostgresCursorWrapper:
    """Cursor wrapper for PostgreSQL providing unified lastrowid and query parameter translation."""

    def __init__(self, raw_cursor):
        self._cursor = raw_cursor
        self.lastrowid: Optional[int] = None

    def execute(self, sql: str, params: Optional[Union[Sequence[Any], Tuple[Any, ...]]] = None):
        adapted_sql, expects_returning = _adapt_sql_for_postgres(sql)
        if params is not None:
            self._cursor.execute(adapted_sql, tuple(params))
        else:
            self._cursor.execute(adapted_sql)

        if expects_returning:
            try:
                res = self._cursor.fetchone()
                if res is not None:
                    self.lastrowid = res[0]
                else:
                    self.lastrowid = None
            except Exception:
                self.lastrowid = None
        return self

    def executemany(self, sql: str, seq_of_params: Sequence[Sequence[Any]]):
        adapted_sql, _ = _adapt_sql_for_postgres(sql)
        return self._cursor.executemany(adapted_sql, [tuple(p) for p in seq_of_params])

    def fetchone(self):
        return self._cursor.fetchone()

    def fetchall(self):
        return self._cursor.fetchall()

    def fetchmany(self, size=None):
        return self._cursor.fetchmany(size) if size is not None else self._cursor.fetchmany()

    @property
    def rowcount(self) -> int:
        return self._cursor.rowcount

    @property
    def description(self):
        return self._cursor.description

    def close(self):
        try:
            self._cursor.close()
        except Exception:
            pass

    def __iter__(self):
        return iter(self._cursor)


class PostgresConnectionWrapper:
    """Thread-safe connection wrapper that manages transactions and returns connections to the pool."""

    def __init__(self, raw_conn, pool=None):
        self._conn = raw_conn
        self._pool = pool
        self._closed = False

    def cursor(self):
        import psycopg2.extras
        raw_cur = self._conn.cursor(cursor_factory=psycopg2.extras.DictCursor)
        return PostgresCursorWrapper(raw_cur)

    def execute(self, sql: str, params: Optional[Union[Sequence[Any], Tuple[Any, ...]]] = None):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        if not self._closed:
            self._closed = True
            if self._pool is not None:
                self._pool.putconn(self._conn)
            else:
                self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type is not None:
                self.rollback()
            else:
                self.commit()
        finally:
            self.close()


def _get_pg_pool():
    """Lazily initialize ThreadedConnectionPool for PostgreSQL."""
    global _pg_pool
    if _pg_pool is None:
        with _pool_lock:
            if _pg_pool is None:
                try:
                    import psycopg2
                    import psycopg2.pool
                    import psycopg2.extras
                except ImportError as exc:
                    raise RuntimeError(
                        "psycopg2 is required for PostgreSQL connections. "
                        "Install it with: pip install psycopg2-binary"
                    ) from exc

                db_url = get_database_url()
                min_conn = int(os.getenv("DB_POOL_MIN", "1"))
                max_conn = int(os.getenv("DB_POOL_MAX", "10"))
                safe_url = sanitize_log_text(db_url or "")
                logger.info("Initializing PostgreSQL pool (min=%d, max=%d) at %s", min_conn, max_conn, safe_url)
                _pg_pool = psycopg2.pool.ThreadedConnectionPool(
                    min_conn, max_conn, dsn=db_url
                )
    return _pg_pool


def close_db_pools():
    """Close all connections in the PostgreSQL connection pool upon process termination."""
    global _pg_pool
    with _pool_lock:
        if _pg_pool is not None:
            try:
                _pg_pool.closeall()
                logger.info("Closed PostgreSQL connection pool.")
            except Exception as e:
                logger.warning("Error closing PostgreSQL pool: %s", e)
            _pg_pool = None


# ── SQLite Connection Wrapper ─────────────────────────────────────────────────

class SQLiteConnectionWrapper:
    """Wrapper around sqlite3.Connection ensuring uniform context management semantics."""

    def __init__(self, conn: sqlite3.Connection):
        self._conn = conn

    def cursor(self):
        return self._conn.cursor()

    def execute(self, sql: str, params: Optional[Union[Sequence[Any], Tuple[Any, ...]]] = None):
        if params is not None:
            return self._conn.execute(sql, params)
        return self._conn.execute(sql)

    def executemany(self, sql: str, seq_of_params: Sequence[Sequence[Any]]):
        return self._conn.executemany(sql, seq_of_params)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        try:
            if exc_type is not None:
                self.rollback()
            else:
                self.commit()
        finally:
            self.close()


def _get_sqlite_connection() -> SQLiteConnectionWrapper:
    """Create a connection to SQLite with WAL mode, busy timeout, and row factory."""
    conn = sqlite3.connect(str(DB_PATH), timeout=30.0)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL;")
    conn.execute("PRAGMA synchronous=NORMAL;")
    conn.execute("PRAGMA foreign_keys=ON;")
    conn.execute("PRAGMA busy_timeout=30000;")
    return SQLiteConnectionWrapper(conn)


def _get_connection():
    """Retrieve an active database connection context for either PostgreSQL or SQLite."""
    db_type = get_database_type()
    if db_type == "postgres":
        pool = _get_pg_pool()
        raw_conn = pool.getconn()
        return PostgresConnectionWrapper(raw_conn, pool=pool)
    return _get_sqlite_connection()


get_connection = _get_connection


# ── Database Initialization & Idempotent Schema Creation ──────────────────────

def init_db() -> None:
    """
    Initialize database tables and seed default administrator idempotently.
    Safe for multi-worker Gunicorn/Uvicorn concurrent startup.
    Uses PostgreSQL advisory locks or SQLite thread/file synchronization.
    Guarantees no UNIQUE constraint crashes or duplicate rows.
    """
    global _db_initialized
    with _init_lock:
        db_type = get_database_type()

        with _get_connection() as conn:
            cursor = conn.cursor()

            if db_type == "postgres":
                # PostgreSQL transaction-level advisory lock (64-bit identifier)
                # Sibling Gunicorn workers executing init_db concurrently wait here
                # until this transaction commits.
                cursor.execute("SELECT pg_advisory_xact_lock(7483921);")

                # PostgreSQL DDL
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        email VARCHAR(255) UNIQUE NOT NULL,
                        password_hash VARCHAR(255) NOT NULL,
                        salt VARCHAR(255) NOT NULL,
                        role VARCHAR(50) NOT NULL DEFAULT 'user',
                        status VARCHAR(50) NOT NULL DEFAULT 'active',
                        created_at VARCHAR(100) NOT NULL,
                        updated_at VARCHAR(100) NOT NULL,
                        last_login_at VARCHAR(100)
                    );
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS sessions (
                        token VARCHAR(255) PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        created_at VARCHAR(100) NOT NULL,
                        expires_at VARCHAR(100) NOT NULL
                    );
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS activity_logs (
                        id SERIAL PRIMARY KEY,
                        timestamp VARCHAR(100) NOT NULL,
                        user_id INTEGER,
                        user_name VARCHAR(255) NOT NULL,
                        email VARCHAR(255) NOT NULL,
                        role VARCHAR(50) NOT NULL,
                        action_type VARCHAR(100) NOT NULL,
                        category VARCHAR(100) NOT NULL,
                        description TEXT NOT NULL,
                        status VARCHAR(50) NOT NULL,
                        ip_address VARCHAR(100) NOT NULL,
                        user_agent TEXT NOT NULL,
                        metadata_json TEXT NOT NULL DEFAULT '{}'
                    );
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS predictions (
                        id SERIAL PRIMARY KEY,
                        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                        user_name VARCHAR(255) NOT NULL,
                        email VARCHAR(255) NOT NULL,
                        brand VARCHAR(100) NOT NULL,
                        year INTEGER NOT NULL,
                        present_price DOUBLE PRECISION NOT NULL,
                        kms_driven INTEGER NOT NULL,
                        fuel_type VARCHAR(50) NOT NULL,
                        seller_type VARCHAR(50) NOT NULL,
                        transmission VARCHAR(50) NOT NULL,
                        owner INTEGER NOT NULL,
                        predicted_price DOUBLE PRECISION NOT NULL,
                        currency VARCHAR(50) NOT NULL DEFAULT 'Lakh INR',
                        car_age INTEGER NOT NULL,
                        created_at VARCHAR(100) NOT NULL
                    );
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS support_tickets (
                        id SERIAL PRIMARY KEY,
                        name VARCHAR(255) NOT NULL,
                        email VARCHAR(255) NOT NULL,
                        subject VARCHAR(255) NOT NULL,
                        category VARCHAR(100) NOT NULL DEFAULT 'general',
                        message TEXT NOT NULL,
                        attachment_path TEXT,
                        attachment_name VARCHAR(255),
                        status VARCHAR(50) NOT NULL DEFAULT 'open',
                        ip_address VARCHAR(100) NOT NULL DEFAULT '127.0.0.1',
                        created_at VARCHAR(100) NOT NULL,
                        updated_at VARCHAR(100) NOT NULL
                    );
                """)
            else:
                # SQLite DDL
                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS users (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        email TEXT UNIQUE NOT NULL COLLATE NOCASE,
                        password_hash TEXT NOT NULL,
                        salt TEXT NOT NULL,
                        role TEXT NOT NULL DEFAULT 'user',
                        status TEXT NOT NULL DEFAULT 'active',
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL,
                        last_login_at TEXT
                    );
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS sessions (
                        token TEXT PRIMARY KEY,
                        user_id INTEGER NOT NULL,
                        created_at TEXT NOT NULL,
                        expires_at TEXT NOT NULL,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    );
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS activity_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TEXT NOT NULL,
                        user_id INTEGER,
                        user_name TEXT NOT NULL,
                        email TEXT NOT NULL COLLATE NOCASE,
                        role TEXT NOT NULL,
                        action_type TEXT NOT NULL,
                        category TEXT NOT NULL,
                        description TEXT NOT NULL,
                        status TEXT NOT NULL,
                        ip_address TEXT NOT NULL,
                        user_agent TEXT NOT NULL,
                        metadata_json TEXT NOT NULL DEFAULT '{}'
                    );
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS predictions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        user_id INTEGER NOT NULL,
                        user_name TEXT NOT NULL,
                        email TEXT NOT NULL COLLATE NOCASE,
                        brand TEXT NOT NULL,
                        year INTEGER NOT NULL,
                        present_price REAL NOT NULL,
                        kms_driven INTEGER NOT NULL,
                        fuel_type TEXT NOT NULL,
                        seller_type TEXT NOT NULL,
                        transmission TEXT NOT NULL,
                        owner INTEGER NOT NULL,
                        predicted_price REAL NOT NULL,
                        currency TEXT NOT NULL DEFAULT 'Lakh INR',
                        car_age INTEGER NOT NULL,
                        created_at TEXT NOT NULL,
                        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
                    );
                """)

                cursor.execute("""
                    CREATE TABLE IF NOT EXISTS support_tickets (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        name TEXT NOT NULL,
                        email TEXT NOT NULL COLLATE NOCASE,
                        subject TEXT NOT NULL,
                        category TEXT NOT NULL DEFAULT 'general',
                        message TEXT NOT NULL,
                        attachment_path TEXT,
                        attachment_name TEXT,
                        status TEXT NOT NULL DEFAULT 'open',
                        ip_address TEXT NOT NULL DEFAULT '127.0.0.1',
                        created_at TEXT NOT NULL,
                        updated_at TEXT NOT NULL
                    );
                """)

            # Unified Index Declarations
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_timestamp ON activity_logs(timestamp);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_category ON activity_logs(category);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_user_id ON activity_logs(user_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_status ON activity_logs(status);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_logs_action ON activity_logs(action_type);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_predictions_user_id ON predictions(user_id);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_predictions_created_at ON predictions(created_at);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_status   ON support_tickets(status);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_email    ON support_tickets(email);")
            cursor.execute("CREATE INDEX IF NOT EXISTS idx_tickets_created  ON support_tickets(created_at);")

            # Seed initial administrator idempotently
            cursor.execute("SELECT id FROM users WHERE role = 'admin' LIMIT 1;")
            admin_exists = cursor.fetchone()

            if not admin_exists:
                env = os.getenv("ENVIRONMENT", "development").strip().lower()
                admin_email = os.getenv("ADMIN_EMAIL", "").strip()
                admin_password = os.getenv("ADMIN_PASSWORD", "").strip()
                admin_name = os.getenv("ADMIN_NAME", "Administrator").strip()

                if not admin_email or not admin_password:
                    if env == "production":
                        raise RuntimeError(
                            "FATAL: ADMIN_EMAIL and ADMIN_PASSWORD environment variables MUST be set "
                            "when ENVIRONMENT=production to seed the initial administrator."
                        )
                    admin_email = admin_email or "dev-admin@localhost"
                    admin_password = admin_password or secrets.token_urlsafe(16)
                    print(
                        f"\n[SECURITY NOTICE] No admin credentials found in environment.\n"
                        f"Created temporary development admin:\n"
                        f"  Email:    {admin_email}\n"
                        f"  Password: {admin_password}\n"
                    )
                    logger.warning(
                        "Seeded development admin: %s (generated temporary password)", admin_email
                    )

                now_iso = datetime.now(timezone.utc).isoformat()
                p_hash, salt = hash_password(admin_password)

                try:
                    # Idempotent upsert logic with ON CONFLICT DO NOTHING
                    cursor.execute("""
                        INSERT INTO users (name, email, password_hash, salt, role, status, created_at, updated_at)
                        VALUES (?, ?, ?, ?, 'admin', 'active', ?, ?)
                        ON CONFLICT (email) DO NOTHING;
                    """, (admin_name, admin_email.lower(), p_hash, salt, now_iso, now_iso))

                    admin_id = cursor.lastrowid
                    if cursor.rowcount > 0 and admin_id:
                        logger.info("Seeded initial administrator account (id=%s): %s", admin_id, admin_email)
                except Exception as e:
                    # In case of concurrent insert race condition, ignore unique violation gracefully
                    if "unique" in str(e).lower() or "duplicate" in str(e).lower():
                        logger.info("Admin account already initialized concurrently by sibling worker.")
                    else:
                        raise

            conn.commit()
            _db_initialized = True


# ── Activity Logging Engine ───────────────────────────────────────────────────

def sanitize_log_text(text: str) -> str:
    """Scrub sensitive credentials, passwords, tokens, and database URLs from log text."""
    if not text:
        return text
    # Scrub database connection URLs with embedded credentials
    scrubbed = re.sub(r"://([^:]+):([^@]+)@", r"://\1:[REDACTED]@", text)
    # Scrub key-value pairs like password=xyz or secret=xyz
    scrubbed = re.sub(
        r"(?i)\b(password|pwd|secret|token|api[_-]?key)\s*[:=]\s*([^\s,;\"'}{]+)",
        r"\1=[REDACTED]",
        scrubbed,
    )
    # Scrub bearer tokens
    scrubbed = re.sub(r"(?i)bearer\s+[a-zA-Z0-9_\-\.]{15,}", "Bearer [REDACTED]", scrubbed)
    return scrubbed


def log_activity(
    action_type: str,
    category: str,
    description: str,
    status: str = "success",
    user_id: Optional[int] = None,
    user_name: Optional[str] = "Guest",
    email: Optional[str] = "anonymous",
    role: Optional[str] = "guest",
    ip_address: Optional[str] = "127.0.0.1",
    user_agent: Optional[str] = "Unknown",
    metadata: Optional[Dict[str, Any]] = None,
) -> int:
    """
    Append-only logging function.
    Safely sanitizes sensitive fields before persisting.
    """
    timestamp = datetime.now(timezone.utc).isoformat()
    meta_copy = dict(metadata or {})

    # Never log credentials or tokens
    for forbidden in [
        "password", "token", "confirm_password", "salt", "secret", "current_password", "new_password"
    ]:
        if forbidden in meta_copy:
            meta_copy[forbidden] = "[REDACTED]"

    clean_desc = sanitize_log_text(description)
    meta_str = sanitize_log_text(json.dumps(meta_copy))

    safe_user_name = user_name or "Guest"
    safe_email = email or "anonymous"
    safe_role = role or "guest"
    safe_ip = ip_address or "127.0.0.1"
    safe_ua = user_agent or "Unknown"

    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO activity_logs (
                timestamp, user_id, user_name, email, role,
                action_type, category, description, status,
                ip_address, user_agent, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            timestamp, user_id, safe_user_name, safe_email, safe_role,
            action_type, category, clean_desc, status,
            safe_ip, safe_ua, meta_str
        ))
        conn.commit()
        return cursor.lastrowid or 0


def save_activity_logs_batch(events: List[Dict[str, Any]]) -> int:
    """Insert multiple activity logs in a single atomic transaction."""
    if not events:
        return 0

    sanitized_rows = []
    now_iso = datetime.now(timezone.utc).isoformat()

    for ev in events:
        ts = ev.get("timestamp") or now_iso
        uid = ev.get("user_id")
        uname = ev.get("user_name", "Anonymous")
        email = (ev.get("email") or "anonymous@carworth.ai").strip().lower()
        role = ev.get("role", "visitor")
        atype = ev.get("action_type", "custom_event")
        cat = ev.get("category", "telemetry")
        desc = ev.get("description", "")
        stat = ev.get("status", "info")
        ip = ev.get("ip_address", "127.0.0.1")
        ua = ev.get("user_agent", "Client-Beacon")

        meta_copy = dict(ev.get("metadata") or {})
        for forbidden in ["password", "token", "confirm_password", "salt", "secret"]:
            if forbidden in meta_copy:
                meta_copy[forbidden] = "[REDACTED]"

        sanitized_rows.append((
            ts, uid, uname, email, role,
            atype, cat, desc, stat,
            ip, ua, json.dumps(meta_copy)
        ))

    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.executemany("""
            INSERT INTO activity_logs (
                timestamp, user_id, user_name, email, role,
                action_type, category, description, status,
                ip_address, user_agent, metadata_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);
        """, sanitized_rows)
        conn.commit()
        return len(sanitized_rows)


# ── User & Session Operations ─────────────────────────────────────────────────

def create_user(name: str, email: str, password: str, role: str = "user") -> Dict[str, Any]:
    """Create a new user. Default role is 'user'."""
    now_iso = datetime.now(timezone.utc).isoformat()
    pwd_hash, salt = hash_password(password)
    norm_email = email.strip().lower()

    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT id FROM users WHERE LOWER(email) = ?;", (norm_email,))
        if cursor.fetchone():
            raise ValueError(f"An account with email '{norm_email}' already exists.")

        try:
            cursor.execute("""
                INSERT INTO users (name, email, password_hash, salt, role, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, 'active', ?, ?);
            """, (name.strip(), norm_email, pwd_hash, salt, role, now_iso, now_iso))
            conn.commit()
            user_id = cursor.lastrowid
        except Exception as e:
            if "unique" in str(e).lower() or "duplicate" in str(e).lower() or "integrity" in str(e).lower():
                raise ValueError(f"An account with email '{norm_email}' already exists.")
            raise

    return get_user_by_id(user_id) or {}


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """Fetch user by email (case-insensitive)."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE LOWER(email) = ?;", (email.strip().lower(),))
        row = cursor.fetchone()
        return dict(row) if row else None


def get_user_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Fetch user by id without password_hash/salt."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT id, name, email, role, status, created_at, updated_at, last_login_at
            FROM users WHERE id = ?;
        """, (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_user_profile(user_id: int, name: str) -> Dict[str, Any]:
    """Update user display name."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users SET name = ?, updated_at = ? WHERE id = ?;
        """, (name.strip(), now_iso, user_id))
        conn.commit()
    user = get_user_by_id(user_id)
    if not user:
        raise ValueError("User not found.")
    return user


def hash_token(token: str) -> str:
    """Compute SHA-256 hash of a session token for secure storage at rest."""
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_session(user_id: int, expires_days: int = 7) -> str:
    """
    Create a persistent session token.
    Stores the SHA-256 hash of the token in the database to prevent token leakage
    if the database is ever compromised, while returning the raw token to the caller.
    """
    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)
    now = datetime.now(timezone.utc)
    from datetime import timedelta
    expires = now + timedelta(days=expires_days)

    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO sessions (token, user_id, created_at, expires_at)
            VALUES (?, ?, ?, ?);
        """, (token_hash, user_id, now.isoformat(), expires.isoformat()))
        cursor.execute("""
            UPDATE users SET last_login_at = ? WHERE id = ?;
        """, (now.isoformat(), user_id))
        conn.commit()

    return raw_token


def get_user_from_token(token: str) -> Optional[Dict[str, Any]]:
    """Verify session token and return user if token is valid and not expired."""
    now_iso = datetime.now(timezone.utc).isoformat()
    token_hash = hash_token(token)
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT u.id, u.name, u.email, u.role, u.status, u.created_at, u.updated_at, u.last_login_at
            FROM sessions s
            JOIN users u ON s.user_id = u.id
            WHERE (s.token = ? OR s.token = ?) AND s.expires_at > ? AND u.status = 'active';
        """, (token_hash, token, now_iso))
        row = cursor.fetchone()
        return dict(row) if row else None


def revoke_session(token: str) -> None:
    """Delete session token on logout."""
    token_hash = hash_token(token)
    with _get_connection() as conn:
        conn.execute("DELETE FROM sessions WHERE token = ? OR token = ?;", (token_hash, token))
        conn.commit()


def cleanup_expired_sessions() -> int:
    """Remove expired sessions from the database."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE expires_at <= ?;", (now_iso,))
        conn.commit()
        return cursor.rowcount


def revoke_all_user_sessions(user_id: int) -> int:
    """Revoke all active sessions for a user (e.g. after password change)."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM sessions WHERE user_id = ?;", (user_id,))
        conn.commit()
        return cursor.rowcount


def get_user_auth_by_id(user_id: int) -> Optional[Dict[str, Any]]:
    """Fetch user by id including password_hash and salt for credential verification."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM users WHERE id = ?;", (user_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_user_password(user_id: int, new_password: str) -> None:
    """Hash new password with a fresh salt and update user record."""
    p_hash, salt = hash_password(new_password)
    now_iso = datetime.now(timezone.utc).isoformat()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            UPDATE users SET password_hash = ?, salt = ?, updated_at = ? WHERE id = ?;
        """, (p_hash, salt, now_iso, user_id))
        conn.commit()


# ── Admin User Management Operations ──────────────────────────────────────────

def list_users(
    search: str = "",
    role: Optional[str] = None,
    status: Optional[str] = None,
    page: int = 1,
    limit: int = 20,
) -> Tuple[List[Dict[str, Any]], int]:
    """Paginated user listing for admin dashboard."""
    query = "SELECT id, name, email, role, status, created_at, updated_at, last_login_at FROM users WHERE 1=1"
    params: List[Any] = []

    if search:
        query += " AND (name LIKE ? OR email LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%"])
    if role:
        query += " AND role = ?"
        params.append(role)
    if status:
        query += " AND status = ?"
        params.append(status)

    count_query = f"SELECT COUNT(*) FROM ({query}) AS subq"

    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]

        query += " ORDER BY id DESC LIMIT ? OFFSET ?"
        params.extend([limit, (page - 1) * limit])

        cursor.execute(query, params)
        rows = [dict(r) for r in cursor.fetchall()]

    return rows, total


def set_user_status(user_id: int, status: str) -> Dict[str, Any]:
    """Activate or deactivate user account."""
    if status not in ["active", "inactive"]:
        raise ValueError("Invalid status. Must be 'active' or 'inactive'.")
    now_iso = datetime.now(timezone.utc).isoformat()
    with _get_connection() as conn:
        conn.execute("UPDATE users SET status = ?, updated_at = ? WHERE id = ?;", (status, now_iso, user_id))
        conn.commit()
    user = get_user_by_id(user_id)
    if not user:
        raise ValueError("User not found.")
    return user


def set_user_role(user_id: int, role: str) -> Dict[str, Any]:
    """Change user role (e.g. 'user' or 'admin')."""
    if role not in ["user", "admin"]:
        raise ValueError("Invalid role. Must be 'user' or 'admin'.")
    now_iso = datetime.now(timezone.utc).isoformat()
    with _get_connection() as conn:
        conn.execute("UPDATE users SET role = ?, updated_at = ? WHERE id = ?;", (role, now_iso, user_id))
        conn.commit()
    user = get_user_by_id(user_id)
    if not user:
        raise ValueError("User not found.")
    return user


def delete_user(user_id: int) -> bool:
    """Delete a user account and associated sessions."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM users WHERE id = ?;", (user_id,))
        conn.commit()
        return cursor.rowcount > 0


# ── Audit Logs Query Engine ───────────────────────────────────────────────────

def get_logs(
    search: str = "",
    category: Optional[str] = None,
    action_type: Optional[str] = None,
    role: Optional[str] = None,
    status: Optional[str] = None,
    user_id: Optional[int] = None,
    ip_address: Optional[str] = None,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    page: int = 1,
    limit: int = 25,
    sort_by: str = "timestamp",
    sort_order: str = "desc",
) -> Tuple[List[Dict[str, Any]], int]:
    """Search, filter, and paginate audit logs."""
    valid_sorts = {"id", "timestamp", "user_name", "email", "action_type", "category", "status"}
    if sort_by not in valid_sorts:
        sort_by = "timestamp"
    order = "ASC" if sort_order.lower() == "asc" else "DESC"
    limit = min(max(1, limit), 100)
    page = max(1, page)

    query = "SELECT * FROM activity_logs WHERE 1=1"
    params: List[Any] = []

    if search:
        query += " AND (description LIKE ? OR email LIKE ? OR user_name LIKE ? OR action_type LIKE ?)"
        params.extend([f"%{search}%", f"%{search}%", f"%{search}%", f"%{search}%"])
    if category:
        query += " AND category = ?"
        params.append(category)
    if action_type:
        query += " AND action_type = ?"
        params.append(action_type)
    if role:
        query += " AND role = ?"
        params.append(role)
    if status:
        query += " AND status = ?"
        params.append(status)
    if user_id is not None:
        query += " AND user_id = ?"
        params.append(user_id)
    if ip_address:
        query += " AND ip_address = ?"
        params.append(ip_address)
    if start_date:
        query += " AND timestamp >= ?"
        params.append(start_date)
    if end_date:
        query += " AND timestamp <= ?"
        params.append(end_date)

    count_query = f"SELECT COUNT(*) FROM ({query}) AS subq"

    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(count_query, params)
        total = cursor.fetchone()[0]

        query += f" ORDER BY {sort_by} {order} LIMIT ? OFFSET ?"
        params.extend([limit, (page - 1) * limit])

        cursor.execute(query, params)
        rows = []
        for r in cursor.fetchall():
            d = dict(r)
            try:
                d["metadata"] = json.loads(d.get("metadata_json") or "{}")
            except Exception:
                d["metadata"] = {}
            rows.append(d)

    return rows, total


def get_log_by_id(log_id: int) -> Optional[Dict[str, Any]]:
    """Retrieve single log entry with parsed metadata."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM activity_logs WHERE id = ?;", (log_id,))
        r = cursor.fetchone()
        if not r:
            return None
        d = dict(r)
        try:
            d["metadata"] = json.loads(d.get("metadata_json") or "{}")
        except Exception:
            d["metadata"] = {}
        return d


def get_user_logs(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve recent timeline logs for a specific user."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM activity_logs
            WHERE user_id = ?
            ORDER BY timestamp DESC
            LIMIT ?;
        """, (user_id, limit))
        rows = []
        for r in cursor.fetchall():
            d = dict(r)
            try:
                d["metadata"] = json.loads(d.get("metadata_json") or "{}")
            except Exception:
                d["metadata"] = {}
            rows.append(d)
        return rows


def get_admin_dashboard_stats() -> Dict[str, Any]:
    """Retrieve high-level overview metrics for the Admin Dashboard."""
    today_prefix = datetime.now(timezone.utc).strftime("%Y-%m-%d")

    with _get_connection() as conn:
        cursor = conn.cursor()

        # Total Users
        cursor.execute("SELECT COUNT(*) FROM users;")
        total_users = cursor.fetchone()[0]

        # Active Users
        cursor.execute("SELECT COUNT(*) FROM users WHERE status = 'active';")
        active_users = cursor.fetchone()[0]

        # New registrations today
        cursor.execute("SELECT COUNT(*) FROM users WHERE created_at LIKE ?;", (f"{today_prefix}%",))
        new_registrations_today = cursor.fetchone()[0]

        # Failed logins today
        cursor.execute("""
            SELECT COUNT(*) FROM activity_logs
            WHERE action_type = 'login_failure' AND timestamp LIKE ?;
        """, (f"{today_prefix}%",))
        failed_logins_today = cursor.fetchone()[0]

        # Suspicious activities (failed logins count by IP)
        cursor.execute("""
            SELECT ip_address, COUNT(*) as fail_count
            FROM activity_logs
            WHERE action_type = 'login_failure'
            GROUP BY ip_address
            HAVING COUNT(*) >= 3
            ORDER BY fail_count DESC
            LIMIT 5;
        """)
        suspicious_ips = [dict(r) for r in cursor.fetchall()]

        # Top 6 recent activities
        cursor.execute("""
            SELECT id, timestamp, user_name, email, action_type, category, description, status, ip_address
            FROM activity_logs
            ORDER BY timestamp DESC
            LIMIT 6;
        """)
        recent_activity = [dict(r) for r in cursor.fetchall()]

        # Activity count by category
        cursor.execute("""
            SELECT category, COUNT(*) as count
            FROM activity_logs
            GROUP BY category;
        """)
        category_breakdown = {r["category"]: r["count"] for r in cursor.fetchall()}

        # Total logs count
        cursor.execute("SELECT COUNT(*) FROM activity_logs;")
        total_logs = cursor.fetchone()[0]

        # Total predictions count
        cursor.execute("SELECT COUNT(*) FROM activity_logs WHERE action_type = 'valuation_predicted';")
        total_predictions = cursor.fetchone()[0]

    return {
        "total_users": total_users,
        "active_users": active_users,
        "new_registrations_today": new_registrations_today,
        "failed_logins_today": failed_logins_today,
        "total_predictions": total_predictions,
        "total_logs": total_logs,
        "suspicious_ips": suspicious_ips,
        "recent_activity": recent_activity,
        "category_breakdown": category_breakdown,
    }


# ── Prediction Storage & User History ─────────────────────────────────────────

def save_prediction(
    user_id: int,
    user_name: str,
    email: str,
    brand: str,
    year: int,
    present_price: float,
    kms_driven: int,
    fuel_type: str,
    seller_type: str,
    transmission: str,
    owner: int,
    predicted_price: float,
    car_age: int,
    currency: str = "Lakh INR",
) -> Dict[str, Any]:
    """Persist an authenticated user's prediction record."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO predictions (
                user_id, user_name, email, brand, year,
                present_price, kms_driven, fuel_type, seller_type,
                transmission, owner, predicted_price, currency, car_age, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """, (
            user_id, user_name, email.strip().lower(), brand, year,
            present_price, kms_driven, fuel_type, seller_type,
            transmission, owner, predicted_price, currency, car_age, now_iso
        ))
        conn.commit()
        pred_id = cursor.lastrowid
        cursor.execute("SELECT * FROM predictions WHERE id = ?;", (pred_id,))
        row = cursor.fetchone()
        return dict(row) if row else {}


def get_user_predictions(user_id: int, limit: int = 50) -> List[Dict[str, Any]]:
    """Retrieve historical valuations performed by a specific user account."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            SELECT * FROM predictions
            WHERE user_id = ?
            ORDER BY created_at DESC
            LIMIT ?;
        """, (user_id, limit))
        return [dict(r) for r in cursor.fetchall()]


def get_all_predictions(limit: int = 100, offset: int = 0) -> Tuple[List[Dict[str, Any]], int]:
    """Retrieve all valuation records across all users for administrator oversight."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT COUNT(*) FROM predictions;")
        total = cursor.fetchone()[0]
        cursor.execute("""
            SELECT * FROM predictions
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?;
        """, (limit, offset))
        items = [dict(r) for r in cursor.fetchall()]
        return items, total


# ── Support Ticket Helpers ────────────────────────────────────────────────────

def create_ticket(
    name: str,
    email: str,
    subject: str,
    category: str,
    message: str,
    ip_address: str = "127.0.0.1",
    attachment_path: Optional[str] = None,
    attachment_name: Optional[str] = None,
) -> int:
    """Create a new support ticket. Returns the new ticket id."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("""
            INSERT INTO support_tickets
                (name, email, subject, category, message, attachment_path,
                 attachment_name, status, ip_address, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?);
        """, (
            name, email.strip().lower(), subject, category, message,
            attachment_path, attachment_name, ip_address, now_iso, now_iso,
        ))
        conn.commit()
        return cursor.lastrowid or 0


def get_tickets(
    status_filter: Optional[str] = None,
    limit: int = 50,
    offset: int = 0,
) -> Tuple[List[Dict[str, Any]], int]:
    """Retrieve paginated support tickets with optional status filter."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        if status_filter and status_filter != "all":
            cursor.execute(
                "SELECT COUNT(*) FROM support_tickets WHERE status = ?;",
                (status_filter,),
            )
            total = cursor.fetchone()[0]
            cursor.execute(
                """SELECT * FROM support_tickets
                   WHERE status = ?
                   ORDER BY created_at DESC
                   LIMIT ? OFFSET ?;""",
                (status_filter, limit, offset),
            )
        else:
            cursor.execute("SELECT COUNT(*) FROM support_tickets;")
            total = cursor.fetchone()[0]
            cursor.execute(
                """SELECT * FROM support_tickets
                   ORDER BY created_at DESC
                   LIMIT ? OFFSET ?;""",
                (limit, offset),
            )
        items = [dict(r) for r in cursor.fetchall()]
        return items, total


def get_ticket_by_id(ticket_id: int) -> Optional[Dict[str, Any]]:
    """Return a single support ticket by its primary key."""
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute("SELECT * FROM support_tickets WHERE id = ?;", (ticket_id,))
        row = cursor.fetchone()
        return dict(row) if row else None


def update_ticket_status(ticket_id: int, new_status: str) -> bool:
    """Update the status of a support ticket. Returns True if a row was affected."""
    now_iso = datetime.now(timezone.utc).isoformat()
    with _get_connection() as conn:
        cursor = conn.cursor()
        cursor.execute(
            "UPDATE support_tickets SET status = ?, updated_at = ? WHERE id = ?;",
            (new_status, now_iso, ticket_id),
        )
        conn.commit()
        return cursor.rowcount > 0
