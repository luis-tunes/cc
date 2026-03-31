import base64
import datetime
import json
import sys
from datetime import date, timedelta
from decimal import Decimal

from app.reconcile import AMOUNT_TOLERANCE, DATE_TOLERANCE


def _conftest():
    return sys.modules["tests.conftest"]


def _jwt_headers(tenant_id: str, user_id: str = "user-1") -> dict:
    payload = {"sub": user_id, "org_id": tenant_id, "email": f"{user_id}@test.pt"}
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    return {"Authorization": f"Bearer {header}.{body}."}


_T1 = _jwt_headers("t1")
_T2 = _jwt_headers("t2")


def _post_doc(client, tenant="t1"):
    return client.post(
        "/api/documents/upload",
        files={"file": ("inv.pdf", b"dummy", "application/pdf")},
        headers=_jwt_headers(tenant),
    )


def _post_tx(client=None, amount="100.00", tenant="t1", date="2024-06-01", desc="PAGAMENTO"):
    c = _conftest()
    c._seq["bank_transactions"] += 1
    tx = {
        "id": c._seq["bank_transactions"],
        "date": datetime.date.fromisoformat(date),
        "description": desc,
        "amount": Decimal(str(amount)),
        "tenant_id": tenant,
        "created_at": None,
    }
    c._tables["bank_transactions"].append(tx)
    return tx


def _create_reconciliation(doc_id, tx_id, tenant="t1"):
    c = _conftest()
    c._seq["reconciliations"] += 1
    rec = {
        "id": c._seq["reconciliations"],
        "document_id": doc_id,
        "bank_transaction_id": tx_id,
        "match_confidence": Decimal("0.90"),
        "tenant_id": tenant,
        "status": "pendente",
    }
    c._tables["reconciliations"].append(rec)
    return rec


def test_tolerance_values():
    assert Decimal("0.01") == AMOUNT_TOLERANCE
    assert timedelta(days=5) == DATE_TOLERANCE

def test_amount_within_tolerance():
    diff = abs(Decimal("100.00") - Decimal("100.005"))
    assert diff < AMOUNT_TOLERANCE

def test_amount_outside_tolerance():
    diff = abs(Decimal("100.00") - Decimal("100.02"))
    assert diff >= AMOUNT_TOLERANCE

def test_date_within_tolerance():
    d1 = date(2026, 3, 1)
    d2 = date(2026, 3, 5)
    assert abs(d1 - d2) <= DATE_TOLERANCE

def test_date_outside_tolerance():
    d1 = date(2026, 3, 1)
    d2 = date(2026, 3, 7)
    assert abs(d1 - d2) > DATE_TOLERANCE


def test_negative_amount_matches_positive_total():
    """Bank transactions are often negative (payments). abs() should match doc total."""
    doc_total = Decimal("150.50")
    tx_amount = Decimal("-150.50")
    diff = abs(doc_total - abs(tx_amount))
    assert diff < AMOUNT_TOLERANCE


def test_large_amounts_within_tolerance():
    diff = abs(Decimal("99999.99") - Decimal("99999.995"))
    assert diff < AMOUNT_TOLERANCE


def test_zero_amount_difference():
    diff = abs(Decimal("500.00") - Decimal("500.00"))
    assert diff < AMOUNT_TOLERANCE


def test_suggestion_tolerances():
    from app.reconcile import SUGGESTION_AMOUNT_TOLERANCE, SUGGESTION_DATE_TOLERANCE
    assert Decimal("50") == SUGGESTION_AMOUNT_TOLERANCE
    assert timedelta(days=30) == SUGGESTION_DATE_TOLERANCE


def test_exact_date_match():
    d1 = date(2026, 1, 15)
    d2 = date(2026, 1, 15)
    assert abs(d1 - d2) <= DATE_TOLERANCE


def test_date_boundary_5_days():
    """Exactly 5 days should still be within tolerance."""
    d1 = date(2026, 6, 1)
    d2 = date(2026, 6, 6)
    assert abs(d1 - d2) == timedelta(days=5)
    assert abs(d1 - d2) <= DATE_TOLERANCE


# ── Reconciliation persistence (from operations_test.py) ──────────────


