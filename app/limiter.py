"""
Rate limiting middleware using slowapi.
Keyed by tenant_id (from auth) or client IP for unauthenticated endpoints.
"""

import os

from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.requests import Request
from starlette.responses import JSONResponse

# Override default rate via env var (e.g. "120/minute" for higher limits)
DEFAULT_RATE = os.environ.get("RATE_LIMIT_DEFAULT", "60/minute")
AUTH_RATE = os.environ.get("RATE_LIMIT_AUTH", "10/minute")
UPLOAD_RATE = os.environ.get("RATE_LIMIT_UPLOAD", "20/minute")
WEBHOOK_RATE = os.environ.get("RATE_LIMIT_WEBHOOK", "30/minute")


def _key_func(request: Request) -> str:
    """Use tenant_id from auth state if available, else client IP."""
    auth = getattr(request.state, "auth", None)
    if auth and hasattr(auth, "tenant_id"):
        return auth.tenant_id
    return get_remote_address(request)


limiter = Limiter(key_func=_key_func, default_limits=[DEFAULT_RATE])


def rate_limit_exceeded_handler(request: Request, exc: RateLimitExceeded) -> JSONResponse:
    return JSONResponse(
        status_code=429,
        content={"error": "Too many requests", "code": "RATE_LIMITED"},
    )
