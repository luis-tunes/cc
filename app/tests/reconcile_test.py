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
