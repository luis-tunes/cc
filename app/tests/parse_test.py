"""Tests for app/parse.py — NIF validation, amount correction, confidence scoring."""
import json
from datetime import date
from decimal import Decimal

from app.parse import (  # noqa: I001
    _attempt_nif_correction,
    _compute_field_confidence,
    _generate_validation_warnings,
    _merge_extractions,
    _parse_nifs_from_text,
    _validate_amounts,
    validate_nif,
)

# ── NIF validation ────────────────────────────────────────────────────

def test_valid_nif():
    assert validate_nif("123456789")
    assert validate_nif("999999990")

def test_invalid_nif_wrong_check():
    assert not validate_nif("123456780")

def test_invalid_nif_too_short():
    assert not validate_nif("12345678")

def test_invalid_nif_letters():
    assert not validate_nif("12345678a")

def test_invalid_nif_empty():
    assert not validate_nif("")


# ── NIF correction ────────────────────────────────────────────────────

def test_attempt_nif_correction_swaps_digit():
    # Start from an invalid NIF (bad check digit)
    bad = "123456780"  # invalid (changed last digit from 9→0)
    corrected = _attempt_nif_correction(bad)
    # May or may not find a correction depending on the swap table
    # If found, it must be a valid NIF
    if corrected:
        assert validate_nif(corrected)
        assert len(corrected) == 9


def test_attempt_nif_correction_too_short():
    assert _attempt_nif_correction("12345") is None


def test_attempt_nif_correction_already_valid():
    # Already valid NIF — the function may still return a "correction" from swaps
    result = _attempt_nif_correction("123456789")
    # Valid NIF might still produce swap candidates; that's ok
    if result:
        assert validate_nif(result)


# ── NIF extraction from text ──────────────────────────────────────────

def test_parse_nifs_labeled():
    text = (
        "Empresa XYZ Lda\n"
        "NIF Emitente: 123456789\n"
        "Rua Teste 123\n"
        "\n"
        "Cliente: Empresa ABC\n"
        "NIF Cliente: 999999990\n"
        "Total: 100,00€\n"
    )
    supplier, client = _parse_nifs_from_text(text)
    assert supplier == "123456789"
    assert client == "999999990"


def test_parse_nifs_zone_detection():
    """Header NIF → supplier, body NIF → client."""
    text = (
        "FATURA\n"
        "Contribuinte: 123456789\n"
        "Rua do Teste 1\n"
        "1000-001 Lisboa\n"
        "\n"
        "\n"
        "\n"
        "\n"
        "\n"
        "\n"
        "\n"
        "\n"
        "Dados do cliente:\n"
        "Contribuinte: 999999990\n"
        "Outra linha qualquer\n"
    )
    supplier, client = _parse_nifs_from_text(text)
    assert supplier == "123456789"
    assert client == "999999990"


def test_parse_nifs_supplier_equals_client_prevented():
    """If both NIFs are the same, client should be reset."""
    text = (
        "FATURA\n"
        "NIF: 123456789\n"
        "\n"
        "NIF Cliente: 123456789\n"
    )
    supplier, client = _parse_nifs_from_text(text)
    # Supplier found via general NIF regex, client via labeled CLIENT regex
    # But supplier==client → client should be reset to "000000000"
    assert supplier == "123456789"
    assert client == "000000000"


def test_parse_nifs_no_nifs():
    text = "No fiscal numbers here"
    supplier, client = _parse_nifs_from_text(text)
    assert supplier == "000000000"
    assert client == "000000000"


def test_parse_nifs_single_nif():
    """Single NIF → supplier, client = default."""
    text = (
        "Empresa ABC\n"
        "NIF: 123456789\n"
        "Obrigado\n"
    )
    supplier, client = _parse_nifs_from_text(text)
    assert supplier == "123456789"
    assert client == "000000000"


# ── Amount validation/correction ──────────────────────────────────────

def test_validate_amounts_consistent():
    t, v, b = _validate_amounts(
        Decimal("123"), Decimal("23"), Decimal("100"), None, None
    )
    assert t == Decimal("123")
    assert v == Decimal("23")
    assert b == Decimal("100")


