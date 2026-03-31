"""
Multi-tenant isolation tests.
Verify that data created by tenant-A is invisible to tenant-B
across all major entity types.
"""
import base64
import json
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def _jwt_for(tenant_id: str, user_id: str = "user-1") -> dict:
    """Create a minimal unsigned JWT for a given tenant (AUTH_DISABLED allows this)."""
    payload = {"sub": user_id, "org_id": tenant_id, "email": f"{user_id}@test.pt"}
    # Build a proper unsigned JWT (header.payload.signature)
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    return {"Authorization": f"Bearer {header}.{body}."}


TENANT_A = _jwt_for("tenant-alpha")
TENANT_B = _jwt_for("tenant-beta")


# ── Suppliers ─────────────────────────────────────────────────────────

def test_suppliers_isolated():
    r = client.post("/api/suppliers", json={"name": "Fornecedor A", "nif": "123456789"}, headers=TENANT_A)
    assert r.status_code == 200

    # tenant-B sees no suppliers
    r = client.get("/api/suppliers", headers=TENANT_B)
    assert r.status_code == 200
    assert r.json() == []

    # tenant-A sees its supplier
    r = client.get("/api/suppliers", headers=TENANT_A)
    assert r.status_code == 200
    assert len(r.json()) == 1
    assert r.json()[0]["name"] == "Fornecedor A"


# ── Documents ─────────────────────────────────────────────────────────

def test_documents_isolated():
    with patch("app.routes_documents.httpx.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_post.return_value = mock_resp
        r = client.post(
            "/api/documents/upload",
            files={"file": ("doc.pdf", b"%PDF-1", "application/pdf")},
            headers=TENANT_A,
        )
        assert r.status_code == 200

    # tenant-B sees nothing
    r = client.get("/api/documents", headers=TENANT_B)
    assert r.status_code == 200
    assert r.json() == []

    # tenant-A sees its document
    r = client.get("/api/documents", headers=TENANT_A)
    assert r.status_code == 200
    assert len(r.json()) == 1


# ── Bank transactions ────────────────────────────────────────────────

def test_bank_transactions_isolated():
    csv = "date;description;amount\n2026-01-01;Pagamento;-50,00\n"
    r = client.post(
        "/api/bank-transactions/upload",
        files={"file": ("bank.csv", csv.encode(), "text/csv")},
        headers=TENANT_A,
    )
    assert r.status_code == 200

    # tenant-B sees nothing
    r = client.get("/api/bank-transactions", headers=TENANT_B)
    assert r.status_code == 200
    assert r.json() == []

    # tenant-A sees its transaction
    r = client.get("/api/bank-transactions", headers=TENANT_A)
    assert r.status_code == 200
    assert len(r.json()) == 1


# ── Ingredients ───────────────────────────────────────────────────────

def test_ingredients_isolated():
    # Need a unit family first
    r = client.post("/api/unit-families", json={"name": "Peso", "base_unit": "kg"}, headers=TENANT_A)
    assert r.status_code == 200

    r = client.post("/api/ingredients", json={"name": "Farinha", "category": "secos", "unit": "kg"}, headers=TENANT_A)
    assert r.status_code == 200

    # tenant-B sees nothing
    r = client.get("/api/ingredients", headers=TENANT_B)
    assert r.status_code == 200
    assert r.json() == []

    # tenant-A sees its ingredient
    r = client.get("/api/ingredients", headers=TENANT_A)
    assert r.status_code == 200
    assert len(r.json()) == 1


# ── Products ──────────────────────────────────────────────────────────

def test_products_isolated():
    r = client.post("/api/products", json={"code": "P001", "name": "Bolo", "category": "doces"}, headers=TENANT_A)
    assert r.status_code == 200

    # tenant-B sees nothing
    r = client.get("/api/products", headers=TENANT_B)
    assert r.status_code == 200
    assert r.json() == []

    # tenant-A sees its product
    r = client.get("/api/products", headers=TENANT_A)
    assert r.status_code == 200
    assert len(r.json()) == 1


# ── Reconciliation ───────────────────────────────────────────────────

def test_reconciliation_isolated():
    """Reconciliation only matches within the same tenant."""
    # tenant-A: upload doc + bank tx
    with patch("app.routes_documents.httpx.post") as mock_post:
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_post.return_value = mock_resp
        r = client.post(
            "/api/documents/upload",
            files={"file": ("f.pdf", b"%PDF-1", "application/pdf")},
            headers=TENANT_A,
        )
        doc_id = r.json()["id"]

    client.patch(f"/api/documents/{doc_id}", json={
        "total": 100.00, "date": "2026-01-01", "status": "extraído",
    }, headers=TENANT_A)

    # tenant-B uploads a matching bank tx
    csv = "date;description;amount\n2026-01-01;Pagamento;-100,00\n"
    client.post(
        "/api/bank-transactions/upload",
        files={"file": ("b.csv", csv.encode(), "text/csv")},
        headers=TENANT_B,
    )

    # Reconcile as tenant-A → 0 matches (bank tx belongs to tenant-B)
    r = client.post("/api/reconcile", headers=TENANT_A)
    assert r.status_code == 200
    assert r.json()["matched"] == 0

    # Reconcile as tenant-B → 0 matches (doc belongs to tenant-A)
    r = client.post("/api/reconcile", headers=TENANT_B)
    assert r.status_code == 200
    assert r.json()["matched"] == 0


# ── Entity profile ───────────────────────────────────────────────────

def test_entity_profile_isolated():
    r = client.put("/api/entity", json={
        "name": "Empresa Alpha", "nif": "123456789",
    }, headers=TENANT_A)
    assert r.status_code == 200

    # tenant-B sees empty entity
    r = client.get("/api/entity", headers=TENANT_B)
    assert r.status_code == 200
    assert r.json() == {}

    # tenant-A sees its entity
    r = client.get("/api/entity", headers=TENANT_A)
    assert r.status_code == 200
    assert r.json()["name"] == "Empresa Alpha"


# ── Billing status ───────────────────────────────────────────────────

def test_billing_status_per_tenant():
    """Each tenant gets independent billing/trial status."""
    r1 = client.get("/api/billing/status", headers=TENANT_A)
    assert r1.status_code == 200
    assert r1.json()["plan"] == "free"

    r2 = client.get("/api/billing/status", headers=TENANT_B)
    assert r2.status_code == 200
    assert r2.json()["plan"] == "free"

    # They should have independent trial entries
    import sys
    tables = sys.modules["tests.conftest"].get_tables()
    plans = tables["tenant_plans"]
    tids = {p["tenant_id"] for p in plans}
    assert "tenant-alpha" in tids
    assert "tenant-beta" in tids
