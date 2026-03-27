"""Tests: reconciliation persistence, movement classification,
compliance alerts, asset management, and CSV export endpoints."""
import base64
import datetime
import json
import sys
from decimal import Decimal
from unittest.mock import MagicMock, patch

import pytest

from app.assets import compute_current_value, depreciation_schedule


def _conftest():
    """Return the conftest module (the instance that pytest uses)."""
    return sys.modules["tests.conftest"]


def _jwt_headers(tenant_id: str, user_id: str = "user-1") -> dict:
    """Create minimal unsigned JWT headers for a given tenant."""
    payload = {"sub": user_id, "org_id": tenant_id, "email": f"{user_id}@test.pt"}
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    return {"Authorization": f"Bearer {header}.{body}."}


_T1 = _jwt_headers("t1")
_T2 = _jwt_headers("t2")

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────

def _post_doc(client, tenant="t1"):
    return client.post(
        "/api/documents/upload",
        files={"file": ("inv.pdf", b"dummy", "application/pdf")},
        headers=_jwt_headers(tenant),
    )


def _post_tx(client=None, amount="100.00", tenant="t1", date="2024-06-01", desc="PAGAMENTO"):
    """Seed a bank transaction directly into the in-memory table."""
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
    """Seed a reconciliation directly into the in-memory table."""
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


# ─────────────────────────────────────────────────────────────────────────────
# 5.1 Reconciliation persistence — PATCH /reconciliations/{id}
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# 5.2 Movement rules CRUD
# ─────────────────────────────────────────────────────────────────────────────

class TestMovementRules:
    def test_list_empty(self, client):
        r = client.get("/api/movement-rules", headers=_T1)
        assert r.status_code == 200
        assert r.json() == []

    def test_create_rule(self, client):
        r = client.post(
            "/api/movement-rules",
            json={
                "name": "EDP",
                "pattern": "edp comercial",
                "category": "utilities",
                "snc_account": "62211",
                "entity_nif": "501905480",
                "priority": 10,
                "active": True,
            },
            headers=_T1,
        )
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "EDP"
        assert data["pattern"] == "edp comercial"
        assert data["id"] is not None

    def test_list_after_create(self, client):
        client.post(
            "/api/movement-rules",
            json={"name": "R1", "pattern": "pag", "category": "outros", "snc_account": "6", "priority": 1, "active": True},
            headers=_T1,
        )
        r = client.get("/api/movement-rules", headers=_T1)
        assert len(r.json()) == 1

    def test_tenant_isolation(self, client):
        client.post(
            "/api/movement-rules",
            json={"name": "R1", "pattern": "pag", "category": "outros", "snc_account": "6", "priority": 1, "active": True},
            headers=_T1,
        )
        r = client.get("/api/movement-rules", headers=_T2)
        assert r.json() == []

    def test_delete_rule(self, client):
        r = client.post(
            "/api/movement-rules",
            json={"name": "R", "pattern": "x", "category": "y", "snc_account": "6", "priority": 0, "active": True},
            headers=_T1,
        )
        rule_id = r.json()["id"]
        dr = client.delete(f"/api/movement-rules/{rule_id}", headers=_T1)
        assert dr.status_code == 204
        assert client.get("/api/movement-rules", headers=_T1).json() == []

    def test_delete_nonexistent_returns_404(self, client):
        r = client.delete("/api/movement-rules/9999", headers=_T1)
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# 5.2 classify_movements unit tests
# ─────────────────────────────────────────────────────────────────────────────

