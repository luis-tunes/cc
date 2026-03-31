"""Bank CSV parser tests — auto-detection & parsing."""
from datetime import date
from decimal import Decimal

from app.bank_parsers import _parse_amount, _parse_date, parse_bank_csv

# ═══════════════════════════════════════════════════════════════════════
# ── Amount parsing ────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_parse_amount_pt_locale():
    assert _parse_amount("1.234,56") == Decimal("1234.56")


def test_parse_amount_negative():
    assert _parse_amount("-100,50") == Decimal("-100.50")


def test_parse_amount_empty():
    assert _parse_amount("") == Decimal("0")
    assert _parse_amount("-") == Decimal("0")


def test_parse_amount_simple():
    assert _parse_amount("50,00") == Decimal("50.00")


# ═══════════════════════════════════════════════════════════════════════
# ── Date parsing ──────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_parse_date_dd_mm_yyyy():
    assert _parse_date("15-06-2024") == date(2024, 6, 15)


def test_parse_date_slash():
    assert _parse_date("15/06/2024") == date(2024, 6, 15)


def test_parse_date_iso():
    assert _parse_date("2024-06-15") == date(2024, 6, 15)


def test_parse_date_dot():
    assert _parse_date("15.06.2024") == date(2024, 6, 15)


def test_parse_date_empty():
    assert _parse_date("") is None


def test_parse_date_invalid():
    assert _parse_date("not-a-date") is None


# ═══════════════════════════════════════════════════════════════════════
# ── CSV parsing ───────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_parse_empty():
    assert parse_bank_csv("") == []


def test_parse_cgd():
    csv = """CaixaDirecta;Extrato
15-06-2024;Compra POS;-50,00;
16-06-2024;Transferencia;;100,00"""
    rows = parse_bank_csv(csv)
    assert len(rows) == 2
    assert rows[0]["description"] == "Compra POS"
    assert isinstance(rows[0]["date"], date)


def test_parse_millennium():
    csv = """Millennium;Extrato
15-06-2024;Pagamento;50,00;
16-06-2024;Deposito;;200,00"""
    rows = parse_bank_csv(csv)
    assert len(rows) == 2


def test_parse_bpi():
    csv = """BPI;Extrato
15-06-2024;Compra;-30,00"""
    rows = parse_bank_csv(csv)
    assert len(rows) == 1
    assert rows[0]["description"] == "Compra"


def test_parse_novo_banco():
    csv = """Novo Banco;Extrato
15-06-2024;OP;Compra;-25,00"""
    rows = parse_bank_csv(csv)
    assert len(rows) == 1


def test_parse_santander():
    csv = """Santander;Extrato
15-06-2024;Pagamento;REF123;-80,00"""
    rows = parse_bank_csv(csv)
    assert len(rows) == 1


def test_parse_generic():
    csv = """Data;Descricao;Valor
15-06-2024;Compra genérica;-42,50"""
    rows = parse_bank_csv(csv)
    assert len(rows) == 1
    assert rows[0]["description"] == "Compra genérica"
