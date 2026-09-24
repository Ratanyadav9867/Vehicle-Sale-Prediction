"""
backend/utils/cache.py
======================
High-performance caching layer for Prediction inputs and Hot Read-Only Data.
Supports Redis with automatic graceful in-memory LRU fallback when Redis
is unavailable or not installed.
"""

import hashlib
import json
import logging
import os
import threading
import time
from typing import Any, Dict, Optional, Tuple

logger = logging.getLogger(__name__)

# Redis connection settings from environment
REDIS_URL = os.getenv("REDIS_URL", "").strip() or None
if not REDIS_URL and os.getenv("ENVIRONMENT", "development").strip().lower() != "production":
    REDIS_URL = "redis://127.0.0.1:6379/0"

CACHE_TTL_DEFAULT = int(os.getenv("CACHE_TTL_SECONDS", "86400"))  # 24 hours


class InMemoryCache:
    """Thread-safe in-memory cache with TTL and LRU eviction."""

    def __init__(self, max_items: int = 50000):
        self._store: Dict[str, Tuple[float, Any]] = {}
        self._lock = threading.Lock()
        self._max_items = max_items
        self.hits = 0
        self.misses = 0

    def get(self, key: str) -> Optional[Any]:
        with self._lock:
            if key not in self._store:
                self.misses += 1
                return None
            expiry, value = self._store[key]
            if time.time() > expiry:
                del self._store[key]
                self.misses += 1
                return None
            self.hits += 1
            return value

    def set(self, key: str, value: Any, ttl_seconds: int = CACHE_TTL_DEFAULT) -> None:
        with self._lock:
            # Evict if capacity reached
            if len(self._store) >= self._max_items:
                # Remove oldest 10% items
                to_remove = sorted(self._store.items(), key=lambda item: item[1][0])[: self._max_items // 10]
                for k, _ in to_remove:
                    self._store.pop(k, None)

            expiry = time.time() + ttl_seconds
            self._store[key] = (expiry, value)

    def stats(self) -> Dict[str, Any]:
        with self._lock:
            total = self.hits + self.misses
            ratio = (self.hits / total) if total > 0 else 0.0
            return {
                "backend": "in-memory (thread-safe LRU)",
                "size": len(self._store),
                "hits": self.hits,
                "misses": self.misses,
                "hit_ratio": round(ratio, 4),
            }


# Try Redis initialization
_redis_client = None
_in_memory_cache = InMemoryCache()
_using_redis = False

if REDIS_URL:
    try:
        import redis  # type: ignore

        _client = redis.from_url(REDIS_URL, decode_responses=True, socket_timeout=1.5, socket_connect_timeout=1.5)
        # Test connection
        _client.ping()
        _redis_client = _client
        _using_redis = True
        safe_url = re.sub(r"://([^:]+):([^@]+)@", r"://\1:[REDACTED]@", REDIS_URL)
        logger.info("Connected to Redis cache at %s", safe_url)
    except Exception as e:
        logger.info("Redis not available (%s); falling back to thread-safe in-memory cache.", e)
        _using_redis = False
else:
    logger.info("REDIS_URL not configured; using thread-safe in-memory LRU cache.")


def normalize_and_hash(params: Dict[str, Any]) -> str:
    """Generate deterministic SHA-256 hash for vehicle prediction features."""
    keys = sorted(params.keys())
    normalized = {k: str(params[k]).strip().lower() for k in keys if params[k] is not None}
    raw = json.dumps(normalized, sort_keys=True)
    return "pred:" + hashlib.sha256(raw.encode("utf-8")).hexdigest()


def get_cached_prediction(cache_key: str) -> Optional[Dict[str, Any]]:
    """Retrieve cached prediction result by key."""
    if _using_redis and _redis_client:
        try:
            val = _redis_client.get(cache_key)
            if val:
                return json.loads(val)
        except Exception as e:
            logger.warning("Redis get error: %s; reading memory fallback", e)

    return _in_memory_cache.get(cache_key)


def set_cached_prediction(cache_key: str, data: Dict[str, Any], ttl_seconds: int = CACHE_TTL_DEFAULT) -> None:
    """Store prediction result with 24h expiration."""
    if _using_redis and _redis_client:
        try:
            _redis_client.set(cache_key, json.dumps(data), ex=ttl_seconds)
            return
        except Exception as e:
            logger.warning("Redis set error: %s; saving to memory fallback", e)

    _in_memory_cache.set(cache_key, data, ttl_seconds)


def get_cache_stats() -> Dict[str, Any]:
    """Retrieve cache diagnostic statistics for observability metrics."""
    if _using_redis and _redis_client:
        try:
            info = _redis_client.info("stats")
            return {
                "backend": "redis",
                "connected": True,
                "hits": info.get("keyspace_hits", 0),
                "misses": info.get("keyspace_misses", 0),
            }
        except Exception:
            pass
    return _in_memory_cache.stats()
