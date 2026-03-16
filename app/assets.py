"""Asset depreciation calculations.

Supports straight-line and declining balance methods.
"""

import datetime
from decimal import Decimal


def compute_current_value(asset: dict) -> Decimal:
    """Calculate the current net book value based on depreciation."""
    cost = Decimal(str(asset["acquisition_cost"]))
    method = asset["depreciation_method"]
    years = asset["useful_life_years"]
    acq_date = asset["acquisition_date"]

    if method == "não-definido" or years <= 0 or asset["status"] != "ativo":
        return cost

    today = datetime.date.today()
    if isinstance(acq_date, str):
        acq_date = datetime.date.fromisoformat(acq_date)

    elapsed_days = (today - acq_date).days
    if elapsed_days <= 0:
        return cost

    total_days = years * 365

    if method == "linha-reta":
        depreciated = cost * Decimal(str(min(elapsed_days, total_days))) / Decimal(str(total_days))
        return max(cost - depreciated, Decimal("0"))

    if method == "quotas-decrescentes":
        rate = Decimal("2") / Decimal(str(years))
        value = cost
        elapsed_years = elapsed_days / 365
        for _ in range(int(elapsed_years)):
            depreciation = value * rate
            value = max(value - depreciation, Decimal("0"))
        # Partial year
        partial = Decimal(str(elapsed_years % 1))
        if partial > 0:
            depreciation = value * rate * partial
            value = max(value - depreciation, Decimal("0"))
        return value

    return cost


def depreciation_schedule(asset: dict) -> list[dict]:
    """Generate a year-by-year depreciation schedule."""
    cost = Decimal(str(asset["acquisition_cost"]))
    method = asset["depreciation_method"]
    years = asset["useful_life_years"]
    acq_date = asset["acquisition_date"]

    if isinstance(acq_date, str):
        acq_date = datetime.date.fromisoformat(acq_date)

    if method == "não-definido" or years <= 0:
        return []

    start_year = acq_date.year
    schedule = []

    if method == "linha-reta":
        annual = cost / Decimal(str(years))
        accumulated = Decimal("0")
        for i in range(years):
            accumulated = min(accumulated + annual, cost)
            schedule.append({
                "year": start_year + i,
                "annual_depreciation": float(annual),
                "accumulated_depreciation": float(accumulated),
                "net_book_value": float(cost - accumulated),
            })

    elif method == "quotas-decrescentes":
        rate = Decimal("2") / Decimal(str(years))
        value = cost
        accumulated = Decimal("0")
        for i in range(years):
            dep = value * rate
            if dep < cost / Decimal(str(years)):
                dep = cost / Decimal(str(years))
            dep = min(dep, value)
            accumulated += dep
            value = cost - accumulated
            schedule.append({
                "year": start_year + i,
                "annual_depreciation": float(dep),
                "accumulated_depreciation": float(accumulated),
                "net_book_value": float(value),
            })

    return schedule
