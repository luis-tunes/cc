"""Tests for movement classification engine."""
import base64
import datetime
import json
import sys
from decimal import Decimal
from unittest.mock import MagicMock, patch


def _conftest():
    return sys.modules["tests.conftest"]


def _jwt_headers(tenant_id: str, user_id: str = "user-1") -> dict:
    payload = {"sub": user_id, "org_id": tenant_id, "email": f"{user_id}@test.pt"}
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    return {"Authorization": f"Bearer {header}.{body}."}


_T1 = _jwt_headers("t1")
_T2 = _jwt_headers("t2")


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


def _make_conn(rows):
    """Create a mock connection context manager that returns given rows."""
    mock_conn = MagicMock()
    mock_cursor = MagicMock()
    mock_cursor.fetchall.return_value = rows
    mock_cursor.fetchone.return_value = rows[0] if rows else None
    mock_conn.execute.return_value = mock_cursor
    ctx = MagicMock()
    ctx.__enter__ = MagicMock(return_value=mock_conn)
    ctx.__exit__ = MagicMock(return_value=False)
    return ctx


class TestClassifyMovement:
    def test_matches_rule(self):
        from app.classify_movements import classify_movement

        rules = [
            {"id": 1, "pattern": "supermercado", "category": "alimentacao",
             "snc_account": "622", "entity_nif": "123456789"},
        ]
        with patch("app.classify_movements.get_conn", return_value=_make_conn(rules)):
            result = classify_movement("Pag. SUPERMERCADO CONTINENTE", "t1")
            assert result is not None
            assert result["category"] == "alimentacao"
            assert result["snc_account"] == "622"
            assert result["entity_nif"] == "123456789"
            assert result["source"] == "rule"

    def test_no_match(self):
        from app.classify_movements import classify_movement

        rules = [
            {"id": 1, "pattern": "supermercado", "category": "alimentacao",
             "snc_account": "622", "entity_nif": None},
        ]
        with patch("app.classify_movements.get_conn", return_value=_make_conn(rules)):
            result = classify_movement("Transferencia bancaria", "t1")
            assert result is None

    def test_case_insensitive(self):
        from app.classify_movements import classify_movement

        rules = [
            {"id": 1, "pattern": "EDP Comercial", "category": "energia",
             "snc_account": "624", "entity_nif": None},
        ]
        with patch("app.classify_movements.get_conn", return_value=_make_conn(rules)):
            result = classify_movement("pag edp comercial ref 123", "t1")
            assert result is not None
            assert result["category"] == "energia"

    def test_empty_rules(self):
        from app.classify_movements import classify_movement

        with patch("app.classify_movements.get_conn", return_value=_make_conn([])):
            result = classify_movement("anything", "t1")
            assert result is None

    def test_first_matching_rule_wins(self):
        from app.classify_movements import classify_movement

        rules = [
            {"id": 1, "pattern": "edp", "category": "energia",
             "snc_account": "624", "entity_nif": None},
            {"id": 2, "pattern": "edp comercial", "category": "eletricidade",
             "snc_account": "624.1", "entity_nif": None},
        ]
        with patch("app.classify_movements.get_conn", return_value=_make_conn(rules)):
            result = classify_movement("EDP Comercial fatura", "t1")
            assert result["category"] == "energia"  # First rule matches


class TestDetectEntity:
    def test_matches_supplier(self):
        from app.classify_movements import detect_entity

        suppliers = [
            {"id": 1, "name": "Continente", "nif": "500100144"},
        ]
        with patch("app.classify_movements.get_conn", return_value=_make_conn(suppliers)):
            result = detect_entity("Pag. CONTINENTE ref 123", "t1")
            assert result is not None
            assert result["nif"] == "500100144"
            assert result["name"] == "Continente"
            assert result["type"] == "fornecedor"

    def test_no_match(self):
        from app.classify_movements import detect_entity

        suppliers = [
            {"id": 1, "name": "Continente", "nif": "500100144"},
        ]
        with patch("app.classify_movements.get_conn", return_value=_make_conn(suppliers)):
            result = detect_entity("Transferencia para IBAN", "t1")
            assert result is None

    def test_empty_suppliers(self):
        from app.classify_movements import detect_entity

        with patch("app.classify_movements.get_conn", return_value=_make_conn([])):
            result = detect_entity("anything", "t1")
            assert result is None

    def test_none_name_supplier(self):
        from app.classify_movements import detect_entity

        suppliers = [
            {"id": 1, "name": None, "nif": "123456789"},
        ]
        with patch("app.classify_movements.get_conn", return_value=_make_conn(suppliers)):
            result = detect_entity("something", "t1")
            assert result is None


# ── Movement rules CRUD (from operations_test.py) ────────────────────


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


def test_classify_inactive_rule_ignored(client):
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


# ── Bank transaction enrichment (from operations_test.py) ────────────


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


# ── Bank transaction duplicates (from operations_test.py) ────────────


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


# ── Movement rule PATCH (from operations_test.py) ────────────────────


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