class TestClassifyMovements:
    def test_classify_matches_rule(self, client):
        """classify_movement should return classification when rule matches."""
        from app.classify_movements import classify_movement
        c = _conftest()
        c._seq["movement_rules"] += 1
        c._tables["movement_rules"].append({
            "id": c._seq["movement_rules"],
            "tenant_id": "t1",
            "name": "EDP",
            "pattern": "edp comercial",
            "category": "utilities",
            "snc_account": "62211",
            "entity_nif": "501905480",
            "priority": 10,
            "active": True,
        })

        result = classify_movement("Pag EDP COMERCIAL 2024", "t1")
        assert result is not None
        assert result["category"] == "utilities"
        assert result["snc_account"] == "62211"
        assert result["source"] == "rule"

    def test_classify_no_match(self, client):
        from app.classify_movements import classify_movement
        result = classify_movement("TRANSFERENCIA PAG SALARIO", "t1")
        assert result is None

    def test_classify_inactive_rule_ignored(self, client):
        from app.classify_movements import classify_movement
        c = _conftest()
        c._seq["movement_rules"] += 1
        c._tables["movement_rules"].append({
            "id": c._seq["movement_rules"],
            "tenant_id": "t1",
            "name": "NOS",
            "pattern": "nos comunicacoes",
            "category": "comms",
            "snc_account": "62212",
            "entity_nif": None,
            "priority": 5,
            "active": False,
        })
        result = classify_movement("NOS COMUNICACOES PAG NOV", "t1")
        assert result is None

    def test_detect_entity_matches_supplier(self, client):
        from app.classify_movements import detect_entity
        c = _conftest()
        c._seq["suppliers"] += 1
        c._tables["suppliers"].append({
            "id": c._seq["suppliers"],
            "tenant_id": "t1",
            "name": "Galp Energia",
            "nif": "504499777",
            "category": "utilities",
            "avg_delivery_days": 0,
            "reliability": Decimal("1"),
        })

        result = detect_entity("Pag GALP ENERGIA FEB 2024", "t1")
        assert result is not None
        assert result["nif"] == "504499777"
        assert result["type"] == "fornecedor"

    def test_detect_entity_no_match(self, client):
        from app.classify_movements import detect_entity
        result = detect_entity("TRANSFERENCIA BANCO", "t1")
        assert result is None


# ─────────────────────────────────────────────────────────────────────────────
# 5.3 Compliance alerts
# ─────────────────────────────────────────────────────────────────────────────

class TestAlertsCRUD:
    def _seed_alert(self, client=None, tenant="t1", severity="urgente", title="Teste"):
        c = _conftest()
        c._seq["alerts"] += 1
        alert = {
            "id": c._seq["alerts"],
            "tenant_id": tenant,
            "type": "unreconciled",
            "severity": severity,
            "title": title,
            "description": "desc",
            "action_url": "/reconciliacao",
            "read": False,
            "created_at": None,
        }
        c._tables["alerts"].append(alert)
        return alert

    def test_list_alerts_empty(self, client):
        r = client.get("/api/alerts", headers=_T1)
        assert r.status_code == 200
        assert r.json() == []

    def test_list_alerts_returns_seeded(self, client):
        self._seed_alert(client, title="Documentos não reconciliados")
        r = client.get("/api/alerts", headers=_T1)
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_mark_alert_read(self, client):
        alert = self._seed_alert(client)
        r = client.patch(f"/api/alerts/{alert['id']}", headers=_T1)
        assert r.status_code == 200
        assert r.json()["read"] is True

    def test_mark_alert_nonexistent_404(self, client):
        r = client.patch("/api/alerts/9999", headers=_T1)
        assert r.status_code == 404

    def test_tenant_isolation(self, client):
        self._seed_alert(client, tenant="t1")
        r = client.get("/api/alerts", headers=_T2)
        assert r.json() == []

    def test_generate_alerts_endpoint(self, client):
        """POST /alerts/generate should call the engine and return count."""
        r = client.post("/api/alerts/generate", headers=_T1)
        assert r.status_code == 200
        assert "generated" in r.json()


# ─────────────────────────────────────────────────────────────────────────────
# 5.4 Asset management — unit tests for depreciation engine
# ─────────────────────────────────────────────────────────────────────────────

