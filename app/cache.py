"""Optional Redis cache layer.

Falls back gracefully when Redis is unavailable — the app continues to work
without caching, just without the performance benefit.

Usage:
    from app.cache import cache_get, cache_set, cache_invalidate

    cached = await cache_get("dashboard:t1")
    if cached is None:
        result = compute_expensive_thing()
        await cache_set("dashboard:t1", result, ttl=300)
        return result
    return cached
"""

import json
import logging
import os
from typing import Any

logger = logging.getLogger(__name__)

REDIS_URL = os.environ.get("REDIS_URL", "redis://redis:6379")
_redis: Any = None
_redis_available = False


def _get_redis():
    global _redis, _redis_available
    if _redis is not None or not _redis_available:
        return _redis
    try:
        import redis as _r
        _redis = _r.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1)
        _redis.ping()
        _redis_available = True
        logger.info("Redis cache connected: %s", REDIS_URL)
    except Exception as exc:
        logger.debug("Redis unavailable (%s) — caching disabled", exc)
        _redis_available = False
        _redis = None
    return _redis


def _try_connect():
    """Attempt to connect to Redis; idempotent."""
    global _redis, _redis_available
    try:
        import redis as _r
        client = _r.from_url(REDIS_URL, decode_responses=True, socket_connect_timeout=1)
        client.ping()
        _redis = client
        _redis_available = True
        logger.info("Redis cache connected: %s", REDIS_URL)
    except Exception as exc:
        logger.debug("Redis unavailable (%s) — caching disabled", exc)
        _redis_available = False
        _redis = None


# Try to connect at import time (non-blocking)
_try_connect()


def cache_get(key: str) -> Any | None:
    """Return cached value or None if miss / Redis down."""
    r = _get_redis()
    if r is None:
        return None
    try:
        raw = r.get(key)
        return json.loads(raw) if raw is not None else None
    except Exception as exc:
        logger.debug("cache_get error: %s", exc)
        return None


def cache_set(key: str, value: Any, ttl: int = 300) -> None:
    """Store value in cache with TTL seconds. Silently no-ops on error."""
    r = _get_redis()
    if r is None:
        return
    try:
        r.set(key, json.dumps(value, default=str), ex=ttl)
    except Exception as exc:
        logger.debug("cache_set error: %s", exc)


def cache_invalidate(pattern: str) -> None:
    """Delete all keys matching pattern (e.g. 'dashboard:*'). Silent on error."""
    r = _get_redis()
    if r is None:
        return
    try:
        keys = r.keys(pattern)
        if keys:
            r.delete(*keys)
    except Exception as exc:
        logger.debug("cache_invalidate error: %s", exc)