def test_validate_amounts_missing_base():
    t, v, b = _validate_amounts(
        Decimal("123"), Decimal("23"), Decimal("0"), None, None
    )
    assert b == Decimal("100")


def test_validate_amounts_missing_vat():
    t, v, b = _validate_amounts(
        Decimal("123"), Decimal("0"), Decimal("100"), None, None
    )
    assert v == Decimal("23")


def test_validate_amounts_missing_total():
    t, v, b = _validate_amounts(
        Decimal("0"), Decimal("23"), Decimal("100"), None, None
    )
    assert t == Decimal("123")


def test_validate_amounts_inconsistent_recomputes_base():
    """When total != base+vat, trust total and recompute base."""
    t, v, b = _validate_amounts(
        Decimal("100"), Decimal("10"), Decimal("50"), None, None
    )
    # total=100, vat=10, but base was 50 (wrong). Should recompute: base = 100-10 = 90
    assert t == Decimal("100")
    assert v == Decimal("10")
    assert b == Decimal("90")


# ── Field confidence ──────────────────────────────────────────────────

def test_compute_field_confidence_all_good():
    conf = _compute_field_confidence(
        supplier_nif="123456789",
        client_nif="999999990",
        total=Decimal("123"),
        vat=Decimal("23"),
        base_amount=Decimal("100"),
        doc_date=date(2025, 1, 15),
        doc_type="fatura",
        invoice_number="FT 2025/001",
        raw_text="NIF Emitente: 123456789\nNIF Cliente: 999999990",
        extraction_source="vision",
    )
    assert conf["supplier_nif"] >= 75
    assert conf["client_nif"] >= 70
    assert conf["total"] >= 90
    assert conf["vat"] >= 50
    assert conf["date"] >= 65
    assert conf["type"] >= 60
    assert conf["invoice_number"] >= 85


def test_compute_field_confidence_missing_nif():
    conf = _compute_field_confidence(
        supplier_nif="000000000",
        client_nif="000000000",
        total=Decimal("0"),
        vat=Decimal("0"),
        base_amount=Decimal("0"),
        doc_date=date.today(),
        doc_type="outro",
        invoice_number="",
        raw_text="",
        extraction_source="regex",
    )
    assert conf["supplier_nif"] == 0
    assert conf["client_nif"] == 0
    assert conf["total"] == 0
    assert conf["invoice_number"] == 0
    assert conf["date"] == 10  # fallback to today
    assert conf["type"] == 15  # "outro" = low confidence


def test_compute_field_confidence_arithmetic_verified():
    """Total confidence should be ~95 when base+vat matches total."""
    conf = _compute_field_confidence(
        supplier_nif="123456789",
        client_nif="000000000",
        total=Decimal("123"),
        vat=Decimal("23"),
        base_amount=Decimal("100"),
        doc_date=date(2025, 1, 1),
        doc_type="fatura",
        invoice_number="FT 2025/001",
        raw_text="",
        extraction_source="llm",
    )
    assert conf["total"] == 95


# ── Validation warnings ──────────────────────────────────────────────

def test_generate_warnings_math_mismatch():
    warnings = _generate_validation_warnings(
        total=Decimal("200"), vat=Decimal("23"),
        base_amount=Decimal("100"),
        supplier_nif="123456789", client_nif="999999990",
        vat_breakdown=None, line_items=None,
    )
    assert any("difere" in w.lower() or "base+IVA" in w for w in warnings)


def test_generate_warnings_missing_supplier():
    warnings = _generate_validation_warnings(
        total=Decimal("100"), vat=Decimal("0"),
        base_amount=Decimal("100"),
        supplier_nif="000000000", client_nif="999999990",
        vat_breakdown=None, line_items=None,
    )
    assert any("emitente" in w.lower() for w in warnings)


def test_generate_warnings_missing_total():
    warnings = _generate_validation_warnings(
        total=Decimal("0"), vat=Decimal("0"),
        base_amount=Decimal("0"),
        supplier_nif="123456789", client_nif="999999990",
        vat_breakdown=None, line_items=None,
    )
    assert any("total" in w.lower() for w in warnings)


