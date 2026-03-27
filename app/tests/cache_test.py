"""Tests for app/cache.py — Redis cache with no-op fallback.

Note: conftest.py autouse fixture patches cache_get/cache_set to no-ops.
These tests import the real functions directly and test them in isolation.
"""

import json
from unittest.mock import MagicMock, patch

import pytest

# Import the real implementations directly
from app.cache import cache_get as _real_cache_get
from app.cache import cache_set as _real_cache_set
from app.cache import cache_invalidate as _real_cache_invalidate
import app.cache as cache_module


class TestCacheWithoutRedis:
    """When Redis is unavailable, all operations should no-op gracefully."""

    def test_cache_get_returns_none(self):
        with patch.object(cache_module, "_get_redis", return_value=None):
            assert _real_cache_get("any-key") is None

    def test_cache_set_does_not_raise(self):
        with patch.object(cache_module, "_get_redis", return_value=None):
            _real_cache_set("any-key", {"data": 123})

    def test_cache_invalidate_does_not_raise(self):
        with patch.object(cache_module, "_get_redis", return_value=None):
            _real_cache_invalidate("prefix:*")


class TestCacheWithRedis:
    """When Redis is available, cache operations work correctly."""

    def test_cache_get_returns_cached_value(self):
        mock_redis = MagicMock()
        mock_redis.get.return_value = json.dumps({"total": 42})
        with patch.object(cache_module, "_get_redis", return_value=mock_redis):
            result = _real_cache_get("dashboard:t1")
        assert result == {"total": 42}
        mock_redis.get.assert_called_once_with("dashboard:t1")

    def test_cache_get_returns_none_on_miss(self):
        mock_redis = MagicMock()
        mock_redis.get.return_value = None
        with patch.object(cache_module, "_get_redis", return_value=mock_redis):
            assert _real_cache_get("missing") is None

    def test_cache_get_returns_none_on_error(self):
        mock_redis = MagicMock()
        mock_redis.get.side_effect = Exception("connection lost")
        with patch.object(cache_module, "_get_redis", return_value=mock_redis):
            assert _real_cache_get("any-key") is None

    def test_cache_set_stores_value(self):
        mock_redis = MagicMock()
        with patch.object(cache_module, "_get_redis", return_value=mock_redis):
            _real_cache_set("key1", {"a": 1}, ttl=60)
        mock_redis.set.assert_called_once()
        args = mock_redis.set.call_args
        assert args[0][0] == "key1"
        assert json.loads(args[0][1]) == {"a": 1}
        assert args[1]["ex"] == 60

    def test_cache_set_silently_handles_error(self):
        mock_redis = MagicMock()
        mock_redis.set.side_effect = Exception("write error")
        with patch.object(cache_module, "_get_redis", return_value=mock_redis):
            _real_cache_set("key1", "value")

    def test_cache_invalidate_deletes_matching_keys(self):
        mock_redis = MagicMock()
        mock_redis.keys.return_value = ["dashb:1", "dashb:2"]
        with patch.object(cache_module, "_get_redis", return_value=mock_redis):
            _real_cache_invalidate("dashb:*")
        mock_redis.keys.assert_called_once_with("dashb:*")
        mock_redis.delete.assert_called_once_with("dashb:1", "dashb:2")

    def test_cache_invalidate_no_keys(self):
        mock_redis = MagicMock()
        mock_redis.keys.return_value = []
        with patch.object(cache_module, "_get_redis", return_value=mock_redis):
            _real_cache_invalidate("nothing:*")
        mock_redis.delete.assert_not_called()

    def test_cache_invalidate_handles_error(self):
        mock_redis = MagicMock()
        mock_redis.keys.side_effect = Exception("conn error")
        with patch.object(cache_module, "_get_redis", return_value=mock_redis):
            _real_cache_invalidate("any:*")
