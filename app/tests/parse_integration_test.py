"""
Parse / ingest integration tests.
Tests ingest_document with mocked httpx calls and real text-parsing logic.
"""
from datetime import date
from decimal import Decimal
from unittest.mock import patch, MagicMock

import pytest
from app.parse import (
    validate_nif, ingest_document, parse_invoice,
    _parse_amount_from_text, _parse_date_from_text,
    fetch_document_file, fetch_document_text,
)


# ── Text parsing helpers ──────────────────────────────────────────────

def test_parse_amount_total_label():
    text = "Fatura #12345\nTotal: 1.234,56 EUR\nObrigado"
    assert _parse_amount_from_text(text) == Decimal("1234.56")


def test_parse_amount_montante():
    text = "Montante: 99,99€"
    assert _parse_amount_from_text(text) == Decimal("99.99")


def test_parse_amount_fallback_euro():
    """No label → picks the largest €-formatted number."""
    text = "Linha 1: 10,50€\nLinha 2: 250,00€\nIVA: 20,00€"
    assert _parse_amount_from_text(text) == Decimal("250.00")


def test_parse_amount_no_match():
    with pytest.raises(ValueError, match="could not find amount"):
        _parse_amount_from_text("nothing here")


def test_parse_date_portuguese_month():
    text = "Data: 15 março 2026"
    assert _parse_date_from_text(text) == date(2026, 3, 15)


def test_parse_date_abbreviated():
    text = "Emissão 1 jan 2025"
    assert _parse_date_from_text(text) == date(2025, 1, 1)


def test_parse_date_no_match_returns_today():
    text = "No date here"
    result = _parse_date_from_text(text)
    assert result == date.today()


def test_parse_amount_valor():
    text = "Valor   150,00 EUR"
    assert _parse_amount_from_text(text) == Decimal("150.00")


# ── NIF extraction from text ─────────────────────────────────────────

def test_validate_nif_known_good():
    assert validate_nif("123456789") is True


def test_validate_nif_known_bad():
    assert validate_nif("123456780") is False


# ── ingest_document (full pipeline) ──────────────────────────────────

def _mock_ocr_text():
    """Sample OCR output from Paperless with Portuguese invoice text."""
    return (
        "FATURA Nº FT 2026/0042\n"
        "NIF Emitente: 123456789\n"
        "NIF Cliente: 999999990\n"
        "Data: 5 fev 2026\n"
        "Descrição         Qtd   Preço\n"
        "Farinha T65        50   125,00€\n"
        "Manteiga           20    80,00€\n"
        "Total: 205,00 EUR\n"
    )


def test_ingest_document_from_ocr_text():
    """Full ingest: invoice2data returns None → fallback to OCR text parsing."""
    ocr_text = _mock_ocr_text()

    with patch("app.parse.fetch_document_file", return_value=b"%PDF-dummy"), \
         patch("app.parse.parse_invoice", return_value=None), \
         patch("app.parse.fetch_document_text", return_value=ocr_text):
        doc_id = ingest_document(42, tenant_id="test-tenant")

    assert isinstance(doc_id, int)
    assert doc_id > 0


def test_ingest_document_extracts_correct_data():
    """Verify the data inserted into the DB from OCR text."""
    import sys
    conftest = sys.modules["tests.conftest"]
    tables = conftest.get_tables()

    ocr_text = _mock_ocr_text()
    with patch("app.parse.fetch_document_file", return_value=b"%PDF-dummy"), \
         patch("app.parse.parse_invoice", return_value=None), \
         patch("app.parse.fetch_document_text", return_value=ocr_text):
        doc_id = ingest_document(99, tenant_id="test-tenant")

    doc = next(d for d in tables["documents"] if d["id"] == doc_id)
    assert doc["supplier_nif"] == "123456789"
    assert doc["client_nif"] == "999999990"
    assert doc["total"] == Decimal("205.00")
    assert doc["date"] == date(2026, 2, 5)
    assert doc["tenant_id"] == "test-tenant"
    assert doc["paperless_id"] == 99
    assert doc["status"] == "extraído"  # total > 0


def test_ingest_document_invalid_nifs_fallback():
    """NIFs that fail validation are replaced with 000000000."""
    text = "NIF: 111111111\nNIF: 222222222\nTotal: 50,00€\nData: 1 jan 2026\n"

    with patch("app.parse.fetch_document_file", return_value=b"%PDF-dummy"), \
         patch("app.parse.parse_invoice", return_value=None), \
         patch("app.parse.fetch_document_text", return_value=text):
        doc_id = ingest_document(50)

    import sys
    tables = sys.modules["tests.conftest"].get_tables()
    doc = next(d for d in tables["documents"] if d["id"] == doc_id)
    assert doc["supplier_nif"] == "000000000"
    assert doc["client_nif"] == "000000000"


def test_ingest_document_no_amount_raises():
    """If no amount can be found, raise ValueError."""
    text = "This document has no monetary values at all"

    with patch("app.parse.fetch_document_file", return_value=b"%PDF-dummy"), \
         patch("app.parse.parse_invoice", return_value=None), \
         patch("app.parse.fetch_document_text", return_value=text):
        with pytest.raises(ValueError, match="could not extract amount"):
            ingest_document(51)


def test_ingest_document_with_invoice2data_result():
    """When invoice2data returns a result, use it directly."""
    inv_data = {
        "amount": 300.0,
        "vat": 69.0,
        "date": "2026-01-15",
        "issuer_nif": "123456789",
        "client_nif": "999999990",
        "invoice_type": "fatura",
    }

    with patch("app.parse.fetch_document_file", return_value=b"%PDF-dummy"), \
         patch("app.parse.parse_invoice", return_value=inv_data), \
         patch("app.parse.fetch_document_text", return_value="raw text here"):
        doc_id = ingest_document(60, tenant_id="t1")

    import sys
    tables = sys.modules["tests.conftest"].get_tables()
    doc = next(d for d in tables["documents"] if d["id"] == doc_id)
    assert doc["total"] == Decimal("300")
    assert doc["vat"] == Decimal("69")
    assert doc["date"] == date(2026, 1, 15)
    assert doc["type"] == "fatura"
    assert doc["tenant_id"] == "t1"


def test_ingest_upserts_on_same_paperless_id():
    """Second ingest with same paperless_id updates the existing doc."""
    text1 = "Total: 100,00€\nData: 1 jan 2026\n"
    text2 = "Total: 200,00€\nData: 2 fev 2026\n"

    with patch("app.parse.fetch_document_file", return_value=b"%PDF-dummy"), \
         patch("app.parse.parse_invoice", return_value=None), \
         patch("app.parse.fetch_document_text", return_value=text1):
        id1 = ingest_document(70)

    with patch("app.parse.fetch_document_file", return_value=b"%PDF-dummy"), \
         patch("app.parse.parse_invoice", return_value=None), \
         patch("app.parse.fetch_document_text", return_value=text2):
        id2 = ingest_document(70)

    # Same paperless_id → same doc updated (conftest simulates upsert)
    import sys
    tables = sys.modules["tests.conftest"].get_tables()
    docs_with_pid_70 = [d for d in tables["documents"] if d.get("paperless_id") == 70]
    assert len(docs_with_pid_70) == 1
    assert docs_with_pid_70[0]["total"] == Decimal("200.00")
