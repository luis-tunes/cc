"""
Comprehensive API route tests.
Uses shared FakeConn from conftest.py — no PostgreSQL needed.
"""
import pytest
from unittest.mock import patch, MagicMock

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


# ── Health ────────────────────────────────────────────────────────────

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


# ── Documents CRUD ────────────────────────────────────────────────────

def test_list_documents():
    r = client.get("/api/documents")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_list_documents_with_filters():
    r = client.get("/api/documents?status=pendente&limit=5&offset=0")
    assert r.status_code == 200


def test_get_document_not_found():
    r = client.get("/api/documents/999999")
    assert r.status_code == 404


def test_upload_rejects_non_pdf():
    r = client.post(
        "/api/documents/upload",
        files={"file": ("test.txt", b"not a pdf", "text/plain")},
    )
    assert r.status_code == 422
    assert "PDF" in r.json()["detail"]


@patch("app.routes.httpx.post")
def test_upload_document_success(mock_post):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_resp.text = "ok"
    mock_post.return_value = mock_resp

    r = client.post(
        "/api/documents/upload",
        files={"file": ("invoice.pdf", b"%PDF-fake", "application/pdf")},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["filename"] == "invoice.pdf"
    assert "id" in data


def test_patch_document_no_fields():
    r = client.patch("/api/documents/1", json={})
    assert r.status_code == 422


@patch("app.routes.httpx.post")
def test_create_and_patch_document(mock_post):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_post.return_value = mock_resp

    r = client.post(
        "/api/documents/upload",
        files={"file": ("test.pdf", b"%PDF-1", "application/pdf")},
    )
    assert r.status_code == 200
    doc_id = r.json()["id"]

    r = client.patch(f"/api/documents/{doc_id}", json={"status": "classificado"})
    assert r.status_code == 200
    assert r.json()["status"] == "classificado"


# ── Bank Transactions ─────────────────────────────────────────────────

def test_list_bank_transactions():
    r = client.get("/api/bank-transactions")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_upload_bank_csv_missing_columns():
    csv_data = "foo;bar\n1;2\n"
    r = client.post(
        "/api/bank-transactions/upload",
        files={"file": ("bad.csv", csv_data.encode(), "text/csv")},
    )
    assert r.status_code == 422
    assert "columns" in r.json()["detail"]


def test_upload_bank_csv_success():
    csv_data = "date;description;amount\n2026-03-01;Pagamento Fornecedor;-150,50\n2026-03-02;Receita Cliente;1200,00\n"
    r = client.post(
        "/api/bank-transactions/upload",
        files={"file": ("bank.csv", csv_data.encode(), "text/csv")},
    )
    assert r.status_code == 200
    assert r.json()["imported"] == 2


def test_bank_transactions_date_filter():
    r = client.get("/api/bank-transactions?date_from=2026-03-01&date_to=2026-03-02")
    assert r.status_code == 200


# ── Reconciliation ────────────────────────────────────────────────────

def test_list_reconciliations():
    r = client.get("/api/reconciliations")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


def test_run_reconciliation():
    r = client.post("/api/reconcile")
    assert r.status_code == 200
    data = r.json()
    assert "matched" in data
    assert "matches" in data


# ── Dashboard ─────────────────────────────────────────────────────────

def test_dashboard_summary():
    r = client.get("/api/dashboard/summary")
    assert r.status_code == 200
    data = r.json()
    assert "documents" in data
    assert "bank_transactions" in data
    assert "reconciliations" in data
    assert "unmatched_documents" in data
    assert "pending_review" in data
    assert "classified" in data


def test_dashboard_monthly():
    r = client.get("/api/dashboard/monthly")
    assert r.status_code == 200
    assert isinstance(r.json(), list)


# ── Export ─────────────────────────────────────────────────────────────

def test_export_csv():
    r = client.get("/api/export/csv")
    assert r.status_code == 200
    assert "text/csv" in r.headers["content-type"]
    assert "NIF" in r.text


# ── Billing ───────────────────────────────────────────────────────────

def test_billing_plans():
    r = client.get("/api/billing/plans")
    assert r.status_code == 200
    plans = r.json()
    assert len(plans) == 2
    assert all("id" in p and "name" in p and "price" in p and "features" in p for p in plans)
    pro = next(p for p in plans if p["id"] == "pro")
    assert pro["price"] == 15000
    assert pro["vat_note"] != ""
    custom = next(p for p in plans if p["id"] == "custom")
    assert custom["contact"] != ""


def test_billing_status():
    r = client.get("/api/billing/status")
    assert r.status_code == 200
    data = r.json()
    assert "plan" in data
    assert "status" in data


# ── Webhook ───────────────────────────────────────────────────────────

@patch("app.routes.ingest_document")
def test_webhook_success(mock_ingest):
    mock_ingest.return_value = 42
    r = client.post("/api/webhook", json={"document_id": 1})
    assert r.status_code == 200
    assert r.json()["document_id"] == 42


@patch("app.routes.ingest_document", side_effect=ValueError("parse failed"))
def test_webhook_parse_error(mock_ingest):
    r = client.post("/api/webhook", json={"document_id": 1})
    assert r.status_code == 422


# ── Entity Profile ────────────────────────────────────────────────────

def test_get_entity_empty():
    r = client.get("/api/entity")
    assert r.status_code == 200
    assert r.json() == {}


def test_put_and_get_entity():
    entity = {"legalName": "Empresa Teste", "nif": "123456789"}
    r = client.put("/api/entity", json=entity)
    assert r.status_code == 200
    assert r.json()["legalName"] == "Empresa Teste"
    r = client.get("/api/entity")
    assert r.status_code == 200