class TestAssetDepreciation:
    def _make_asset(self, method="linha-reta", years=5, cost="10000", status="ativo", days_ago=365):
        acq_date = (datetime.date.today() - datetime.timedelta(days=days_ago)).isoformat()
        return {
            "acquisition_cost": Decimal(cost),
            "acquisition_date": acq_date,
            "depreciation_method": method,
            "useful_life_years": years,
            "status": status,
        }

    def test_straight_line_one_year(self):
        asset = self._make_asset(method="linha-reta", years=5, days_ago=365)
        val = compute_current_value(asset)
        # After 1 of 5 years: 80% remains ≈ 8000
        assert 7800 < float(val) < 8200

    def test_straight_line_fully_depreciated(self):
        asset = self._make_asset(method="linha-reta", years=3, days_ago=365 * 4)
        val = compute_current_value(asset)
        assert float(val) == 0.0

    def test_declining_balance_one_year(self):
        asset = self._make_asset(method="quotas-decrescentes", years=5, days_ago=365)
        val = compute_current_value(asset)
        # After 1 year, rate=0.4, depreciation=4000, remaining≈6000
        assert 5800 < float(val) < 6200

    def test_not_defined_method_returns_cost(self):
        asset = self._make_asset(method="não-definido", years=5, days_ago=365)
        val = compute_current_value(asset)
        assert float(val) == 10000.0

    def test_inactive_asset_returns_cost(self):
        asset = self._make_asset(method="linha-reta", years=5, days_ago=365, status="abatido")
        val = compute_current_value(asset)
        assert float(val) == 10000.0

    def test_depreciation_schedule_straight_line(self):
        asset = self._make_asset(method="linha-reta", years=5, days_ago=0)
        schedule = depreciation_schedule(asset)
        assert len(schedule) == 5
        # Each year depreciates 2000
        for entry in schedule:
            assert abs(entry["annual_depreciation"] - 2000.0) < 1
        # Last year net book value is 0
        assert schedule[-1]["net_book_value"] == pytest.approx(0.0, abs=1)

    def test_depreciation_schedule_declining_balance(self):
        asset = self._make_asset(method="quotas-decrescentes", years=4, days_ago=0)
        schedule = depreciation_schedule(asset)
        assert len(schedule) == 4
        # NBV is monotonically non-increasing (may stay at 0 after full depreciation)
        for i in range(1, len(schedule)):
            assert schedule[i]["net_book_value"] <= schedule[i - 1]["net_book_value"]

    def test_depreciation_schedule_empty_when_no_method(self):
        asset = self._make_asset(method="não-definido", years=5, days_ago=0)
        schedule = depreciation_schedule(asset)
        assert schedule == []


# ─────────────────────────────────────────────────────────────────────────────
# 5.4 Asset CRUD endpoints
# ─────────────────────────────────────────────────────────────────────────────

