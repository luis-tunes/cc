"""Tests for app/limiter.py — rate limiting configuration."""

from unittest.mock import MagicMock

from starlette.requests import Request

from app.limiter import _key_func, rate_limit_exceeded_handler


class TestKeyFunc:
    def test_returns_tenant_id_when_auth_present(self):
        request = MagicMock(spec=Request)
        auth = MagicMock()
        auth.tenant_id = "org_abc123"
        request.state.auth = auth
        assert _key_func(request) == "org_abc123"

    def test_falls_back_to_ip_when_no_auth(self):
        request = MagicMock(spec=Request)
        request.state.auth = None
        request.client.host = "192.168.1.1"
        # _key_func calls get_remote_address which reads request.client
        result = _key_func(request)
        # Should be the IP address (from get_remote_address)
        assert result == "192.168.1.1"

    def test_falls_back_to_ip_when_no_auth_attr(self):
        request = MagicMock(spec=Request)
        request.state = MagicMock(spec=[])  # No auth attribute
        request.client.host = "10.0.0.1"
        result = _key_func(request)
        assert result == "10.0.0.1"


class TestRateLimitExceededHandler:
    def test_returns_429_json(self):
        request = MagicMock(spec=Request)
        exc = MagicMock()
        response = rate_limit_exceeded_handler(request, exc)
        assert response.status_code == 429
        import json
        body = json.loads(response.body)
        assert body["error"] == "Too many requests"
        assert body["code"] == "RATE_LIMITED"
