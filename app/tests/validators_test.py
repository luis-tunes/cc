"""Tests for app/validators.py — post-extraction validation engine."""

from decimal import Decimal

from app.validators import validate_extraction


def _base_data() -> dict:
    """Consistent extraction with total=base+vat."""
    return {
        "type": "fatura",
        "supplier_nif": "123456789",
        "client_nif": "999999990",
        "total": Decimal("123.00"),
        "base_amount": Decimal("100.00"),
        "vat": Decimal("23.00"),
        "date": "2025-01-15",
    }


def test_valid_extraction_passes():
    data = _base_data()
    result = validate_extraction(data)
    assert result["math_valid"] is True
    assert result["nifs_valid"] is True
    assert result["confidence_adjustment"] >= 0


def test_math_invalid_total_mismatch():
    data = _base_data()
    data["total"] = Decimal("200.00")  # wrong total
    result = validate_extraction(data)
    assert result["math_valid"] is False
    assert len(result["warnings"]) > 0


def test_supplier_equals_client_warning():
    data = _base_data()
    data["client_nif"] = data["supplier_nif"]
    result = validate_extraction(data)
    assert any("==" in w or "=" in w for w in result["warnings"])


def test_nif_invalid_checkdigit():
    data = _base_data()
    data["supplier_nif"] = "123456780"  # bad check digit
    result = validate_extraction(data)
    assert result["nifs_valid"] is False


def test_future_date_warning():
    data = _base_data()
    data["date"] = "2099-01-01"
    result = validate_extraction(data)
    assert any("futuro" in w.lower() for w in result["warnings"])


def test_old_date_warning():
    data = _base_data()
    data["date"] = "2010-01-01"
    result = validate_extraction(data)
    assert any("2015" in w for w in result["warnings"])


def test_atcud_valid():
    data = _base_data()
    data["atcud"] = "ABCD1234-567"
    result = validate_extraction(data)
    assert not any("ATCUD" in w for w in result["warnings"])


def test_atcud_invalid():
    data = _base_data()
    data["atcud"] = "invalid!!!"
    result = validate_extraction(data)
    assert any("ATCUD" in w for w in result["warnings"])


def test_invalid_vat_rate_warning():
    data = _base_data()
    data["vat_breakdown"] = [{"rate": Decimal("15"), "base": Decimal("100"), "amount": Decimal("15")}]
    result = validate_extraction(data)
    assert any("taxa" in w.lower() or "IVA" in w for w in result["warnings"])


def test_valid_vat_rates_no_warning():
    data = _base_data()
    data["vat_breakdown"] = [
        {"rate": Decimal("23"), "base": Decimal("100"), "amount": Decimal("23")},
    ]
    result = validate_extraction(data)
    # Should not warn about the rate itself (may still warn about breakdown sum if mismatched)
    assert not any("taxa" in w.lower() and "23" in w for w in result["warnings"])


def test_no_amounts_skips_math():
    data = {"type": "outro", "supplier_nif": "999999990"}
    result = validate_extraction(data)
    assert result["math_valid"] is True  # nothing to validate
    assert result["corrections"] == {}


def test_confidence_adjustment_negative_on_issues():
    data = _base_data()
    data["total"] = Decimal("999.99")  # mismatches base+vat
    data["supplier_nif"] = "123456780"  # bad check digit
    data["date"] = "2099-12-31"
    result = validate_extraction(data)
    assert result["confidence_adjustment"] < 0


def test_vat_breakdown_sum_mismatch():
    data = _base_data()
    data["vat_breakdown"] = [
        {"rate": Decimal("23"), "base": Decimal("50"), "amount": Decimal("11.50")},
        {"rate": Decimal("6"), "base": Decimal("50"), "amount": Decimal("3.00")},
    ]
    # breakdown total = 11.50 + 3.00 = 14.50, but vat=23.00 → mismatch
    result = validate_extraction(data)
    assert any("desdobramento" in w.lower() or "breakdown" in w.lower()
               for w in result["warnings"])


def test_vat_rate_base_mismatch():
    data = _base_data()
    data["vat_breakdown"] = [
        {"rate": Decimal("23"), "base": Decimal("100"), "amount": Decimal("30")},  # should be 23
    ]
    result = validate_extraction(data)
    assert any("taxa" in w.lower() or "base" in w.lower() for w in result["warnings"])


def test_confidence_boost_on_good_data():
    data = _base_data()
    result = validate_extraction(data)
    assert result["confidence_adjustment"] > 0
