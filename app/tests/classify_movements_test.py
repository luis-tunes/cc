"""Tests for movement classification engine."""
from unittest.mock import patch, MagicMock

import pytest


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