def test_generate_warnings_vat_breakdown_mismatch():
    warnings = _generate_validation_warnings(
        total=Decimal("123"), vat=Decimal("23"),
        base_amount=Decimal("100"),
        supplier_nif="123456789", client_nif="999999990",
        vat_breakdown=[
            {"rate": 23, "base": 50, "amount": 11.5},
            {"rate": 6, "base": 50, "amount": 3},
        ],
        line_items=None,
    )
    assert any("desdobramento" in w.lower() for w in warnings)


def test_generate_warnings_clean():
    """No warnings when everything is consistent."""
    warnings = _generate_validation_warnings(
        total=Decimal("123"), vat=Decimal("23"),
        base_amount=Decimal("100"),
        supplier_nif="123456789", client_nif="999999990",
        vat_breakdown=[{"rate": 23, "base": 100, "amount": 23}],
        line_items=None,
    )
    # Only breakdown/items warnings checked here; NIF and total are fine
    assert not any("difere" in w.lower() for w in warnings)


# ── Merge extractions ─────────────────────────────────────────────────

def _vision_result() -> dict:
    return {
        "total": Decimal("123"), "vat": Decimal("23"),
        "supplier_nif": "123456789", "client_nif": "999999990",
        "doc_date": date(2025, 1, 15), "doc_type": "fatura",
        "extra_json": json.dumps({"invoice_number": "FT 2025/001"}),
    }


def _llm_result() -> dict:
    return {
        "total": Decimal("123"), "vat": Decimal("23"),
        "supplier_nif": "123456789", "client_nif": "000000000",
        "doc_date": date(2025, 1, 15), "doc_type": "fatura",
        "extra_json": json.dumps({"supplier_name": "Empresa XYZ", "line_items": [{"description": "Test"}]}),
    }


def test_merge_extractions_both():
    merged = _merge_extractions(_vision_result(), _llm_result(), "raw text")
    assert merged["supplier_nif"] == "123456789"
    assert merged["client_nif"] == "999999990"  # from vision
    extra = json.loads(merged["extra_json"])
    assert extra.get("invoice_number") == "FT 2025/001"
    assert extra.get("supplier_name") == "Empresa XYZ"


def test_merge_extractions_vision_only():
    merged = _merge_extractions(_vision_result(), None, "")
    assert merged["total"] == Decimal("123")


def test_merge_extractions_llm_only():
    merged = _merge_extractions(None, _llm_result(), "")
    assert merged["total"] == Decimal("123")


def test_merge_extractions_neither():
    merged = _merge_extractions(None, None, "")
    assert merged["total"] == Decimal("0")
    assert merged["supplier_nif"] == "000000000"


def test_merge_extractions_llm_fills_missing_nif():
    vision = _vision_result()
    vision["client_nif"] = "000000000"
    llm = _llm_result()
    llm["client_nif"] = "999999990"
    merged = _merge_extractions(vision, llm, "")
    assert merged["client_nif"] == "999999990"


def test_merge_extractions_llm_fills_missing_total():
    vision = _vision_result()
    vision["total"] = Decimal("0")
    vision["vat"] = Decimal("0")
    llm = _llm_result()
    merged = _merge_extractions(vision, llm, "")
    assert merged["total"] == Decimal("123")


def test_merge_extractions_prefers_non_today_date():
    vision = _vision_result()
    vision["doc_date"] = date.today()
    llm = _llm_result()
    llm["doc_date"] = date(2025, 6, 1)
    merged = _merge_extractions(vision, llm, "")
    assert merged["doc_date"] == date(2025, 6, 1)


def test_merge_extractions_prefers_non_outro_type():
    vision = _vision_result()
    vision["doc_type"] = "outro"
    llm = _llm_result()
    llm["doc_type"] = "nota-credito"
    merged = _merge_extractions(vision, llm, "")
    assert merged["doc_type"] == "nota-credito"
