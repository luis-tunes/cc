"""Tests for classification rules CRUD and auto-classification engine."""
import sys
from decimal import Decimal

from app.classify import _matches, classify_document


class TestClassifyMatches:
    def test_equals_match(self):
        rule = {"field": "supplier_nif", "operator": "equals", "value": "123456789"}
        doc = {"supplier_nif": "123456789", "total": Decimal("100")}
        assert _matches(rule, doc) is True

    def test_equals_no_match(self):
        rule = {"field": "supplier_nif", "operator": "equals", "value": "999999999"}
        doc = {"supplier_nif": "123456789", "total": Decimal("100")}
        assert _matches(rule, doc) is False

    def test_contains_match(self):
        rule = {"field": "description", "operator": "contains", "value": "eletricidade"}
        doc = {"raw_text": "Fatura de eletricidade mensal", "total": Decimal("50")}
        assert _matches(rule, doc) is True

    def test_contains_no_match(self):
        rule = {"field": "description", "operator": "contains", "value": "agua"}
        doc = {"raw_text": "Fatura de eletricidade mensal", "total": Decimal("50")}
        assert _matches(rule, doc) is False

    def test_starts_with_match(self):
        rule = {"field": "type", "operator": "starts_with", "value": "fat"}
        doc = {"type": "fatura", "total": Decimal("100")}
        assert _matches(rule, doc) is True

    def test_gte_match(self):
        rule = {"field": "amount_gte", "operator": "gte", "value": "100"}
        doc = {"total": Decimal("150"), "type": "fatura"}
        assert _matches(rule, doc) is True

    def test_gte_no_match(self):
        rule = {"field": "amount_gte", "operator": "gte", "value": "200"}
        doc = {"total": Decimal("150"), "type": "fatura"}
        assert _matches(rule, doc) is False

    def test_lte_match(self):
        rule = {"field": "amount_lte", "operator": "lte", "value": "100"}
        doc = {"total": Decimal("50"), "type": "fatura"}
        assert _matches(rule, doc) is True

    def test_missing_field(self):
        rule = {"field": "supplier_nif", "operator": "equals", "value": "123"}
        doc = {"total": Decimal("100")}
        assert _matches(rule, doc) is False

    def test_case_insensitive(self):
        rule = {"field": "description", "operator": "contains", "value": "EDP"}
        doc = {"raw_text": "Fatura edp comercial", "total": Decimal("80")}
        assert _matches(rule, doc) is True

    def test_not_equals_match(self):
        rule = {"field": "type", "operator": "not_equals", "value": "fatura"}
        doc = {"type": "recibo", "total": Decimal("100")}
        assert _matches(rule, doc) is True

    def test_not_equals_no_match(self):
        rule = {"field": "type", "operator": "not_equals", "value": "fatura"}
        doc = {"type": "fatura", "total": Decimal("100")}
        assert _matches(rule, doc) is False

    def test_not_contains_match(self):
        rule = {"field": "description", "operator": "not_contains", "value": "agua"}
        doc = {"raw_text": "Fatura de eletricidade", "total": Decimal("50")}
        assert _matches(rule, doc) is True

    def test_not_contains_no_match(self):
        rule = {"field": "description", "operator": "not_contains", "value": "eletricidade"}
        doc = {"raw_text": "Fatura de eletricidade", "total": Decimal("50")}
        assert _matches(rule, doc) is False

    def test_regex_match(self):
        rule = {"field": "description", "operator": "regex", "value": r"EDP\s+\d+"}
        doc = {"raw_text": "Pagamento EDP 12345", "total": Decimal("80")}
        assert _matches(rule, doc) is True

    def test_regex_no_match(self):
        rule = {"field": "description", "operator": "regex", "value": r"^VODAFONE"}
        doc = {"raw_text": "Pagamento EDP 12345", "total": Decimal("80")}
        assert _matches(rule, doc) is False

    def test_regex_invalid_pattern_returns_false(self):
        rule = {"field": "description", "operator": "regex", "value": "[invalid"}
        doc = {"raw_text": "anything", "total": Decimal("80")}
        assert _matches(rule, doc) is False

    def test_unknown_operator_returns_false(self):
        rule = {"field": "type", "operator": "between", "value": "x"}
        doc = {"type": "fatura", "total": Decimal("100")}
        assert _matches(rule, doc) is False


