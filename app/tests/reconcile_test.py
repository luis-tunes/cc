from datetime import date, timedelta
from decimal import Decimal

from app.reconcile import AMOUNT_TOLERANCE, DATE_TOLERANCE


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
