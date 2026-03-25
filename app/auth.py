"""
Clerk JWT authentication middleware for FastAPI.
Validates JWTs from Clerk and extracts tenant (org) + user info.

tenant_id is ALWAYS set: uses org_id if present, falls back to user_id (sub).
This guarantees every authenticated request has a non-empty tenant_id for
data isolation.

Usage:
    @router.get("/protected")
    async def protected(auth: AuthInfo = Depends(require_auth)):
        print(auth.user_id, auth.tenant_id)
"""

import logging
import os
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request

logger = logging.getLogger(__name__)

CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "")
CLERK_JWT_ISSUER = os.environ.get("CLERK_JWT_ISSUER", "")  # e.g. https://your-app.clerk.accounts.dev
# For development/testing — set to "1" to skip JWT validation
AUTH_DISABLED = os.environ.get("AUTH_DISABLED", "0") == "1"


@dataclass
class AuthInfo:
    user_id: str
    tenant_id: str  # org_id if present, else user_id — NEVER empty
    email: Optional[str]
    session_id: Optional[str]


def _decode_clerk_jwt(token: str) -> dict:
    """Decode and verify a Clerk-issued JWT."""
    pem = os.environ.get("CLERK_PEM_PUBLIC_KEY", "").replace("\\n", "\n")

    if pem:
        return jwt.decode(
            token,
            pem,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )

    # Fallback: skip verification in dev (when AUTH_DISABLED)
    if AUTH_DISABLED:
        return jwt.decode(token, options={"verify_signature": False})

    raise ValueError("No CLERK_PEM_PUBLIC_KEY configured and AUTH_DISABLED is off")


def _extract_auth(request: Request) -> Optional[AuthInfo]:
    """Extract AuthInfo from the request, or None if no token."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    try:
        payload = _decode_clerk_jwt(token)
    except (jwt.InvalidTokenError, ValueError) as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

    user_id = payload.get("sub", "")
    if not user_id:
        raise HTTPException(status_code=401, detail="Invalid token: missing sub claim")

    # tenant_id: prefer org_id, fall back to user_id — never None/empty
    tenant_id = payload.get("org_id") or user_id

    return AuthInfo(
        user_id=user_id,
        tenant_id=tenant_id,
        email=payload.get("email"),
        session_id=payload.get("sid"),
    )


async def require_auth(request: Request) -> AuthInfo:
    """FastAPI dependency that requires a valid Clerk JWT."""
    if AUTH_DISABLED:
        # In dev/test, return a dummy auth if no token
        auth = _extract_auth(request)
        if auth:
            return auth
        return AuthInfo(user_id="dev-user", tenant_id="dev-tenant", email="dev@tim.pt", session_id=None)

    auth = _extract_auth(request)
    if not auth:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    return auth


async def optional_auth(request: Request) -> Optional[AuthInfo]:
    """FastAPI dependency that optionally extracts auth (for public endpoints)."""
    try:
        return _extract_auth(request)
    except HTTPException:
        return None


def check_auth_config() -> None:
    """Log auth configuration status at startup. Call from lifespan."""
    pem = os.environ.get("CLERK_PEM_PUBLIC_KEY", "")
    if AUTH_DISABLED:
        logger.warning("startup: AUTH_DISABLED=1 — JWT validation is OFF (dev mode)")
    elif not pem:
        logger.critical(
            "startup: CLERK_PEM_PUBLIC_KEY is empty and AUTH_DISABLED=0. "
            "ALL authenticated API calls will fail with 401. "
            "Set CLERK_PEM_PUBLIC_KEY or enable AUTH_DISABLED=1 for development."
        )
    else:
        logger.info("startup: Clerk JWT auth configured (RS256)")
