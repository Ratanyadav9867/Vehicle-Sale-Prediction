"""
backend/utils/rate_limiter.py
=============================
Distributed sliding-window rate limiter supporting Redis and thread-safe in-memory fallback.
Protects against brute-force logins and endpoint flooding under high concurrency.
"""

import collections
import logging
import os
import threading
import time
from typing import Dict, Tuple

from fastapi import HTTPException, Request, status

logger = logging.getLogger(__name__)

# Check if redis client from cache.py is available
from backend.utils.auth_deps import get_client_ip
from backend.utils.cache import _redis_client, _using_redis


class SlidingWindowRateLimiter:
    """Thread-safe in-memory sliding window rate limiter."""

    def __init__(self):
        self._windows: Dict[str, collections.deque] = collections.defaultdict(collections.deque)
        self._lock = threading.Lock()

    def is_allowed(self, key: str, max_requests: int, window_seconds: int = 60) -> Tuple[bool, int]:
        now = time.time()
        cutoff = now - window_seconds

        with self._lock:
            q = self._windows[key]
            # Remove timestamps outside the sliding window
            while q and q[0] <= cutoff:
                q.popleft()

            if len(q) < max_requests:
                q.append(now)
                return True, 0
            else:
                oldest = q[0]
                retry_after = max(1, int(oldest + window_seconds - now))
                return False, retry_after


_memory_limiter = SlidingWindowRateLimiter()


def check_rate_limit(key: str, max_requests: int, window_seconds: int = 60) -> Tuple[bool, int]:
    """Check if request is within allowed rate limit. Returns (is_allowed, retry_after)."""
    if _using_redis and _redis_client:
        try:
            now = time.time()
            cutoff = now - window_seconds
            r_key = f"rl:{key}"
            pipe = _redis_client.pipeline()
            pipe.zremrangebyscore(r_key, "-inf", cutoff)
            pipe.zcard(r_key)
            pipe.zadd(r_key, {str(now): now})
            pipe.expire(r_key, window_seconds + 5)
            res = pipe.execute()
            count = res[1]
            if count >= max_requests:
                return False, int(window_seconds)
            return True, 0
        except Exception as e:
            logger.warning("Redis rate limit check error: %s; falling back to memory", e)

    return _memory_limiter.is_allowed(key, max_requests, window_seconds)


def enforce_rate_limit(request: Request, key_prefix: str, max_requests: int, window_seconds: int = 60) -> None:
    """FastAPI helper to enforce rate limit or raise HTTP 429 Too Many Requests."""
    # Obtain real IP respecting trusted proxy verification (prevents XFF spoofing)
    client_ip = get_client_ip(request)

    key = f"{key_prefix}:{client_ip}"
    allowed, retry_after = check_rate_limit(key, max_requests, window_seconds)

    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail=f"Rate limit exceeded. Please retry after {retry_after} seconds.",
            headers={"Retry-After": str(retry_after)},
        )


def clear_rate_limits() -> None:
    """Reset in-memory rate limiting windows (useful for test resets and administrative clearing)."""
    with _memory_limiter._lock:
        _memory_limiter._windows.clear()