class TestAssetsCRUD:
    _payload = {
        "name": "Servidor Dell PowerEdge",
        "category": "informático",
        "acquisition_date": "2022-01-15",
        "acquisition_cost": "5000.00",
        "useful_life_years": 4,
        "depreciation_method": "linha-reta",
        "status": "ativo",
    }

    def test_list_empty(self, client):
        r = client.get("/api/assets", headers=_T1)
        assert r.status_code == 200
        assert r.json() == []

    def test_create_asset(self, client):
        r = client.post("/api/assets", json=self._payload, headers=_T1)
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "Servidor Dell PowerEdge"
        assert data["category"] == "informático"
        assert data["id"] is not None

    def test_list_after_create(self, client):
        client.post("/api/assets", json=self._payload, headers=_T1)
        r = client.get("/api/assets", headers=_T1)
        assert len(r.json()) == 1

    def test_create_invalid_category_422(self, client):
        bad = {**self._payload, "category": "carro-de-corrida"}
        r = client.post("/api/assets", json=bad, headers=_T1)
        assert r.status_code == 422

    def test_create_invalid_method_422(self, client):
        bad = {**self._payload, "depreciation_method": "magico"}
        r = client.post("/api/assets", json=bad, headers=_T1)
        assert r.status_code == 422

    def test_get_asset_by_id(self, client):
        create = client.post("/api/assets", json=self._payload, headers=_T1)
        asset_id = create.json()["id"]
        r = client.get(f"/api/assets/{asset_id}", headers=_T1)
        assert r.status_code == 200
        assert r.json()["id"] == asset_id

    def test_get_asset_not_found(self, client):
        r = client.get("/api/assets/9999", headers=_T1)
        assert r.status_code == 404

    def test_assets_summary(self, client):
        client.post("/api/assets", json=self._payload, headers=_T1)
        r = client.get("/api/assets/summary", headers=_T1)
        assert r.status_code == 200
        data = r.json()
        assert data["total_assets"] == 1
        assert data["total_acquisition_value"] == pytest.approx(5000.0, abs=1)

    def test_delete_asset(self, client):
        create = client.post("/api/assets", json=self._payload, headers=_T1)
        asset_id = create.json()["id"]
        dr = client.delete(f"/api/assets/{asset_id}", headers=_T1)
        assert dr.status_code == 204
        assert client.get("/api/assets", headers=_T1).json() == []

    def test_delete_nonexistent_404(self, client):
        r = client.delete("/api/assets/9999", headers=_T1)
        assert r.status_code == 404

    def test_tenant_isolation(self, client):
        client.post("/api/assets", json=self._payload, headers=_T1)
        r = client.get("/api/assets", headers=_T2)
        assert r.json() == []

    def test_patch_asset_status(self, client):
        create = client.post("/api/assets", json=self._payload, headers=_T1)
        asset_id = create.json()["id"]
        r = client.patch(
            f"/api/assets/{asset_id}",
            json={"status": "vendido"},
            headers=_T1,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "vendido"

    def test_patch_invalid_status_422(self, client):
        create = client.post("/api/assets", json=self._payload, headers=_T1)
        asset_id = create.json()["id"]
        r = client.patch(
            f"/api/assets/{asset_id}",
            json={"status": "inventado"},
            headers=_T1,
        )
        assert r.status_code == 422


# ─────────────────────────────────────────────────────────────────────────────
# 5.5 CSV export endpoints
# ─────────────────────────────────────────────────────────────────────────────

class TestCSVExport:
    def test_export_bank_transactions_csv(self, client):
        _post_tx(client)
        r = client.get("/api/export/bank-transactions/csv", headers=_T1)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert b"date" in r.content or b"amount" in r.content

    def test_export_reconciliations_csv_empty(self, client):
        # Empty reconciliations should still return a valid CSV with headers
        r = client.get("/api/export/reconciliations/csv", headers=_T1)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")

    def test_export_assets_csv(self, client):
        client.post(
            "/api/assets",
            json={
                "name": "Impressora",
                "category": "informático",
                "acquisition_date": "2023-01-01",
                "acquisition_cost": "800.00",
                "useful_life_years": 3,
                "depreciation_method": "linha-reta",
                "status": "ativo",
            },
            headers=_T1,
        )
        r = client.get("/api/export/assets/csv", headers=_T1)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert b"name" in r.content

    def test_export_reconciliations_csv_with_data(self, client):
        doc = _post_doc(client)
        tx = _post_tx(client, amount="100.00", date="2024-06-01")
        _create_reconciliation(doc.json()["id"], tx["id"])
        r = client.get("/api/export/reconciliations/csv", headers=_T1)
        assert r.status_code == 200
        assert "text/csv" in r.headers.get("content-type", "")
        assert b"document_id" in r.content or len(r.content) > 10


# ─────────────────────────────────────────────────────────────────────────────
# 5.6 Document preview & thumbnail (Paperless proxy)
# ─────────────────────────────────────────────────────────────────────────────

class TestDocumentPreviewThumbnail:
    def _seed_doc_with_paperless(self, paperless_id=42, filename="fatura.pdf"):
        """Insert a document with a paperless_id directly into the in-memory table."""
        c = _conftest()
        c._seq["documents"] += 1
        doc = {
            "id": c._seq["documents"],
            "tenant_id": "t1",
            "supplier_nif": "",
            "client_nif": "",
            "total": Decimal("0"),
            "vat": Decimal("0"),
            "date": None,
            "type": "outro",
            "filename": filename,
            "raw_text": None,
            "status": "pendente",
            "paperless_id": paperless_id,
            "created_at": "2025-01-01T00:00:00+00:00",
            "notes": None,
            "snc_account": None,
            "classification_source": None,
        }
        c._tables["documents"].append(doc)
        return doc

    @patch("app.routes.PAPERLESS_TOKEN", "tok-test")
    @patch("app.routes.httpx.Client")
    def test_preview_success(self, mock_client_cls, client):
        doc = self._seed_doc_with_paperless(paperless_id=10, filename="inv.pdf")
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = b"%PDF-fake-content"
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_ctx)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_ctx.get.return_value = mock_resp
        mock_client_cls.return_value = mock_ctx

        r = client.get(f"/api/documents/{doc['id']}/preview", headers=_T1)
        assert r.status_code == 200
        assert r.content == b"%PDF-fake-content"
        assert "application/pdf" in r.headers.get("content-type", "")

    def test_preview_doc_not_found(self, client):
        r = client.get("/api/documents/99999/preview", headers=_T1)
        assert r.status_code == 404

    def test_preview_from_local_file(self, client):
        """Documents without paperless_id are served from local disk."""
        doc = _post_doc(client)
        doc_id = doc.json()["id"]
        r = client.get(f"/api/documents/{doc_id}/preview", headers=_T1)
        assert r.status_code == 200
        assert r.content == b"dummy"
        assert "application/pdf" in r.headers.get("content-type", "")

    @patch("app.routes.PAPERLESS_TOKEN", "tok-test")
    @patch("app.routes.httpx.Client")
    def test_preview_paperless_error(self, mock_client_cls, client):
        doc = self._seed_doc_with_paperless(paperless_id=10)
        mock_resp = MagicMock()
        mock_resp.status_code = 500
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_ctx)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_ctx.get.return_value = mock_resp
        mock_client_cls.return_value = mock_ctx

        r = client.get(f"/api/documents/{doc['id']}/preview", headers=_T1)
        assert r.status_code == 502

    @patch("app.routes.PAPERLESS_TOKEN", "tok-test")
    @patch("app.routes.httpx.Client")
    def test_preview_paperless_unreachable(self, mock_client_cls, client):
        import httpx
        doc = self._seed_doc_with_paperless(paperless_id=10)
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_ctx)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_ctx.get.side_effect = httpx.ConnectError("connection refused")
        mock_client_cls.return_value = mock_ctx

        r = client.get(f"/api/documents/{doc['id']}/preview", headers=_T1)
        assert r.status_code == 502

    @patch("app.routes.PAPERLESS_TOKEN", "tok-test")
    @patch("app.routes.httpx.Client")
    def test_thumbnail_success(self, mock_client_cls, client):
        doc = self._seed_doc_with_paperless(paperless_id=20)
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.content = b"\x89PNG-thumb"
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_ctx)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_ctx.get.return_value = mock_resp
        mock_client_cls.return_value = mock_ctx

        r = client.get(f"/api/documents/{doc['id']}/thumbnail", headers=_T1)
        assert r.status_code == 200
        assert r.content == b"\x89PNG-thumb"
        assert "image/webp" in r.headers.get("content-type", "")
        assert "max-age" in r.headers.get("cache-control", "")

    def test_thumbnail_doc_not_found(self, client):
        r = client.get("/api/documents/99999/thumbnail", headers=_T1)
        assert r.status_code == 404

    def test_thumbnail_no_paperless_id(self, client):
        doc = _post_doc(client)
        doc_id = doc.json()["id"]
        r = client.get(f"/api/documents/{doc_id}/thumbnail", headers=_T1)
        assert r.status_code == 404

    @patch("app.routes.PAPERLESS_TOKEN", "tok-test")
    @patch("app.routes.httpx.Client")
    def test_thumbnail_paperless_error(self, mock_client_cls, client):
        doc = self._seed_doc_with_paperless(paperless_id=20)
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_ctx = MagicMock()
        mock_ctx.__enter__ = MagicMock(return_value=mock_ctx)
        mock_ctx.__exit__ = MagicMock(return_value=False)
        mock_ctx.get.return_value = mock_resp
        mock_client_cls.return_value = mock_ctx

        r = client.get(f"/api/documents/{doc['id']}/thumbnail", headers=_T1)
        assert r.status_code == 502


