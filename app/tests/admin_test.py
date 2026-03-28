"""Tests for admin/monitoring endpoints and billing enhancements."""
import os
import sys
from unittest.mock import patch

from fastapi.testclient import TestClient

# Set MASTER_USER_IDS before importing the app so the admin routes pick it up
os.environ["MASTER_USER_IDS"] = "dev-user"

from app.billing import MASTER_USER_IDS, _compute_trial_status, _get_or_create_tenant_plan
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def _tables():
    """Get the _tables dict from the PYTEST-loaded conftest (not app.tests.conftest)."""
    for name, mod in sys.modules.items():
        if name.endswith("conftest") and hasattr(mod, "_tables") and hasattr(mod, "FakeConn"):
            return mod._tables
    raise RuntimeError("conftest _tables not found")


# ── Admin: tenants ────────────────────────────────────────────────────

def test_admin_tenants_lists_tenants():
    tables = _tables()
    # Add a tenant plan
    tables["tenant_plans"].append({
        "tenant_id": "t1",
        "plan": "pro",
        "status": "active",
        "trial_start": None,
        "trial_end": None,
        "stripe_customer": "cus_123",
        "updated_at": "2025-01-01T00:00:00Z",
    })
    r = client.get("/api/admin/tenants")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) >= 1
    t = data[0]
    assert t["tenant_id"] == "t1"
    assert t["plan"] == "pro"


def test_admin_tenants_forbidden_non_admin():
    """Non-master users should get 403."""
    # Temporarily clear MASTER_USER_IDS
    import app.routes as routes_mod
    original = routes_mod._MASTER_USER_IDS
    routes_mod._MASTER_USER_IDS = {"some-other-user"}
    try:
        r = client.get("/api/admin/tenants")
        assert r.status_code == 403
    finally:
        routes_mod._MASTER_USER_IDS = original


# ── Admin: system health ──────────────────────────────────────────────

def test_admin_system_health():
    r = client.get("/api/admin/system-health")
    assert r.status_code == 200
    data = r.json()
    assert "status" in data
    assert "services" in data
    assert "postgresql" in data["services"]
    assert "redis" in data["services"]
    assert "paperless" in data["services"]


# ── Admin: metrics ────────────────────────────────────────────────────

def test_admin_metrics():
    r = client.get("/api/admin/metrics")
    assert r.status_code == 200
    data = r.json()
    assert "total_tenants" in data
    assert "pro_tenants" in data
    assert "total_documents" in data
    assert "docs_last_30d" in data


# ── Billing: portal ───────────────────────────────────────────────────

def test_billing_portal_no_customer():
    """Portal should fail if no stripe_customer."""
    r = client.post("/api/billing/portal")
    assert r.status_code == 400
    assert "subscrição" in r.json()["detail"].lower() or "stripe" in r.json()["detail"].lower()


@patch("app.billing._stripe")
def test_billing_portal_success(mock_stripe):
    """Portal with existing stripe_customer should return portal URL."""
    tables = _tables()
    tables["tenant_plans"].append({
        "tenant_id": "dev-tenant",
        "plan": "pro",
        "status": "active",
        "trial_start": None,
        "trial_end": None,
        "stripe_customer": "cus_test_123",
        "updated_at": None,
    })
    mock_stripe.return_value = {"url": "https://billing.stripe.com/session/abc"}
    r = client.post("/api/billing/portal")
    assert r.status_code == 200
    assert "portal_url" in r.json()
    assert r.json()["portal_url"].startswith("https://")


# ── Billing: require_pro enforcement ──────────────────────────────────

def test_require_pro_allows_master():
    """MASTER_USER_IDS should always pass."""
    assert "dev-user" in MASTER_USER_IDS or os.environ.get("AUTH_DISABLED") == "1"


def test_require_pro_allows_pro_plan():
    """Pro plan tenants should pass."""
    tables = _tables()
    tables["tenant_plans"].append({
        "tenant_id": "dev-tenant",
        "plan": "pro",
        "status": "active",
        "trial_start": None,
        "trial_end": None,
        "stripe_customer": "cus_123",
    })
    info = _get_or_create_tenant_plan("dev-tenant")
    computed = _compute_trial_status(info)
    assert computed["status"] == "active"


def test_require_pro_rejects_expired():
    """Expired trial should be rejected."""
    from datetime import UTC, datetime, timedelta

    tables = _tables()
    tables["tenant_plans"].append({
        "tenant_id": "expired-tenant",
        "plan": "free",
        "status": "trial_expired",
        "trial_start": datetime.now(UTC) - timedelta(days=30),
        "trial_end": datetime.now(UTC) - timedelta(days=16),
        "stripe_customer": None,
    })
    info = _get_or_create_tenant_plan("expired-tenant")
    computed = _compute_trial_status(info)
    assert computed["status"] == "trial_expired"