class TestClassifyDocument:
    def test_no_tenant_returns_none(self):
        assert classify_document({"total": Decimal("100")}, None) is None

    def test_first_matching_rule_wins(self, _clean_db_and_patch):
        tables = sys.modules["tests.conftest"].get_tables()
        tables["classification_rules"].extend([
            {"id": 1, "tenant_id": "t1", "field": "type", "operator": "equals",
             "value": "fatura", "account": "21", "label": "Fornecedores",
             "priority": 0, "active": True},
            {"id": 2, "tenant_id": "t1", "field": "type", "operator": "equals",
             "value": "fatura", "account": "62", "label": "FSE",
             "priority": 1, "active": True},
        ])
        doc = {"type": "fatura", "total": Decimal("100"), "supplier_nif": "123456789"}
        result = classify_document(doc, "t1")
        assert result is not None
        assert result["account"] == "21"
        assert result["source"] == "rule"

    def test_inactive_rules_skipped(self, _clean_db_and_patch):
        tables = sys.modules["tests.conftest"].get_tables()
        tables["classification_rules"].append(
            {"id": 1, "tenant_id": "t1", "field": "type", "operator": "equals",
             "value": "fatura", "account": "21", "label": "Fornecedores",
             "priority": 0, "active": False},
        )
        doc = {"type": "fatura", "total": Decimal("100")}
        result = classify_document(doc, "t1")
        assert result is None

    def test_no_matching_rules(self, _clean_db_and_patch):
        tables = sys.modules["tests.conftest"].get_tables()
        tables["classification_rules"].append(
            {"id": 1, "tenant_id": "t1", "field": "type", "operator": "equals",
             "value": "recibo", "account": "71", "label": "Vendas",
             "priority": 0, "active": True},
        )
        doc = {"type": "fatura", "total": Decimal("100")}
        result = classify_document(doc, "t1")
        assert result is None


class TestClassificationRulesAPI:
    def test_create_rule(self, client):
        resp = client.post("/api/classification-rules", json={
            "field": "supplier_nif",
            "operator": "equals",
            "value": "123456789",
            "account": "62",
            "label": "FSE",
        })
        assert resp.status_code == 201
        data = resp.json()
        assert data["field"] == "supplier_nif"
        assert data["account"] == "62"
        assert data["active"] is True

    def test_create_rule_regex_operator(self, client):
        resp = client.post("/api/classification-rules", json={
            "field": "description",
            "operator": "regex",
            "value": r"EDP\s+\d+",
            "account": "62",
            "label": "EDP",
        })
        assert resp.status_code == 201
        assert resp.json()["operator"] == "regex"

    def test_create_rule_not_contains_operator(self, client):
        resp = client.post("/api/classification-rules", json={
            "field": "description",
            "operator": "not_contains",
            "value": "agua",
            "account": "63",
        })
        assert resp.status_code == 201

    def test_create_rule_invalid_field(self, client):
        resp = client.post("/api/classification-rules", json={
            "field": "invalid_field",
            "operator": "equals",
            "value": "test",
            "account": "62",
        })
        assert resp.status_code == 422

    def test_create_rule_invalid_operator(self, client):
        resp = client.post("/api/classification-rules", json={
            "field": "type",
            "operator": "invalid_op",
            "value": "test",
            "account": "62",
        })
        assert resp.status_code == 422

    def test_list_rules(self, client):
        client.post("/api/classification-rules", json={
            "field": "type", "operator": "equals", "value": "fatura", "account": "21",
        })
        client.post("/api/classification-rules", json={
            "field": "supplier_nif", "operator": "equals", "value": "999", "account": "62",
        })
        resp = client.get("/api/classification-rules")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) >= 2

    def test_update_rule(self, client):
        resp = client.post("/api/classification-rules", json={
            "field": "type", "operator": "equals", "value": "fatura", "account": "21",
        })
        rule_id = resp.json()["id"]
        resp = client.patch(f"/api/classification-rules/{rule_id}", json={"active": False})
        assert resp.status_code == 200
        assert resp.json()["active"] is False

    def test_delete_rule(self, client):
        resp = client.post("/api/classification-rules", json={
            "field": "type", "operator": "equals", "value": "fatura", "account": "21",
        })
        rule_id = resp.json()["id"]
        resp = client.delete(f"/api/classification-rules/{rule_id}")
        assert resp.status_code == 204
