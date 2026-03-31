"""Extraction validator — math reconciliation, NIF checks, type coherence.

Post-LLM validation layer. No LLM calls — purely deterministic.
"""

from __future__ import annotations

import logging
import re
from datetime import date
from decimal import Decimal, InvalidOperation

from app.parse import validate_nif

log = logging.getLogger(__name__)

# Valid Portuguese VAT rates (mainland + islands)
VALID_VAT_RATES = frozenset({0, 4, 5, 6, 9, 12, 13, 16, 22, 23})

# ATCUD format: alphanumeric code + hyphen + sequence number
_ATCUD_RE = re.compile(r"^[A-Za-z0-9]{8}-\d+$")


def validate_extraction(data: dict) -> dict:
    """Run all validation checks on extracted data.

    Returns dict with:
      - warnings: list[str] — human-readable issues
      - corrections: dict — auto-corrected fields
      - math_valid: bool — whether amounts are internally consistent
      - nifs_valid: bool — whether all NIFs pass check-digit
      - confidence_adjustment: int — points to add/subtract from confidence
    """
    warnings: list[str] = []
    corrections: dict = {}
    confidence_adj = 0

    # -- Math validation --
    total = _to_decimal(data.get("total", 0))
    vat = _to_decimal(data.get("vat", 0))
    base_amount = _to_decimal(data.get("base_amount", 0))
    vat_breakdown = data.get("vat_breakdown", [])
    line_items = data.get("line_items", [])

    math_valid = True

    # Check total = base + vat
    if total > 0 and base_amount > 0 and vat >= 0:
        expected = base_amount + vat
        diff = abs(total - expected)
        if diff > Decimal("0.05"):
            warnings.append(f"Total ({total}) ≠ base+IVA ({expected}), diferença €{diff:.2f}")
            math_valid = False
            confidence_adj -= 10

    # Check line items sum
    if line_items and isinstance(line_items, list) and total > 0:
        lines_sum = _sum_field(line_items, "total")
        if lines_sum > 0:
            diff = abs(lines_sum - total)
            if diff > Decimal("0.50"):
                warnings.append(f"Soma das linhas ({lines_sum}) ≠ total ({total})")
                math_valid = False
                confidence_adj -= 5

    # Check VAT breakdown sums
    if vat_breakdown and isinstance(vat_breakdown, list) and vat > 0:
        breakdown_sum = _sum_field(vat_breakdown, "amount")
        if breakdown_sum > 0:
            diff = abs(breakdown_sum - vat)
            if diff > Decimal("0.05"):
                warnings.append(f"Soma desdobramento IVA ({breakdown_sum}) ≠ IVA ({vat})")
                math_valid = False
                confidence_adj -= 5

    # Check VAT rates are valid PT rates
    if vat_breakdown and isinstance(vat_breakdown, list):
        for item in vat_breakdown:
            if not isinstance(item, dict):
                continue
            rate = item.get("rate")
            if rate is not None:
                try:
                    rate_int = int(float(rate))
                    if rate_int not in VALID_VAT_RATES:
                        warnings.append(f"Taxa IVA {rate}% não é uma taxa válida em Portugal")
                        confidence_adj -= 3
                except (ValueError, TypeError):
                    pass

    # Check per-line VAT rate × base ≈ amount
    if vat_breakdown and isinstance(vat_breakdown, list):
        for item in vat_breakdown:
            if not isinstance(item, dict):
                continue
            try:
                r = _to_decimal(item.get("rate", 0))
                b = _to_decimal(item.get("base", 0))
                a = _to_decimal(item.get("amount", 0))
                if r > 0 and b > 0 and a > 0:
                    expected_a = b * r / 100
                    if abs(expected_a - a) > Decimal("0.05"):
                        warnings.append(f"IVA {r}%: base×taxa ({expected_a:.2f}) ≠ montante ({a})")
            except (InvalidOperation, ValueError):
                pass

    # -- NIF validation --
    nifs_valid = True
    supplier_nif = str(data.get("supplier_nif", "000000000")).strip()
    client_nif = str(data.get("client_nif", "000000000")).strip()

    if supplier_nif != "000000000" and not validate_nif(supplier_nif):
        warnings.append(f"NIF emitente ({supplier_nif}) falha check-digit")
        nifs_valid = False
        confidence_adj -= 10

    if client_nif != "000000000" and not validate_nif(client_nif):
        warnings.append(f"NIF cliente ({client_nif}) falha check-digit")
        nifs_valid = False
        confidence_adj -= 5

    if supplier_nif == client_nif and supplier_nif != "000000000":
        warnings.append("NIF emitente = NIF cliente (possível erro)")
        confidence_adj -= 10

    # -- ATCUD validation --
    atcud = str(data.get("atcud", "")).strip()
    if atcud and not _ATCUD_RE.match(atcud):
        warnings.append(f"ATCUD ({atcud}) formato inválido")
        confidence_adj -= 2

    # -- Date validation --
    doc_date = data.get("date") or data.get("doc_date")
    if doc_date:
        if isinstance(doc_date, str):
            import contextlib
            with contextlib.suppress(ValueError):
                doc_date = date.fromisoformat(doc_date)
        if isinstance(doc_date, date):
            if doc_date > date.today():
                warnings.append("Data do documento é no futuro")
                confidence_adj -= 5
            elif doc_date.year < 2015:
                warnings.append("Data do documento anterior a 2015")
                confidence_adj -= 3

    # -- Type coherence --
    doc_type = str(data.get("type", "outro"))
    if doc_type in ("nota-credito",) and total > 0:
        # NC should typically have negative amounts or reference an original doc
        pass  # Not a hard error — some NCs have positive amounts

    # -- Confidence boost for good data --
    if math_valid and nifs_valid and total > 0:
        confidence_adj += 5

    return {
        "warnings": warnings,
        "corrections": corrections,
        "math_valid": math_valid,
        "nifs_valid": nifs_valid,
        "confidence_adjustment": confidence_adj,
    }


def _to_decimal(value: object) -> Decimal:
    try:
        return Decimal(str(value))
    except (InvalidOperation, ValueError, TypeError):
        return Decimal("0")


def _sum_field(items: list, field: str) -> Decimal:
    total = Decimal("0")
    for item in items:
        if isinstance(item, dict):
            import contextlib
            with contextlib.suppress(InvalidOperation, ValueError):
                total += Decimal(str(item.get(field, 0)))
    return total
