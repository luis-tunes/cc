"""Tests for billing module."""
import json
from unittest.mock import patch, MagicMock
from app.billing import PLANS, _tenant_plans, _verify_stripe_signature
import pytest


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


def test_tenant_plan_cache():
    _tenant_plans["test-org"] = {"plan": "pro", "status": "active"}
    assert _tenant_plans["test-org"]["plan"] == "pro"
    del _tenant_plans["test-org"]


def test_verify_stripe_signature_missing_parts():
    with pytest.raises(ValueError):
        _verify_stripe_signature(b"body", "bad-header")


def test_verify_stripe_signature_no_v1():
    with pytest.raises(ValueError):
        _verify_stripe_signature(b"body", "t=123")
