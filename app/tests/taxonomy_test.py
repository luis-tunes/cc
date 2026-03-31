"""Tests for app/taxonomy.py — AT/SAF-T document type taxonomy."""

from app.taxonomy import (
    SAF_T_TYPES,
    VALID_INTERNAL_TYPES,
    classify_by_keywords,
    classify_by_series_prefix,
    internal_to_label,
    saft_to_internal,
)


def test_all_saft_codes_have_required_fields():
    for code, (internal_type, family, label, direction) in SAF_T_TYPES.items():
        assert internal_type, f"{code} missing internal_type"
        assert family, f"{code} missing family"
        assert label, f"{code} missing label"
        assert direction in ("emitted", "received", "either"), f"{code} invalid direction: {direction}"


def test_valid_internal_types_includes_core():
    assert "fatura" in VALID_INTERNAL_TYPES
    assert "fatura-fornecedor" in VALID_INTERNAL_TYPES
    assert "fatura-recibo" in VALID_INTERNAL_TYPES
    assert "nota-credito" in VALID_INTERNAL_TYPES
    assert "nota-debito" in VALID_INTERNAL_TYPES
    assert "recibo" in VALID_INTERNAL_TYPES
    assert "guia-remessa" in VALID_INTERNAL_TYPES
    assert "extrato" in VALID_INTERNAL_TYPES
    assert "orcamento" in VALID_INTERNAL_TYPES
    assert "outro" in VALID_INTERNAL_TYPES


def test_classify_by_keywords_fatura():
    result = classify_by_keywords("FATURA Nº FT 2026/001\nNIF: 123456789")
    assert len(result) > 0
    assert result[0][0] == "FT"  # saft_code
    assert result[0][1] == "fatura"  # internal_type


def test_classify_by_keywords_nota_credito():
    result = classify_by_keywords("NOTA DE CRÉDITO Nº NC 2026/001")
    assert len(result) > 0
    codes = [r[0] for r in result]
    assert "NC" in codes


def test_classify_by_keywords_fatura_recibo():
    result = classify_by_keywords("FATURA-RECIBO Nº FR A/123")
    assert len(result) > 0
    codes = [r[0] for r in result]
    assert "FR" in codes


def test_classify_by_keywords_extrato():
    result = classify_by_keywords("EXTRATO BANCÁRIO\nPeríodo: Janeiro 2026")
    assert len(result) > 0
    codes = [r[0] for r in result]
    assert "EB" in codes


def test_classify_by_keywords_recibo_vencimento():
    result = classify_by_keywords("RECIBO DE VENCIMENTO\nPeríodo: Março 2026")
    assert len(result) > 0
    codes = [r[0] for r in result]
    assert "RV" in codes


def test_classify_by_keywords_guia_transporte():
    result = classify_by_keywords("GUIA DE TRANSPORTE GT 2026/001")
    assert len(result) > 0
    codes = [r[0] for r in result]
    assert "GT" in codes


def test_classify_by_keywords_no_match():
    result = classify_by_keywords("nothing financial here at all")
    assert result == []


def test_classify_by_keywords_max_three():
    result = classify_by_keywords("FATURA RECIBO NOTA DE CRÉDITO EXTRATO BANCÁRIO GUIA")
    assert len(result) <= 3


def test_classify_by_series_prefix_ft():
    assert classify_by_series_prefix("FT 2026/001") == "FT"
    assert classify_by_series_prefix("FT A/123") == "FT"


def test_classify_by_series_prefix_nc():
    assert classify_by_series_prefix("NC 2026/001") == "NC"


def test_classify_by_series_prefix_fr():
    assert classify_by_series_prefix("FR A/5678") == "FR"


def test_classify_by_series_prefix_unknown():
    assert classify_by_series_prefix("XZ 001") is None
    assert classify_by_series_prefix("") is None


def test_saft_to_internal():
    assert saft_to_internal("FT") == "fatura"
    assert saft_to_internal("NC") == "nota-credito"
    assert saft_to_internal("EB") == "extrato"
    assert saft_to_internal("RV") == "recibo"
    assert saft_to_internal("XX") == "outro"


def test_internal_to_label():
    assert internal_to_label("fatura") == "Fatura"
    assert internal_to_label("nota-credito") == "Nota de Crédito"
    assert internal_to_label("unknown") == "Outro"
