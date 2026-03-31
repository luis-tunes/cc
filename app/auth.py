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

__fingerprint__ = "TIM-LT-7f1b3d5e-9a24-4c86-b7e3-d1f5a9c2b468"

import datetime
import logging
import os
from dataclasses import dataclass

import jwt
from fastapi import HTTPException, Request

logger = logging.getLogger(__name__)

CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "")
CLERK_JWT_ISSUER = os.environ.get("CLERK_JWT_ISSUER", "")  # e.g. https://your-app.clerk.accounts.dev
# For development/testing — set to "1" to skip JWT validation
AUTH_DISABLED = os.environ.get("AUTH_DISABLED", "0") == "1"

# Cache for JWKS public key fetched from Clerk
_jwks_client: "jwt.PyJWKClient | None" = None


def _get_jwks_client() -> "jwt.PyJWKClient":
    """Lazily create a PyJWKClient that fetches keys from Clerk's JWKS endpoint."""
    global _jwks_client
    if _jwks_client is None:
        # Clerk's JWKS endpoint is always at this URL for the frontend API key domain
        # Extract the Clerk frontend API domain from the publishable key or use a well-known URL
        clerk_pk = os.environ.get("VITE_CLERK_PUBLISHABLE_KEY", "")
        if clerk_pk.startswith("pk_"):
            # pk_live_Y2xlcmsueHRpbS5haSQ → base64 decode the suffix to get the domain
            import base64
            try:
                domain = base64.b64decode(clerk_pk.split("_", 2)[2] + "==").decode().rstrip("$")
                jwks_url = f"https://{domain}/.well-known/jwks.json"
            except Exception:
                jwks_url = ""
        else:
            jwks_url = ""

        if not jwks_url:
            raise ValueError("Cannot determine Clerk JWKS URL — set CLERK_PEM_PUBLIC_KEY or VITE_CLERK_PUBLISHABLE_KEY")

        logger.info("Clerk JWKS URL: %s", jwks_url)
        _jwks_client = jwt.PyJWKClient(jwks_url, cache_keys=True, lifespan=3600)
    return _jwks_client


@dataclass
class AuthInfo:
    user_id: str
    tenant_id: str  # org_id if present, else user_id — NEVER empty
    email: str | None
    session_id: str | None


def _decode_clerk_jwt(token: str) -> dict:
    """Decode and verify a Clerk-issued JWT."""
    pem = os.environ.get("CLERK_PEM_PUBLIC_KEY", "").replace("\\n", "\n").strip()

    if pem and pem.startswith("-----BEGIN"):
        return jwt.decode(
            token,
            pem,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )

    # Auto-fetch public key from Clerk's JWKS endpoint
    try:
        client = _get_jwks_client()
        signing_key = client.get_signing_key_from_jwt(token)
        return jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False, "verify_exp": True},
            leeway=datetime.timedelta(seconds=10),
        )
    except jwt.ExpiredSignatureError:
        raise  # let caller handle as 401
    except jwt.InvalidTokenError:
        raise  # bad token — propagate
    except ValueError:
        pass  # JWKS not available, fall through
    except Exception as e:
        logger.warning("JWKS fetch failed: %s", e)

    # Fallback: skip verification in dev (when AUTH_DISABLED)
    if AUTH_DISABLED:
        return jwt.decode(token, options={"verify_signature": False})

    raise ValueError("No CLERK_PEM_PUBLIC_KEY configured, JWKS fetch failed, and AUTH_DISABLED is off")


def _extract_auth(request: Request) -> AuthInfo | None:
    """Extract AuthInfo from the request, or None if no token."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None

    token = auth_header[7:]
    try:
        payload = _decode_clerk_jwt(token)
    except (jwt.InvalidTokenError, ValueError) as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}") from e

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
            request.state.tenant_id = auth.tenant_id
            request.state.user_id = auth.user_id
            return auth
        auth = AuthInfo(user_id="dev-user", tenant_id="dev-tenant", email="dev@tim.pt", session_id=None)
        request.state.tenant_id = auth.tenant_id
        request.state.user_id = auth.user_id
        return auth

    auth = _extract_auth(request)
    if not auth:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    request.state.tenant_id = auth.tenant_id
    request.state.user_id = auth.user_id
    return auth


async def optional_auth(request: Request) -> AuthInfo | None:
    """FastAPI dependency that optionally extracts auth (for public endpoints)."""
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return None
    # Token is present — invalid/expired tokens should still raise 401
    auth = _extract_auth(request)
    if auth:
        request.state.tenant_id = auth.tenant_id
        request.state.user_id = auth.user_id
    return auth


def check_auth_config() -> None:
    """Log auth configuration status at startup. Call from lifespan."""
    pem = os.environ.get("CLERK_PEM_PUBLIC_KEY", "").strip()
    pk = os.environ.get("VITE_CLERK_PUBLISHABLE_KEY", "")
    has_pem = pem.startswith("-----BEGIN")
    if AUTH_DISABLED:
        logger.warning("startup: AUTH_DISABLED=1 — JWT validation is OFF (dev mode)")
    elif has_pem:
        logger.info("startup: Clerk JWT auth configured (RS256 PEM)")
    elif pk:
        logger.info("startup: Clerk JWT auth configured (JWKS auto-fetch from %s)", pk[:20])
    else:
        logger.critical(
            "startup: No CLERK_PEM_PUBLIC_KEY and no VITE_CLERK_PUBLISHABLE_KEY. "
            "Auth will fail. Set one of them or enable AUTH_DISABLED=1 for dev."
        )
