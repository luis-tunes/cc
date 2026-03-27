"""
Billing webhook and checkout tests.
Tests Stripe webhook signature verification, checkout.session.completed,
and customer.subscription.deleted flows.
"""
import hashlib
import hmac
import json
import time
from datetime import UTC

import pytest
from fastapi.testclient import TestClient
from httpx import Response

from app.billing import _compute_trial_status, _verify_stripe_signature
from app.main import app

client = TestClient(app, raise_server_exceptions=False)

WEBHOOK_SECRET = "whsec_test_secret_for_tests"


def _stripe_sig(payload: bytes, secret: str = WEBHOOK_SECRET) -> str:
    """Generate a valid Stripe webhook signature header."""
    ts = str(int(time.time()))
    signed = f"{ts}.".encode() + payload
    sig = hmac.new(secret.encode(), signed, hashlib.sha256).hexdigest()
    return f"t={ts},v1={sig}"


def _send_webhook(event_type: str, data: dict) -> "Response":
    """Send a simulated Stripe webhook event."""
    event = {"type": event_type, "data": {"object": data}}
    body = json.dumps(event).encode()
    sig = _stripe_sig(body)
    with _patch_webhook_secret():
        return client.post(
            "/api/billing/webhook",
            content=body,
            headers={
                "Content-Type": "application/json",
                "stripe-signature": sig,
            },
        )


def _patch_webhook_secret():
    from unittest.mock import patch
    return patch("app.billing.STRIPE_WEBHOOK_SECRET", WEBHOOK_SECRET)


# ── Signature verification ────────────────────────────────────────────

def test_verify_valid_signature():
    payload = b'{"type":"test"}'
    sig = _stripe_sig(payload)
    with _patch_webhook_secret():
        # Should not raise
        _verify_stripe_signature(payload, sig)


def test_verify_invalid_signature():
    payload = b'{"type":"test"}'
    sig = _stripe_sig(payload, secret="wrong-secret")
    with _patch_webhook_secret(), pytest.raises(ValueError, match="Signature mismatch"):
        _verify_stripe_signature(payload, sig)


def test_verify_missing_timestamp():
    with pytest.raises(ValueError):
        _verify_stripe_signature(b"body", "v1=abc123")


def test_verify_missing_v1():
    with pytest.raises(ValueError):
        _verify_stripe_signature(b"body", "t=12345")


# ── checkout.session.completed ────────────────────────────────────────

def test_checkout_completed_activates_pro():
    """checkout.session.completed sets tenant plan to 'pro'."""
    r = _send_webhook("checkout.session.completed", {
        "metadata": {"tenant_id": "tenant-checkout-test"},
        "customer": "cus_test123",
    })
    assert r.status_code == 200
    assert r.json()["received"] is True

    # Verify plan was set
    import sys
    tables = sys.modules["tests.conftest"].get_tables()
    plan = next((p for p in tables["tenant_plans"] if p["tenant_id"] == "tenant-checkout-test"), None)
    assert plan is not None
    assert plan["plan"] == "pro"
    assert plan["status"] == "active"
    assert plan["stripe_customer"] == "cus_test123"


def test_checkout_completed_no_tenant_id():
    """checkout.session.completed without tenant_id does nothing."""
    r = _send_webhook("checkout.session.completed", {
        "metadata": {},
        "customer": "cus_orphan",
    })
    assert r.status_code == 200

    import sys
    tables = sys.modules["tests.conftest"].get_tables()
    # No plan should be created for empty tenant
    assert not any(p.get("stripe_customer") == "cus_orphan" for p in tables["tenant_plans"])


# ── customer.subscription.deleted ─────────────────────────────────────

def test_subscription_deleted_downgrades():
    """customer.subscription.deleted sets plan back to 'free'."""
    # First activate pro
    _send_webhook("checkout.session.completed", {
        "metadata": {"tenant_id": "tenant-cancel-test"},
        "customer": "cus_cancel123",
    })

    # Then cancel
    r = _send_webhook("customer.subscription.deleted", {
        "customer": "cus_cancel123",
    })
    assert r.status_code == 200

    import sys
    tables = sys.modules["tests.conftest"].get_tables()
    plan = next((p for p in tables["tenant_plans"] if p["tenant_id"] == "tenant-cancel-test"), None)
    assert plan is not None
    assert plan["plan"] == "free"
    assert plan["status"] == "cancelled"


def test_subscription_deleted_unknown_customer():
    """Deleting unknown customer does nothing (no error)."""
    r = _send_webhook("customer.subscription.deleted", {
        "customer": "cus_nonexistent",
    })
    assert r.status_code == 200


# ── Unknown event type ────────────────────────────────────────────────

def test_webhook_unknown_event():
    """Unknown event types are accepted but ignored."""
    r = _send_webhook("payment_intent.succeeded", {"id": "pi_123"})
    assert r.status_code == 200
    assert r.json()["received"] is True


# ── Webhook with invalid signature ───────────────────────────────────

def test_webhook_invalid_signature_rejected():
    """Webhook with bad signature returns 400."""
    event = {"type": "test", "data": {"object": {}}}
    body = json.dumps(event).encode()
    bad_sig = "t=123,v1=invalid_hex_signature"
    with _patch_webhook_secret():
        r = client.post(
            "/api/billing/webhook",
            content=body,
            headers={
                "Content-Type": "application/json",
                "stripe-signature": bad_sig,
            },
        )
    assert r.status_code == 400


# ── Plan listing ──────────────────────────────────────────────────────

def test_plans_endpoint():
    r = client.get("/api/billing/plans")
    assert r.status_code == 200
    plans = r.json()
    assert len(plans) == 2
    pro = next(p for p in plans if p["id"] == "pro")
    assert pro["price"] == 15000
    assert pro["seats"] == 5


# ── Trial computation ────────────────────────────────────────────────

def test_trial_active():
    from datetime import datetime, timedelta
    now = datetime.now(UTC)
    info = {
        "tenant_id": "t1",
        "plan": "free",
        "status": "trialing",
        "trial_end": now + timedelta(days=7, hours=1),
        "stripe_customer": None,
    }
    result = _compute_trial_status(info)
    assert result["status"] == "trialing"
    assert result["trial_days_left"] == 7


def test_trial_expired():
    from datetime import datetime, timedelta
    now = datetime.now(UTC)
    info = {
        "tenant_id": "t-expired",
        "plan": "free",
        "status": "trialing",
        "trial_end": now - timedelta(days=1),
        "stripe_customer": None,
    }
    result = _compute_trial_status(info)
    assert result["status"] == "trial_expired"
    assert result["trial_days_left"] == 0


def test_pro_plan_always_active():
    info = {
        "tenant_id": "t-pro",
        "plan": "pro",
        "status": "active",
        "trial_end": None,
        "stripe_customer": "cus_abc",
    }
    result = _compute_trial_status(info)
    assert result["status"] == "active"
