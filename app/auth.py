"""
Clerk JWT authentication middleware for FastAPI.
Validates JWTs from Clerk and extracts tenant (org) + user info.

Usage:
    @router.get("/protected")
    async def protected(auth: AuthInfo = Depends(require_auth)):
        print(auth.user_id, auth.tenant_id)
"""

import os
from dataclasses import dataclass
from typing import Optional

import jwt
from fastapi import Depends, HTTPException, Request

CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "")
CLERK_JWT_ISSUER = os.environ.get("CLERK_JWT_ISSUER", "")  # e.g. https://your-app.clerk.accounts.dev
# For development/testing — set to "1" to skip JWT validation
AUTH_DISABLED = os.environ.get("AUTH_DISABLED", "0") == "1"


@dataclass
class AuthInfo:
    user_id: str
    tenant_id: Optional[str]  # Clerk org_id — None if personal account
    email: Optional[str]
    session_id: Optional[str]


def _decode_clerk_jwt(token: str) -> dict:
    """Decode and verify a Clerk-issued JWT."""
    # Clerk JWTs are signed with the instance's RSA key.
    # The public key can be fetched from JWKS, but for simplicity
    # we use the PEM from CLERK_PEM_PUBLIC_KEY env var, or fall back
    # to HS256 with the secret key (Clerk supports both).
    pem = os.environ.get("CLERK_PEM_PUBLIC_KEY", "")

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

    return AuthInfo(
        user_id=payload.get("sub", ""),
        tenant_id=payload.get("org_id"),
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
