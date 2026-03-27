"""
Reconciliation integration tests.
Tests reconcile_all() with real matching logic against the in-memory mock DB.
Previously, reconcile_all was always mocked out in routes tests.
"""
from decimal import Decimal
from unittest.mock import patch

from fastapi.testclient import TestClient

from app.main import app
from app.reconcile import AMOUNT_TOLERANCE, DATE_TOLERANCE

client = TestClient(app, raise_server_exceptions=False)


def _import_docs_and_txs(docs, txs):
    """Insert documents and bank transactions via CSV upload.
    docs: list of (total, date_str)
    txs: list of (amount, date_str, description)
    """
    # Upload bank CSV
    if txs:
        lines = ["date;description;amount"]
        for amount, dt, desc in txs:
            # Format amount with comma decimal separator (Portuguese)
            amt_str = str(amount).replace(".", ",")
            lines.append(f"{dt};{desc};{amt_str}")
        csv_data = "\n".join(lines) + "\n"
        r = client.post(
            "/api/bank-transactions/upload",
            files={"file": ("bank.csv", csv_data.encode(), "text/csv")},
        )
        assert r.status_code == 200, r.text

    # For documents, insert via PATCH route after creating stubs
    # We directly create via upload route with mock paperless
    for total, dt in docs:
        with patch("app.routes.httpx.post") as mock_post:
            from unittest.mock import MagicMock
            mock_resp = MagicMock()
            mock_resp.status_code = 200
            mock_post.return_value = mock_resp
            r = client.post(
                "/api/documents/upload",
                files={"file": ("invoice.pdf", b"%PDF-test", "application/pdf")},
            )
            assert r.status_code == 200, r.text
            doc_id = r.json()["id"]
            # Set the total and date for reconciliation
            r2 = client.patch(f"/api/documents/{doc_id}", json={
                "total": float(total),
                "date": dt,
                "status": "extraído",
            })
            assert r2.status_code == 200, r2.text


# ═══════════════════════════════════════════════════════════════════════
# ── Tests ─────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_reconcile_empty():
    """No documents and no transactions → no matches."""
    r = client.post("/api/reconcile")
    assert r.status_code == 200
    data = r.json()
    assert data["matched"] == 0


def test_reconcile_constants():
    """Tolerance constants match specification."""
    assert Decimal("0.01") == AMOUNT_TOLERANCE
    assert DATE_TOLERANCE.days == 5


def test_reconcile_via_api():
    """Full reconciliation workflow via API — upload, import, reconcile."""
    # Upload bank CSV
    csv_data = "date;description;amount\n2026-03-01;Pag Fornecedor;-150,50\n"
    r = client.post(
        "/api/bank-transactions/upload",
        files={"file": ("bank.csv", csv_data.encode(), "text/csv")},
    )
    assert r.status_code == 200
    assert r.json()["imported"] == 1

    # Create a document with matching total
    with patch("app.routes.httpx.post") as mock_post:
        from unittest.mock import MagicMock
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_post.return_value = mock_resp
        r = client.post(
            "/api/documents/upload",
            files={"file": ("fatura.pdf", b"%PDF-1", "application/pdf")},
        )
        assert r.status_code == 200
        doc_id = r.json()["id"]

    # Set total and date on the document
    r = client.patch(f"/api/documents/{doc_id}", json={
        "total": 150.50,
        "date": "2026-03-01",
        "status": "extraído",
    })
    assert r.status_code == 200, f"PATCH failed: {r.text}"

    # Run reconciliation
    r = client.post("/api/reconcile")
    assert r.status_code == 200
    data = r.json()
    assert data["matched"] == 1
    assert len(data["matches"]) == 1

    # Run again — should find no new matches
    r = client.post("/api/reconcile")
    assert r.status_code == 200
    assert r.json()["matched"] == 0


def test_reconcile_no_match_amount():
    """Documents with amount diff ≥ 0.01 should not match."""
    csv_data = "date;description;amount\n2026-03-01;Pagamento;-100,00\n"
    client.post(
        "/api/bank-transactions/upload",
        files={"file": ("bank.csv", csv_data.encode(), "text/csv")},
    )

    with patch("app.routes.httpx.post") as mock_post:
        from unittest.mock import MagicMock
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_post.return_value = mock_resp
        r = client.post(
            "/api/documents/upload",
            files={"file": ("fatura.pdf", b"%PDF-1", "application/pdf")},
        )
        doc_id = r.json()["id"]

    client.patch(f"/api/documents/{doc_id}", json={
        "total": 100.05,  # 0.05 diff — exceeds tolerance
        "date": "2026-03-01",
        "status": "extraído",
    })

    r = client.post("/api/reconcile")
    assert r.status_code == 200
    assert r.json()["matched"] == 0
