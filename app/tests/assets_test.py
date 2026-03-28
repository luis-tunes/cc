"""Tests for app/assets.py — depreciation calculations."""

import datetime
from decimal import Decimal

from app.assets import compute_current_value, depreciation_schedule


def _make_asset(**overrides):
    base = {
        "acquisition_cost": "10000",
        "depreciation_method": "linha-reta",
        "useful_life_years": 5,
        "acquisition_date": "2020-01-01",
        "status": "ativo",
    }
    base.update(overrides)
    return base


class TestComputeCurrentValue:
    def test_straight_line_fully_depreciated(self):
        asset = _make_asset(acquisition_date="2015-01-01", useful_life_years=5)
        value = compute_current_value(asset)
        assert value == Decimal("0")

    def test_straight_line_partial(self):
        # Set acquisition date to 1 year ago (approximately)
        one_year_ago = (datetime.date.today() - datetime.timedelta(days=365)).isoformat()
        asset = _make_asset(acquisition_date=one_year_ago, useful_life_years=10)
        value = compute_current_value(asset)
        # After 1 year of 10-year life, ~90% remaining
        assert Decimal("8900") < value < Decimal("9100")

    def test_no_depreciation_method(self):
        asset = _make_asset(depreciation_method="não-definido")
        value = compute_current_value(asset)
        assert value == Decimal("10000")

    def test_zero_useful_life(self):
        asset = _make_asset(useful_life_years=0)
        value = compute_current_value(asset)
        assert value == Decimal("10000")

    def test_inactive_asset(self):
        asset = _make_asset(status="vendido")
        value = compute_current_value(asset)
        assert value == Decimal("10000")

    def test_future_acquisition_date(self):
        future = (datetime.date.today() + datetime.timedelta(days=30)).isoformat()
        asset = _make_asset(acquisition_date=future)
        value = compute_current_value(asset)
        assert value == Decimal("10000")

    def test_date_object_instead_of_string(self):
        old = datetime.date(2015, 1, 1)
        asset = _make_asset(acquisition_date=old, useful_life_years=5)
        value = compute_current_value(asset)
        assert value == Decimal("0")

    def test_declining_balance_partial(self):
        one_year_ago = (datetime.date.today() - datetime.timedelta(days=365)).isoformat()
        asset = _make_asset(
            acquisition_date=one_year_ago,
            depreciation_method="quotas-decrescentes",
            useful_life_years=5,
        )
        value = compute_current_value(asset)
        # Declining balance depreciates more aggressively at first
        assert Decimal("5000") < value < Decimal("7500")

    def test_declining_balance_fully_depreciated(self):
        asset = _make_asset(
            acquisition_date="2010-01-01",
            depreciation_method="quotas-decrescentes",
            useful_life_years=5,
        )
        value = compute_current_value(asset)
        assert value >= Decimal("0")

    def test_unknown_method_returns_cost(self):
        asset = _make_asset(depreciation_method="unknown-method")
        value = compute_current_value(asset)
        assert value == Decimal("10000")


class TestDepreciationSchedule:
    def test_straight_line_schedule_length(self):
        asset = _make_asset(useful_life_years=5)
        schedule = depreciation_schedule(asset)
        assert len(schedule) == 5

    def test_straight_line_schedule_values(self):
        asset = _make_asset(acquisition_cost="10000", useful_life_years=5)
        schedule = depreciation_schedule(asset)
        # Each year should depreciate 2000
        for entry in schedule:
            assert abs(entry["annual_depreciation"] - 2000.0) < 0.01
        # Last entry should be fully depreciated
        assert abs(schedule[-1]["net_book_value"]) < 0.01

    def test_straight_line_years_correct(self):
        asset = _make_asset(acquisition_date="2020-01-01", useful_life_years=3)
        schedule = depreciation_schedule(asset)
        assert [e["year"] for e in schedule] == [2020, 2021, 2022]

    def test_declining_balance_schedule(self):
        asset = _make_asset(depreciation_method="quotas-decrescentes", useful_life_years=5)
        schedule = depreciation_schedule(asset)
        assert len(schedule) == 5
        # First year depreciation should be higher than last
        assert schedule[0]["annual_depreciation"] >= schedule[-1]["annual_depreciation"]

    def test_no_schedule_for_undefined_method(self):
        asset = _make_asset(depreciation_method="não-definido")
        schedule = depreciation_schedule(asset)
        assert schedule == []

    def test_no_schedule_for_zero_life(self):
        asset = _make_asset(useful_life_years=0)
        schedule = depreciation_schedule(asset)
        assert schedule == []

    def test_accumulated_is_monotonic(self):
        asset = _make_asset(useful_life_years=10)
        schedule = depreciation_schedule(asset)
        accumulated = [e["accumulated_depreciation"] for e in schedule]
        assert accumulated == sorted(accumulated)

    def test_net_book_value_is_monotonic_decreasing(self):
        asset = _make_asset(useful_life_years=10)
        schedule = depreciation_schedule(asset)
        nbv = [e["net_book_value"] for e in schedule]
        # Should be monotonically decreasing
        for i in range(1, len(nbv)):
            assert nbv[i] <= nbv[i - 1]