# ─────────────────────────────────────────────────────────────────────────────
# 5.7 Reconciliation suggestions
# ─────────────────────────────────────────────────────────────────────────────

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


# ─────────────────────────────────────────────────────────────────────────────
# 5.8 Bank transaction enrichment
# ─────────────────────────────────────────────────────────────────────────────

class TestBankTransactionEnrich:
    def test_enrich_empty(self, client):
        r = client.get("/api/bank-transactions/enrich", headers=_T1)
        assert r.status_code == 200
        assert r.json() == []

    def test_enrich_with_rule_match(self, client):
        c = _conftest()
        _post_tx(amount="55.00", date="2024-06-01", desc="EDP COMERCIAL FATURA")
        c._seq["movement_rules"] += 1
        c._tables["movement_rules"].append({
            "id": c._seq["movement_rules"],
            "tenant_id": "t1",
            "name": "EDP",
            "pattern": "edp comercial",
            "category": "utilities",
            "snc_account": "62211",
            "entity_nif": "501905480",
            "priority": 10,
            "active": True,
        })
        r = client.get("/api/bank-transactions/enrich", headers=_T1)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        enriched = data[0]
        assert enriched["classified"] is True
        assert enriched["category"] == "utilities"

    def test_enrich_no_match(self, client):
        _post_tx(amount="10.00", date="2024-06-01", desc="RANDOM PAYMENT")
        r = client.get("/api/bank-transactions/enrich", headers=_T1)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert data[0]["classified"] is False


