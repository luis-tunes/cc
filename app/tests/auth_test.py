import pytest
from unittest.mock import patch, MagicMock
from fastapi import HTTPException
from app.auth import AuthInfo, _extract_auth, _decode_clerk_jwt


def _make_request(auth_header: str = ""):
    req = MagicMock()
    req.headers = {"Authorization": auth_header} if auth_header else {}
    return req


def test_extract_auth_no_header():
    req = _make_request()
    assert _extract_auth(req) is None


def test_extract_auth_bad_prefix():
    req = _make_request("Basic abc")
    assert _extract_auth(req) is None


@patch("app.auth._decode_clerk_jwt")
def test_extract_auth_valid_token(mock_decode):
    mock_decode.return_value = {
        "sub": "user_123",
        "org_id": "org_456",
        "email": "a@b.pt",
        "sid": "sess_789",
    }
    req = _make_request("Bearer fake-token")
    auth = _extract_auth(req)
    assert auth is not None
    assert auth.user_id == "user_123"
    assert auth.tenant_id == "org_456"
    assert auth.email == "a@b.pt"
    assert auth.session_id == "sess_789"


@patch("app.auth._decode_clerk_jwt")
def test_extract_auth_no_org(mock_decode):
    mock_decode.return_value = {"sub": "user_1", "email": "x@y.pt"}
    req = _make_request("Bearer tok")
    auth = _extract_auth(req)
    assert auth is not None
    # Without org_id, tenant_id falls back to user_id
    assert auth.tenant_id == "user_1"


@patch("app.auth._decode_clerk_jwt", side_effect=Exception("bad"))
def test_extract_auth_invalid_token(mock_decode):
    import jwt as pyjwt
    with patch("app.auth._decode_clerk_jwt", side_effect=pyjwt.InvalidTokenError("bad")):
        req = _make_request("Bearer invalid")
        with pytest.raises(HTTPException) as exc:
            _extract_auth(req)
        assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_require_auth_dev_mode():
    with patch("app.auth.AUTH_DISABLED", True):
        from app.auth import require_auth
        req = _make_request()
        auth = await require_auth(req)
        assert auth.user_id == "dev-user"
        assert auth.tenant_id == "dev-tenant"


@pytest.mark.asyncio
async def test_require_auth_no_token():
    with patch("app.auth.AUTH_DISABLED", False):
        from app.auth import require_auth
        req = _make_request()
        with pytest.raises(HTTPException) as exc:
            await require_auth(req)
        assert exc.value.status_code == 401


@pytest.mark.asyncio
async def test_optional_auth_no_token():
    from app.auth import optional_auth
    req = _make_request()
    auth = await optional_auth(req)
    assert auth is None


def test_auth_info_dataclass():
    info = AuthInfo(user_id="u1", tenant_id="t1", email="a@b.c", session_id="s1")
    assert info.user_id == "u1"
    assert info.tenant_id == "t1"
