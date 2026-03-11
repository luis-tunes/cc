"""
Comprehensive API route tests.
Mocks DB at the connection level — no PostgreSQL needed.
"""
import os
import pytest
from contextlib import contextmanager
from datetime import date
from decimal import Decimal
from unittest.mock import patch, MagicMock

# Ensure auth is disabled for tests
os.environ.setdefault("AUTH_DISABLED", "1")
os.environ.setdefault("DATABASE_URL", "postgresql://cc:cc@localhost:5432/cc")


# ── In-memory DB mock ────────────────────────────────────────────────
# Simulates psycopg dict_row cursor with an in-memory store so route
# handlers that call get_conn() → conn.execute() work without PG.

_tables: dict[str, list[dict]] = {}
_seq: dict[str, int] = {}


def _reset_db():
    global _tables, _seq
    _tables = {"documents": [], "bank_transactions": [], "reconciliations": []}
    _seq = {"documents": 0, "bank_transactions": 0, "reconciliations": 0}


class _FakeCursor:
    """Returned by conn.execute(); holds fetchone/fetchall results."""
    def __init__(self, rows: list[dict]):
        self._rows = rows

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows


class _FakeConn:
    """Minimal stand-in for a psycopg connection."""

    def execute(self, sql: str, params=None):
        sql_lower = sql.strip().lower()
        # Aggregates (COUNT/SUM) go to a separate handler regardless of table
        if sql_lower.startswith("select") and "count" in sql_lower:
            return self._handle_aggregate(sql, params)
        if sql_lower.startswith("insert into documents"):
            return self._insert_document(sql, params)
        if sql_lower.startswith("update documents"):
            return self._update_document(sql, params)
        if sql_lower.startswith("select") and "documents" in sql_lower and "bank_transactions" not in sql_lower and "reconciliations" not in sql_lower:
            return self._select_documents(sql, params)
        if sql_lower.startswith("insert into bank_transactions"):
            return self._insert_bank_tx(sql, params)
        if sql_lower.startswith("select") and "bank_transactions" in sql_lower and "reconciliations" not in sql_lower:
            return self._select_bank_txs(sql, params)
        if sql_lower.startswith("select") and "reconciliations" in sql_lower:
            return self._select_reconciliations(sql, params)
        # Anything else (dashboard aggregates, etc.)
        return self._handle_aggregate(sql, params)

    def commit(self):
        pass

    # -- helpers --

    def _insert_document(self, sql, params):
        _seq["documents"] += 1
        doc_id = _seq["documents"]
        doc = {
            "id": doc_id,
            "tenant_id": params[1] if params and len(params) > 1 else None,
            "supplier_nif": params[0] if params and isinstance(params[0], str) and len(params[0]) <= 9 and params[0] != "a processar" else "",
            "client_nif": "",
            "total": Decimal("0"),
            "vat": Decimal("0"),
            "date": None,
            "type": "outro",
            "filename": None,
            "raw_text": None,
            "status": "pendente",
            "paperless_id": None,
            "created_at": "2025-01-01T00:00:00+00:00",
        }
        # Parse the specific INSERT used by upload_document
        if "filename" in sql.lower() and params:
            # INSERT INTO documents (..., filename, status, tenant_id) VALUES (...)
            doc["filename"] = params[-3] if len(params) >= 3 else params[0]
            doc["status"] = params[-2] if len(params) >= 3 else "a processar"
            doc["tenant_id"] = params[-1] if len(params) >= 2 else None
            # Fix: for upload route the params are (filename, tid)
            if len(params) == 2:
                doc["filename"] = params[0]
                doc["status"] = "a processar"
                doc["tenant_id"] = params[1]
            # For the explicit full insert: ('','',0,0,'outro',filename,status,tid)
            if len(params) == 8:
                doc["supplier_nif"] = params[0]
                doc["client_nif"] = params[1]
                doc["total"] = Decimal(str(params[2]))
                doc["vat"] = Decimal(str(params[3]))
                doc["type"] = params[4]
                doc["filename"] = params[5]
                doc["status"] = params[6]
                doc["tenant_id"] = params[7]
        _tables["documents"].append(doc)
        return _FakeCursor([doc])

    def _update_document(self, sql, params):
        # e.g. UPDATE documents SET status=%s WHERE id=%s RETURNING ...
        # Find doc by id (second-to-last or last param depending on tenant)
        doc_id = None
        for i, p in enumerate(params):
            if isinstance(p, int):
                doc_id = p
                break
        if doc_id is None and params:
            doc_id = params[-1]
        doc = next((d for d in _tables["documents"] if d["id"] == doc_id), None)
        if doc is None:
            return _FakeCursor([])
        # Apply SET fields — simple: everything before the WHERE id param
        set_pairs = sql.split("SET")[1].split("WHERE")[0]
        field_names = [f.strip().split("=")[0].strip() for f in set_pairs.split(",")]
        for i, fname in enumerate(field_names):
            if i < len(params):
                doc[fname] = params[i]
        return _FakeCursor([doc])

    def _select_documents(self, sql, params):
        docs = list(_tables["documents"])
        # Check for id = %s filter
        if "id = %s" in sql.lower() and params:
            doc_id = params[0]
            docs = [d for d in docs if d["id"] == doc_id]
        return _FakeCursor(docs)

    def _insert_bank_tx(self, sql, params):
        _seq["bank_transactions"] += 1
        tx = {
            "id": _seq["bank_transactions"],
            "date": params[0],
            "description": params[1],
            "amount": params[2],
            "tenant_id": params[3] if len(params) > 3 else None,
            "created_at": "2025-01-01T00:00:00+00:00",
        }
        _tables["bank_transactions"].append(tx)
        return _FakeCursor([tx])

    def _select_bank_txs(self, sql, params):
        return _FakeCursor(list(_tables["bank_transactions"]))

    def _select_reconciliations(self, sql, params):
        return _FakeCursor(list(_tables["reconciliations"]))

    def _handle_aggregate(self, sql, params):
        sql_lower = sql.strip().lower()
        # Monthly grouped query (to_char) → return empty list
        if "to_char" in sql_lower:
            return _FakeCursor([])
        if "count" in sql_lower and "sum" in sql_lower and "documents" in sql_lower:
            return _FakeCursor([{"count": len(_tables["documents"]), "total": Decimal("0")}])
        if "count" in sql_lower and "sum" in sql_lower and "bank_transactions" in sql_lower:
            return _FakeCursor([{"count": len(_tables["bank_transactions"]), "total": Decimal("0")}])
        if "count" in sql_lower and "reconciliations" in sql_lower:
            return _FakeCursor([{"count": len(_tables["reconciliations"])}])
        if "count" in sql_lower:
            return _FakeCursor([{"count": 0}])
        if "to_char" in sql_lower:
            return _FakeCursor([])
        return _FakeCursor([])


@contextmanager
def _fake_get_conn():
    yield _FakeConn()


# Patch get_conn before importing the app so the router module binds to the mock
_get_conn_patcher = patch("app.routes.get_conn", _fake_get_conn)
_get_conn_patcher.start()

# Also patch reconcile_all to avoid DB dependency from reconcile module
_reconcile_patcher = patch("app.routes.reconcile_all", return_value=[])
_reconcile_patcher.start()

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)


@pytest.fixture(autouse=True)
def _clean_db():
    """Reset in-memory tables before each test."""
    _reset_db()


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

    # Create
    r = client.post(
        "/api/documents/upload",
        files={"file": ("test.pdf", b"%PDF-1", "application/pdf")},
    )
    assert r.status_code == 200
    doc_id = r.json()["id"]

    # Patch
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
    # Pro is 150€ + IVA, Custom has contact
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
