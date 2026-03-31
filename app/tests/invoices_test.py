"""Invoice routes tests — series, CRUD, finalize, void, payments, SAF-T."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


# ═══════════════════════════════════════════════════════════════════════
# ── Helpers ───────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def _create_series(code="FT", doc_type="FT"):
    body = {"series_code": code, "document_type": doc_type}
    r = client.post("/api/invoice-series", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _create_customer():
    body = {"name": "Cliente Teste", "nif": "999999990"}
    r = client.post("/api/customers", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _create_invoice(series_id=None, customer_id=None, lines=None, **kwargs):
    if series_id is None:
        series_id = _create_series()["id"]
    body = {
        "series_id": series_id,
        "customer_id": customer_id,
        "customer_name": kwargs.get("customer_name", "Cliente Teste"),
        "customer_nif": kwargs.get("customer_nif", "999999990"),
        "issue_date": kwargs.get("issue_date", "2024-06-15"),
        "due_date": kwargs.get("due_date", "2024-07-15"),
        "lines": lines or [
            {"description": "Servico A", "quantity": 2, "unit_price": 100,
             "vat_rate": 23, "discount_pct": 0},
        ],
    }
    r = client.post("/api/invoices", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# ═══════════════════════════════════════════════════════════════════════
# ── Invoice Series ────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_list_series_empty():
    r = client.get("/api/invoice-series")
    assert r.status_code == 200
    assert r.json() == []


def test_create_series():
    s = _create_series()
    assert s["series_code"] == "FT"
    assert s["id"] > 0


# ═══════════════════════════════════════════════════════════════════════
# ── Invoice CRUD ──────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_create_invoice():
    inv = _create_invoice()
    assert inv["id"] > 0
    assert inv["status"] == "rascunho"
    assert "total" in inv


def test_create_invoice_with_customer():
    cust = _create_customer()
    inv = _create_invoice(customer_id=cust["id"])
    assert inv["customer_id"] == cust["id"]


def test_list_invoices_empty():
    r = client.get("/api/invoices")
    assert r.status_code == 200
    assert r.json() == []


def test_list_invoices():
    _create_invoice()
    r = client.get("/api/invoices")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1


def test_get_invoice():
    inv = _create_invoice()
    r = client.get(f"/api/invoices/{inv['id']}")
    assert r.status_code == 200
    assert r.json()["id"] == inv["id"]


def test_get_invoice_not_found():
    r = client.get("/api/invoices/99999")
    assert r.status_code == 404


def test_patch_invoice():
    inv = _create_invoice()
    r = client.patch(f"/api/invoices/{inv['id']}",
                     json={"notes": "Updated notes"})
    assert r.status_code == 200


def test_delete_invoice_draft():
    inv = _create_invoice()
    r = client.delete(f"/api/invoices/{inv['id']}")
    assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# ── Finalize / Void ───────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_finalize_invoice():
    inv = _create_invoice()
    r = client.post(f"/api/invoices/{inv['id']}/finalize")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "emitida"


def test_finalize_already_finalized():
    inv = _create_invoice()
    client.post(f"/api/invoices/{inv['id']}/finalize")
    r = client.post(f"/api/invoices/{inv['id']}/finalize")
    assert r.status_code == 400


def test_void_invoice():
    inv = _create_invoice()
    client.post(f"/api/invoices/{inv['id']}/finalize")
    r = client.post(f"/api/invoices/{inv['id']}/void")
    assert r.status_code == 200
    assert r.json()["status"] == "anulada"


def test_void_already_voided_fails():
    inv = _create_invoice()
    client.post(f"/api/invoices/{inv['id']}/void")
    r = client.post(f"/api/invoices/{inv['id']}/void")
    assert r.status_code == 400


def test_delete_finalized_fails():
    inv = _create_invoice()
    client.post(f"/api/invoices/{inv['id']}/finalize")
    r = client.delete(f"/api/invoices/{inv['id']}")
    assert r.status_code == 400


# ═══════════════════════════════════════════════════════════════════════
# ── Payments ──────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_list_payments_empty():
    inv = _create_invoice()
    r = client.get(f"/api/invoices/{inv['id']}/payments")
    assert r.status_code == 200
    assert r.json() == []


def test_create_payment():
    inv = _create_invoice()
    client.post(f"/api/invoices/{inv['id']}/finalize")
    body = {"amount": "50", "payment_date": "2024-07-01", "method": "transferencia"}
    r = client.post(f"/api/invoices/{inv['id']}/payments", json=body)
    assert r.status_code == 200
    assert r.json()["id"] > 0


def test_delete_payment():
    inv = _create_invoice()
    client.post(f"/api/invoices/{inv['id']}/finalize")
    body = {"amount": "50", "payment_date": "2024-07-01", "method": "transferencia"}
    pay = client.post(f"/api/invoices/{inv['id']}/payments", json=body).json()
    r = client.delete(f"/api/invoices/{inv['id']}/payments/{pay['id']}")
    assert r.status_code == 200


# ═══════════════════════════════════════════════════════════════════════
# ── Summary & Aged Receivables ────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_invoice_summary():
    r = client.get("/api/invoices/summary")
    assert r.status_code == 200
    data = r.json()
    assert "by_status" in data


def test_aged_receivables():
    r = client.get("/api/invoices/aged-receivables")
    assert r.status_code == 200
    data = r.json()
    assert "current" in data
    assert "total_outstanding" in data


# ═══════════════════════════════════════════════════════════════════════
# ── Invoice HTML ──────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_invoice_html():
    inv = _create_invoice()
    r = client.get(f"/api/invoices/{inv['id']}/html")
    assert r.status_code == 200
    assert "text/html" in r.headers["content-type"]


# ═══════════════════════════════════════════════════════════════════════
# ── SAF-T Export ──────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_saft_export():
    r = client.get("/api/export/saft?year=2024")
    assert r.status_code == 200
    assert "xml" in r.headers["content-type"]