# ─────────────────────────────────────────────────────────────────────────────
# 5.9 Bank transaction duplicates
# ─────────────────────────────────────────────────────────────────────────────

class TestBankTransactionDuplicates:
    def test_duplicates_empty(self, client):
        r = client.get("/api/bank-transactions/duplicates", headers=_T1)
        assert r.status_code == 200
        assert r.json() == []

    def test_duplicates_found(self, client):
        _post_tx(amount="100.00", date="2024-06-01", desc="Pagamento A")
        _post_tx(amount="100.00", date="2024-06-02", desc="Pagamento B")
        r = client.get("/api/bank-transactions/duplicates", headers=_T1)
        assert r.status_code == 200
        data = r.json()
        assert len(data) >= 1
        assert data[0]["amount"] == 100.0 or str(data[0]["amount"]) == "100.00"

    def test_duplicates_no_false_positives(self, client):
        _post_tx(amount="100.00", date="2024-06-01", desc="Pagamento A")
        _post_tx(amount="500.00", date="2024-12-01", desc="Pagamento B")
        r = client.get("/api/bank-transactions/duplicates", headers=_T1)
        assert r.status_code == 200
        assert r.json() == []


# ─────────────────────────────────────────────────────────────────────────────
# 5.10 Movement rule PATCH
# ─────────────────────────────────────────────────────────────────────────────

class TestMovementRulePatch:
    def _create_rule(self, client):
        r = client.post(
            "/api/movement-rules",
            json={
                "name": "Original",
                "pattern": "original pattern",
                "category": "other",
                "snc_account": "60000",
                "priority": 5,
                "active": True,
            },
            headers=_T1,
        )
        assert r.status_code == 201
        return r.json()

    def test_patch_success(self, client):
        rule = self._create_rule(client)
        r = client.patch(
            f"/api/movement-rules/{rule['id']}",
            json={"name": "Updated", "category": "utilities"},
            headers=_T1,
        )
        assert r.status_code == 200
        assert r.json()["name"] == "Updated"
        assert r.json()["category"] == "utilities"
        # Unchanged fields remain
        assert r.json()["pattern"] == "original pattern"

    def test_patch_single_field(self, client):
        rule = self._create_rule(client)
        r = client.patch(
            f"/api/movement-rules/{rule['id']}",
            json={"active": False},
            headers=_T1,
        )
        assert r.status_code == 200
        assert r.json()["active"] is False

    def test_patch_not_found(self, client):
        r = client.patch(
            "/api/movement-rules/9999",
            json={"name": "No"},
            headers=_T1,
        )
        assert r.status_code == 404

    def test_patch_empty_body_422(self, client):
        rule = self._create_rule(client)
        r = client.patch(
            f"/api/movement-rules/{rule['id']}",
            json={},
            headers=_T1,
        )
        assert r.status_code == 422

    def test_patch_tenant_isolation(self, client):
        rule = self._create_rule(client)
        r = client.patch(
            f"/api/movement-rules/{rule['id']}",
            json={"name": "Hacked"},
            headers=_T2,
        )
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# 5.11 Document GET by ID (happy path)
# ─────────────────────────────────────────────────────────────────────────────

class TestDocumentGetById:
    def test_get_document_success(self, client):
        resp = _post_doc(client)
        doc_id = resp.json()["id"]
        r = client.get(f"/api/documents/{doc_id}", headers=_T1)
        assert r.status_code == 200
        data = r.json()
        assert data["id"] == doc_id
        assert "filename" in data
        assert "status" in data

    def test_get_document_not_found(self, client):
        r = client.get("/api/documents/99999", headers=_T1)
        assert r.status_code == 404
