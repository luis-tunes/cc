"""Tests for billing module."""
import pytest

from app.auth import AuthInfo
from app.billing import MASTER_USER_IDS, PLANS, _is_master, _verify_stripe_signature


def test_plans_have_required_fields():
    for p in PLANS:
        assert "id" in p
        assert "name" in p
        assert "price" in p
        assert "docs_per_month" in p
        assert "seats" in p
        assert "features" in p


def test_pro_plan_price():
    pro = next(p for p in PLANS if p["id"] == "pro")
    assert pro["price"] == 15000  # 150 EUR + IVA in cents
    assert pro["seats"] == 5
    assert pro["vat_note"]  # must mention IVA


def test_custom_plan_is_contact():
    custom = next(p for p in PLANS if p["id"] == "custom")
    assert custom["price"] == -1  # no fixed price
    assert custom["seats"] == -1  # unlimited
    assert "contact" in custom


def test_only_two_plans():
    assert len(PLANS) == 2
    assert [p["id"] for p in PLANS] == ["pro", "custom"]


def test_verify_stripe_signature_missing_parts():
    with pytest.raises(ValueError):
        _verify_stripe_signature(b"body", "bad-header")


def test_verify_stripe_signature_no_v1():
    with pytest.raises(ValueError):
        _verify_stripe_signature(b"body", "t=123")


def test_master_user_ids_is_set():
    assert isinstance(MASTER_USER_IDS, set)


def test_is_master_empty_set(monkeypatch):
    monkeypatch.setattr("app.billing.MASTER_USER_IDS", set())
    auth = AuthInfo(user_id="user_123", tenant_id="org_1", email="a@b.com", session_id=None)
    assert _is_master(auth) is False


def test_is_master_by_user_id(monkeypatch):
    monkeypatch.setattr("app.billing.MASTER_USER_IDS", {"user_123"})
    auth = AuthInfo(user_id="user_123", tenant_id="org_1", email="a@b.com", session_id=None)
    assert _is_master(auth) is True


def test_is_master_by_email(monkeypatch):
    monkeypatch.setattr("app.billing.MASTER_USER_IDS", {"boss@example.com"})
    auth = AuthInfo(user_id="user_999", tenant_id="org_1", email="Boss@Example.com", session_id=None)
    assert _is_master(auth) is True


def test_is_master_no_match(monkeypatch):
    monkeypatch.setattr("app.billing.MASTER_USER_IDS", {"other@example.com"})
    auth = AuthInfo(user_id="user_999", tenant_id="org_1", email="me@example.com", session_id=None)
    assert _is_master(auth) is False
