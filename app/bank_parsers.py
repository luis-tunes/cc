"""Portuguese bank CSV parsers with auto-detection."""

import csv
import io
from datetime import date, datetime
from decimal import Decimal, InvalidOperation


def detect_bank(content: str) -> str | None:
    """Auto-detect which bank produced the CSV. Returns bank key or None."""
    lines = content.strip().splitlines()
    if not lines:
        return None
    header = lines[0].lower()
    if "caixadirecta" in header or "montante eur" in header:
        return "cgd"
    if "millennium" in header or "ref. documento" in header:
        return "millennium"
    if "bpi" in header:
        return "bpi"
    if "novo banco" in header or "nbnet" in header:
        return "novo_banco"
    if "santander" in header:
        return "santander"
    return None


def parse_bank_csv(content: str, bank: str | None = None) -> list[dict]:
    """Parse CSV with optional bank hint. Auto-detects if bank is None."""
    if bank is None:
        bank = detect_bank(content)
    parsers = {
        "cgd": _parse_cgd,
        "millennium": _parse_millennium,
        "bpi": _parse_bpi,
        "novo_banco": _parse_novo_banco,
        "santander": _parse_santander,
    }
    if bank and bank in parsers:
        return parsers[bank](content)
    return _parse_generic(content)


def _parse_amount(value: str) -> Decimal:
    """Parse amount handling PT locale (1.234,56) and negative values."""
    v = value.strip().replace(" ", "")
    if not v or v == "-":
        return Decimal("0")
    v = v.replace(".", "").replace(",", ".")
    try:
        return Decimal(v)
    except InvalidOperation:
        return Decimal("0")


def _parse_date(value: str) -> date | None:
    """Parse date trying multiple formats."""
    v = value.strip()
    if not v:
        return None
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%d.%m.%Y"):
        try:
            return datetime.strptime(v, fmt).date()
        except ValueError:
            continue
    return None


def _rows(content: str, delimiter: str = ";") -> list[list[str]]:
    reader = csv.reader(io.StringIO(content), delimiter=delimiter)
    return [row for row in reader if any(cell.strip() for cell in row)]


def _parse_cgd(content: str) -> list[dict]:
    rows = _rows(content, ";")
    results: list[dict] = []
    for row in rows[1:]:
        if len(row) < 4:
            continue
        dt = _parse_date(row[0])
        if not dt:
            continue
        desc = row[1].strip()
        amount = _parse_amount(row[2]) if row[2].strip() else -_parse_amount(row[3])
        results.append({"date": dt, "description": desc, "amount": amount})
    return results


def _parse_millennium(content: str) -> list[dict]:
    rows = _rows(content, ";")
    results: list[dict] = []
    for row in rows[1:]:
        if len(row) < 4:
            continue
        dt = _parse_date(row[0])
        if not dt:
            continue
        desc = row[1].strip()
        debit = _parse_amount(row[2]) if len(row) > 2 else Decimal("0")
        credit = _parse_amount(row[3]) if len(row) > 3 else Decimal("0")
        amount = credit - debit if credit else -debit
        results.append({"date": dt, "description": desc, "amount": amount})
    return results


def _parse_bpi(content: str) -> list[dict]:
    rows = _rows(content, ";")
    results: list[dict] = []
    for row in rows[1:]:
        if len(row) < 3:
            continue
        dt = _parse_date(row[0])
        if not dt:
            continue
        desc = row[1].strip()
        amount = _parse_amount(row[2])
        results.append({"date": dt, "description": desc, "amount": amount})
    return results


def _parse_novo_banco(content: str) -> list[dict]:
    rows = _rows(content, ";")
    results: list[dict] = []
    for row in rows[1:]:
        if len(row) < 4:
            continue
        dt = _parse_date(row[0])
        if not dt:
            continue
        desc = row[2].strip() if len(row) > 2 else row[1].strip()
        amount = _parse_amount(row[3]) if len(row) > 3 else _parse_amount(row[2])
        results.append({"date": dt, "description": desc, "amount": amount})
    return results


def _parse_santander(content: str) -> list[dict]:
    rows = _rows(content, ";")
    results: list[dict] = []
    for row in rows[1:]:
        if len(row) < 4:
            continue
        dt = _parse_date(row[0])
        if not dt:
            continue
        desc = row[1].strip()
        amount = _parse_amount(row[3])
        results.append({"date": dt, "description": desc, "amount": amount})
    return results


def _parse_generic(content: str) -> list[dict]:
    for delim in (";", ",", "\t"):
        rows = _rows(content, delim)
        if rows and len(rows[0]) >= 3:
            break
    else:
        return []

    results: list[dict] = []
    for row in rows[1:]:
        if len(row) < 3:
            continue
        dt = _parse_date(row[0])
        if not dt:
            continue
        desc = row[1].strip()
        amount = _parse_amount(row[2])
        results.append({"date": dt, "description": desc, "amount": amount})
    return results
