"""Customer CRUD route tests."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


def _create_customer(name="Empresa Teste", nif="123456789", **kwargs):
    body = {"name": name, "nif": nif, "email": "test@example.com",
            "phone": "912345678", "address": "Rua da Teste 1",
            "postal_code": "1000-001", "city": "Lisboa",
            "country": "PT", **kwargs}
    r = client.post("/api/customers", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# ═══════════════════════════════════════════════════════════════════════
# ── List ──────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_list_customers_empty():
    r = client.get("/api/customers")
    assert r.status_code == 200
    assert r.json() == []


def test_list_customers_after_create():
    _create_customer()
    r = client.get("/api/customers")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_list_customers_search():
    _create_customer(name="ABC Lda")
    r = client.get("/api/customers?search=ABC")
    assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# ── Create ────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_create_customer():
    c = _create_customer()
    assert c["name"] == "Empresa Teste"
    assert c["nif"] == "123456789"
    assert c["id"] > 0


def test_create_customer_minimal():
    body = {"name": "Minimal"}
    r = client.post("/api/customers", json=body)
    assert r.status_code == 200
    assert r.json()["name"] == "Minimal"


# ═══════════════════════════════════════════════════════════════════════
# ── Get ───────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_get_customer():
    c = _create_customer()
    r = client.get(f"/api/customers/{c['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == c["id"]


def test_get_customer_not_found():
    r = client.get("/api/customers/99999")
    assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════
# ── Patch ─────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_patch_customer():
    c = _create_customer()
    r = client.patch(f"/api/customers/{c['id']}", json={"name": "Updated"})
    assert r.status_code == 200
    assert r.json()["name"] == "Updated"


def test_patch_customer_not_found():
    r = client.patch("/api/customers/99999", json={"name": "X"})
    assert r.status_code == 404


# ═══════════════════════════════════════════════════════════════════════
# ── Delete ────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_delete_customer():
    c = _create_customer()
    r = client.delete(f"/api/customers/{c['id']}")
    assert r.status_code == 200


def test_delete_customer_not_found():
    r = client.delete("/api/customers/99999")
    assert r.status_code == 404
