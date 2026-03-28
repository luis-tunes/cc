"""
Comprehensive API route tests.
Uses shared FakeConn from conftest.py — no PostgreSQL needed.
"""
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


# ── Health ────────────────────────────────────────────────────────────

def test_health():
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert "checks" in data


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


@patch("app.routes._extract_with_vision", return_value={"total": 100, "vat": 23, "supplier_nif": "123456789", "client_nif": "987654321", "date": "2024-01-01", "type": "fatura"})
def test_upload_document_success(mock_vision):
    r = client.post(
        "/api/documents/upload",
        files={"file": ("invoice.pdf", b"%PDF-fake", "application/pdf")},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["filename"] == "invoice.pdf"
    assert data["status"] == "accepted"
    assert "id" in data
    mock_vision.assert_called_once()


@patch("app.routes._extract_with_vision", return_value={"total": 50, "vat": 11.5, "supplier_nif": "123456789", "client_nif": "987654321", "date": "2024-01-01", "type": "fatura"})
def test_upload_jpg_success(mock_vision):
    jpg_bytes = b"\xff\xd8\xff\xe0" + b"\x00" * 100
    r = client.post(
        "/api/documents/upload",
        files={"file": ("photo.jpg", jpg_bytes, "image/jpeg")},
    )
    assert r.status_code == 200
    data = r.json()
    assert data["filename"] == "photo.jpg"
    assert data["status"] == "accepted"
    # Vision was called with image/jpeg
    call_args = mock_vision.call_args
    assert call_args[0][1] == "image/jpeg"


@patch("app.routes._extract_with_vision", return_value={"total": 25, "vat": 5.75, "supplier_nif": "123456789", "client_nif": "987654321", "date": "2024-01-01", "type": "fatura"})
def test_upload_png_success(mock_vision):
    png_bytes = b"\x89PNG\r\n\x1a\n" + b"\x00" * 100
    r = client.post(
        "/api/documents/upload",
        files={"file": ("scan.png", png_bytes, "image/png")},
    )
    assert r.status_code == 200
    assert r.json()["filename"] == "scan.png"
    assert r.json()["status"] == "accepted"
    call_args = mock_vision.call_args
    assert call_args[0][1] == "image/png"


@patch("app.routes._extract_with_vision", return_value=None)
def test_upload_vision_fails_saves_pending(mock_vision):
    """GPT Vision fails → document saved as pending."""
    r = client.post(
        "/api/documents/upload",
        files={"file": ("invoice.pdf", b"%PDF-fake", "application/pdf")},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "accepted_pending"
    assert "id" in r.json()


@patch("app.routes._extract_with_vision", return_value=None)
@patch("app.routes.PAPERLESS_TOKEN", "fake-token")
@patch("app.routes.httpx.Client")
def test_upload_paperless_rejects_archive_still_works(mock_client_cls, mock_vision):
    """Paperless archive fails, Vision also fails — document still saved as pending."""
    mock_resp = MagicMock()
    mock_resp.status_code = 401
    mock_resp.text = "Invalid token"
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = mock_resp
    mock_client_cls.return_value = mock_client

    r = client.post(
        "/api/documents/upload",
        files={"file": ("invoice.pdf", b"%PDF-fake", "application/pdf")},
    )
    assert r.status_code == 200
    assert r.json()["status"] == "accepted_pending"


def test_upload_preflight():
    r = client.get("/api/debug/upload-check")
    assert r.status_code == 200
    data = r.json()
    assert "db" in data
    assert "paperless" in data


def test_patch_document_no_fields():
    r = client.patch("/api/documents/1", json={})
    assert r.status_code == 422


@patch("app.routes.httpx.Client")
def test_create_and_patch_document(mock_client_cls):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = mock_resp
    mock_client_cls.return_value = mock_client

    r = client.post(
        "/api/documents/upload",
        files={"file": ("test.pdf", b"%PDF-1", "application/pdf")},
    )
    assert r.status_code == 200
    doc_id = r.json()["id"]

    r = client.patch(f"/api/documents/{doc_id}", json={"status": "classificado"})
    assert r.status_code == 200
    assert r.json()["status"] == "classificado"


@patch("app.routes.httpx.Client")
def test_delete_document(mock_client_cls):
    mock_resp = MagicMock()
    mock_resp.status_code = 200
    mock_client = MagicMock()
    mock_client.__enter__ = MagicMock(return_value=mock_client)
    mock_client.__exit__ = MagicMock(return_value=False)
    mock_client.post.return_value = mock_resp
    mock_client_cls.return_value = mock_client

    r = client.post(
        "/api/documents/upload",
        files={"file": ("delete-me.pdf", b"%PDF-1", "application/pdf")},
    )
    assert r.status_code == 200
    doc_id = r.json()["id"]

    r = client.delete(f"/api/documents/{doc_id}")
    assert r.status_code == 204

    r = client.get(f"/api/documents/{doc_id}")
    assert r.status_code == 404


def test_delete_document_not_found():
    r = client.delete("/api/documents/999999")
    assert r.status_code == 404


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


def test_delete_bank_transaction():
    csv_data = "date;description;amount\n2026-06-01;To Delete;-10,00\n"
    client.post(
        "/api/bank-transactions/upload",
        files={"file": ("bank.csv", csv_data.encode(), "text/csv")},
    )
    txs = client.get("/api/bank-transactions").json()
    assert len(txs) > 0
    tx_id = txs[0]["id"]
    r = client.delete(f"/api/bank-transactions/{tx_id}")
    assert r.status_code == 204


def test_delete_bank_transaction_not_found():
    r = client.delete("/api/bank-transactions/999999")
    assert r.status_code == 404


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
@patch("app.routes.WEBHOOK_SECRET", "test-secret")
def test_webhook_success(mock_ingest):
    mock_ingest.return_value = 42
    r = client.post("/api/webhook", json={"document_id": 1, "secret": "test-secret", "tenant_id": "dev-tenant"})
    assert r.status_code == 200
    assert r.json()["document_id"] == 42


@patch("app.routes.ingest_document", side_effect=ValueError("parse failed"))
@patch("app.routes.WEBHOOK_SECRET", "test-secret")
def test_webhook_parse_error(mock_ingest):
    r = client.post("/api/webhook", json={"document_id": 1, "secret": "test-secret", "tenant_id": "dev-tenant"})
    assert r.status_code == 422


def test_webhook_missing_secret():
    """Webhook without valid secret is rejected."""
    r = client.post("/api/webhook", json={"document_id": 1, "secret": "wrong"})
    assert r.status_code == 403


@patch("app.routes.WEBHOOK_SECRET", "test-secret")
def test_webhook_missing_tenant():
    """Webhook without tenant_id and no pending stub is rejected."""
    r = client.post("/api/webhook", json={"document_id": 1, "secret": "test-secret"})
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


# ── Tax ───────────────────────────────────────────────────────────────

def test_iva_periods():
    r = client.get("/api/tax/iva-periods")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if data:
        period = data[0]
        assert "quarter" in period
        assert "cobrado" in period
        assert "dedutivel" in period
        assert "devido" in period


def test_irc_estimate():
    r = client.get("/api/tax/irc-estimate")
    assert r.status_code == 200
    data = r.json()
    assert "year" in data
    assert "taxable_income" in data or "resultado" in data
    assert "irc_estimate" in data or "irc_due" in data


def test_audit_flags():
    r = client.get("/api/tax/audit-flags")
    assert r.status_code == 200
    data = r.json()
    assert "flags" in data
    assert "total_issues" in data or "total" in data
    assert isinstance(data["flags"], list)


# ── Obligations ───────────────────────────────────────────────────────

def test_obligations():
    r = client.get("/api/obligations")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    assert len(data) > 0
    ob = data[0]
    assert "description" in ob or "name" in ob
    assert "due_date" in ob or "deadline" in ob
    assert "status" in ob
    assert ob["status"] in ("overdue", "urgent", "upcoming", "future")


# ── Reports ───────────────────────────────────────────────────────────

def test_pl_report():
    r = client.get("/api/reports/pl")
    assert r.status_code == 200
    data = r.json()
    assert "year" in data
    assert "months" in data
    assert isinstance(data["months"], list)
    if data["months"]:
        m = data["months"][0]
        assert "month" in m
        assert "receitas" in m
        assert "gastos" in m
        assert "resultado" in m


def test_pl_report_custom_year():
    r = client.get("/api/reports/pl?year=2023")
    assert r.status_code == 200
    assert r.json()["year"] == 2023


def test_top_suppliers():
    r = client.get("/api/reports/top-suppliers")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)
    if data:
        s = data[0]
        assert "supplier" in s
        assert "total" in s
        assert "doc_count" in s


def test_top_suppliers_limit():
    r = client.get("/api/reports/top-suppliers?limit=3")
    assert r.status_code == 200
    assert len(r.json()) <= 3


# ── Auto-Classification ───────────────────────────────────────────────

def test_auto_classify_returns_stats():
    r = client.post("/api/documents/auto-classify")
    assert r.status_code == 200
    data = r.json()
    assert "classified_now" in data
    assert "skipped" in data
    assert "total_processed" in data
    assert "total_classified" in data
    assert "total_unclassified" in data
    assert isinstance(data["classified_now"], int)


def test_classification_stats():
    r = client.get("/api/documents/classification-stats")
    assert r.status_code == 200
    data = r.json()
    assert "total" in data
    assert "classified" in data
    assert "unclassified" in data
    assert "coverage_pct" in data
    assert "by_account" in data
    assert isinstance(data["by_account"], list)


# ── Activity Log ─────────────────────────────────────────────────────

def test_activity_list():
    r = client.get("/api/activity")
    assert r.status_code == 200
    data = r.json()
    assert isinstance(data, list)


def test_activity_list_limit():
    r = client.get("/api/activity?limit=5")
    assert r.status_code == 200


def test_activity_list_limit_too_large():
    r = client.get("/api/activity?limit=999")
    assert r.status_code == 422