class TestReconciliationPatch:
    def test_approve_reconciliation(self, client):
        doc = _post_doc(client)
        tx = _post_tx(client)
        rec = _create_reconciliation(doc.json()["id"], tx["id"])
        rec_id = rec["id"]

        r = client.patch(
            f"/api/reconciliations/{rec_id}",
            json={"status": "aprovado"},
            headers=_T1,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "aprovado"

    def test_flag_reconciliation(self, client):
        doc = _post_doc(client)
        tx = _post_tx(client)
        rec = _create_reconciliation(doc.json()["id"], tx["id"])
        rec_id = rec["id"]

        r = client.patch(
            f"/api/reconciliations/{rec_id}",
            json={"status": "rejeitado"},
            headers=_T1,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "rejeitado"

    def test_review_reconciliation(self, client):
        doc = _post_doc(client)
        tx = _post_tx(client)
        rec = _create_reconciliation(doc.json()["id"], tx["id"])
        rec_id = rec["id"]

        r = client.patch(
            f"/api/reconciliations/{rec_id}",
            json={"status": "a_rever"},
            headers=_T1,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "a_rever"

    def test_invalid_status_rejected(self, client):
        doc = _post_doc(client)
        tx = _post_tx(client)
        rec = _create_reconciliation(doc.json()["id"], tx["id"])
        rec_id = rec["id"]

        r = client.patch(
            f"/api/reconciliations/{rec_id}",
            json={"status": "invalido"},
            headers=_T1,
        )
        assert r.status_code == 422

    def test_patch_nonexistent_returns_404(self, client):
        r = client.patch(
            "/api/reconciliations/9999",
            json={"status": "aprovado"},
            headers=_T1,
        )
        assert r.status_code == 404

    def test_no_fields_returns_422(self, client):
        r = client.patch(
            "/api/reconciliations/1",
            json={},
            headers=_T1,
        )
        assert r.status_code == 422


class TestReconciliationSuggestions:
    def _seed_doc(self, total="150.00", doc_date="2024-06-01"):
        c = _conftest()
        c._seq["documents"] += 1
        doc = {
            "id": c._seq["documents"],
            "tenant_id": "t1",
            "supplier_nif": "123456789",
            "client_nif": "",
            "total": Decimal(total),
            "vat": Decimal("0"),
            "date": datetime.date.fromisoformat(doc_date),
            "type": "fatura",
            "filename": "test.pdf",
            "raw_text": None,
            "status": "pendente",
            "paperless_id": None,
            "created_at": "2025-01-01T00:00:00+00:00",
            "notes": None,
            "snc_account": None,
            "classification_source": None,
        }
        c._tables["documents"].append(doc)
        return doc

    def test_suggestions_no_match(self, client):
        doc = self._seed_doc(total="999.99", doc_date="2020-01-01")
        r = client.get(f"/api/reconciliations/{doc['id']}/suggestions", headers=_T1)
        assert r.status_code == 200
        assert r.json() == []

    def test_suggestions_with_match(self, client):
        doc = self._seed_doc(total="150.00", doc_date="2024-06-01")
        _post_tx(amount="150.00", date="2024-06-03", desc="PAGAMENTO FATURA")
        r = client.get(f"/api/reconciliations/{doc['id']}/suggestions", headers=_T1)
        assert r.status_code == 200
        suggestions = r.json()
        assert len(suggestions) >= 1
        assert suggestions[0]["confidence"] > 50

    def test_suggestions_sorted_by_confidence(self, client):
        doc = self._seed_doc(total="200.00", doc_date="2024-06-01")
        _post_tx(amount="200.00", date="2024-06-02", desc="CLOSE MATCH")
        _post_tx(amount="180.00", date="2024-06-20", desc="FAR MATCH")
        r = client.get(f"/api/reconciliations/{doc['id']}/suggestions", headers=_T1)
        assert r.status_code == 200
        suggestions = r.json()
        assert len(suggestions) >= 2
        assert suggestions[0]["confidence"] >= suggestions[1]["confidence"]

    def test_suggestions_doc_not_found(self, client):
        r = client.get("/api/reconciliations/99999/suggestions", headers=_T1)
        assert r.status_code == 200
        assert r.json() == []
