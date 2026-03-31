"""Deterministic pre-LLM extraction of structured patterns from OCR text.

Extracts NIFs, IBANs, dates, amounts, ATCUD codes, and document type hints
using regex patterns — no LLM calls. Results serve as hints for the prompt
assembler and as fallback values when LLM extraction is incomplete.
"""

from __future__ import annotations

import contextlib
import re
from datetime import date
from decimal import Decimal, InvalidOperation

from app.parsers.atcud import extract_atcud
from app.parsers.iban import extract_ibans
from app.schemas.extraction import DeterministicHints

# -- NIF patterns --

_VALID_NIF_PREFIXES = frozenset({"1", "2", "3", "5", "6", "7", "8", "9"})

_SUPPLIER_NIF_RE = re.compile(
    r"(?:NIF|NIPC|N\.?I\.?[FP]\.?[C]?|Contribuinte|N\.?[ºo°]\s*(?:de\s*)?Contribuinte|Nº\s*Fiscal)"
    r"\s*[:.\-\s]*(\d{9})",
    re.IGNORECASE,
)
_CLIENT_NIF_RE = re.compile(
    r"(?:NIF|NIPC|Contribuinte|N\.?I\.?[FP]\.?[C]?)\s*(?:do\s*)?(?:Cliente|Adquirente|Comprador|Destinat[aá]rio|Consumidor\s*Final)"
    r"\s*[:.\-\s]*(\d{9})",
    re.IGNORECASE,
)
_ANY_NIF_RE = re.compile(r"\b(\d{9})\b")

_NIF_EXCLUSION_RE = re.compile(
    r"(?:tel(?:efone|\.)?|fax|telem[oó]vel|mobile|phone|gsm|contacto)"
    r"\s*[:.\-\s]*\d{9}",
    re.IGNORECASE,
)
_IBAN_ZONE_RE = re.compile(
    r"[A-Z]{2}\d{2}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{4}", re.IGNORECASE,
)

# -- Amount patterns --

_AMOUNT_PATTERNS = [
    re.compile(
        r"(?:total\s*(?:a\s*pagar|c/?(?:\s*iva|/\s*iva)|geral|global|final|il[ií]quido|l[ií]quido)?|"
        r"montante\s*(?:total|a\s*pagar|final)?|"
        r"valor\s*(?:total|a\s*pagar|final)?|"
        r"amount\s*(?:due|total)?|"
        r"total\s*fatura|total\s*documento|total\s*recibo|"
        r"quantia)"
        r"\s*[:=]?\s*(?:EUR|€)?\s*"
        r"([\d]{1,3}(?:[. ]\d{3})*[,]\d{2}|"
        r"[\d]+[,]\d{2}|"
        r"[\d]{1,3}(?:[,]\d{3})*[.]\d{2}|"
        r"[\d]+[.]\d{2})"
        r"\s*(?:EUR|€)?",
        re.IGNORECASE,
    ),
]

_MONEY_RE = re.compile(
    r"([\d]{1,3}(?:[. ]\d{3})*[,]\d{2}|[\d]+[,]\d{2})\s*€|"
    r"€\s*([\d]{1,3}(?:[. ]\d{3})*[,]\d{2}|[\d]+[,]\d{2})",
)

_ANY_PT_DECIMAL = re.compile(r"(\d{1,3}(?:\.\d{3})*,\d{2})")

# -- VAT patterns --

_VAT_PATTERNS = [
    re.compile(
        r"(?:iva|i\.v\.a\.|vat|taxa\s*(?:de\s*)?iva|imposto)"
        r"[\s()\d%:\-–]{0,20}?"
        r"([\d]{1,3}(?:[. ]\d{3})*[,]\d{2}|[\d]+[,]\d{2}|"
        r"[\d]{1,3}(?:[,]\d{3})*[.]\d{2}|[\d]+[.]\d{2})"
        r"\s*(?:EUR|€)?",
        re.IGNORECASE,
    ),
]

# -- Date patterns --

_DATE_KEYWORD_NUMERIC_RE = re.compile(
    r"(?:Data|Date|Emitida?\s*(?:em|a)|Data\s*(?:de\s*)?[Ee]miss[ãa]o|Data\s*documento)"
    r"\s*[:.\s]*(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})",
    re.IGNORECASE,
)
_DATE_KEYWORD_TEXTUAL_RE = re.compile(
    r"(?:Data|Date|Emitida?\s*(?:em|a)|Data\s*(?:de\s*)?[Ee]miss[ãa]o)"
    r"\s*[:.\s]*(\d{1,2})\s+(?:de\s+)?(\w{3,9})\s+(?:de\s+)?(\d{4})",
    re.IGNORECASE,
)
_DATE_NUMERIC_RE = re.compile(r"(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})")
_DATE_ISO_RE = re.compile(r"(\d{4})[/\-.](\d{1,2})[/\-.](\d{1,2})")
_DATE_TEXTUAL_RE = re.compile(
    r"(\d{1,2})\s+(?:de\s+)?(\w{3,9})\s+(?:de\s+)?(\d{4})", re.IGNORECASE,
)

_PT_MONTHS: dict[str, int] = {
    "jan": 1, "fev": 2, "mar": 3, "abr": 4, "mai": 5, "jun": 6,
    "jul": 7, "ago": 8, "set": 9, "out": 10, "nov": 11, "dez": 12,
    "janeiro": 1, "fevereiro": 2, "março": 3, "marco": 3, "abril": 4,
    "maio": 5, "junho": 6, "julho": 7, "agosto": 8, "setembro": 9,
    "outubro": 10, "novembro": 11, "dezembro": 12,
    "january": 1, "february": 2, "march": 3, "april": 4, "may": 5,
    "june": 6, "july": 7, "august": 8, "september": 9, "october": 10,
    "november": 11, "december": 12,
}


# -- Public API --

def validate_nif(nif: str) -> bool:
    """Validate Portuguese NIF using mod-11 algorithm."""
    if not re.match(r"^\d{9}$", nif):
        return False
    weights = [9, 8, 7, 6, 5, 4, 3, 2]
    total = sum(int(nif[i]) * weights[i] for i in range(8))
    check = 11 - (total % 11)
    if check >= 10:
        check = 0
    return check == int(nif[8])


def is_valid_nif_prefix(nif: str) -> bool:
    return len(nif) == 9 and nif[0] in _VALID_NIF_PREFIXES


def normalize_pt_amount(raw: str) -> Decimal:
    """Convert PT formatted amount (1.234,56) to Decimal."""
    cleaned = raw.replace(" ", "").replace(".", "").replace(",", ".")
    return Decimal(cleaned)


def normalize_amount(raw: str) -> Decimal:
    """Normalize amount string, auto-detecting PT or international format."""
    raw = raw.strip().replace(" ", "")
    if "," in raw and ("." not in raw or raw.rindex(",") > raw.rindex(".")):
        return Decimal(raw.replace(".", "").replace(",", "."))
    return Decimal(raw.replace(",", ""))


def extract_nifs(text: str) -> list[str]:
    """Extract all valid 9-digit NIFs from text, excluding phones and IBANs."""
    phone_positions: set[int] = set()
    for m in _NIF_EXCLUSION_RE.finditer(text):
        for i in range(m.start(), m.end()):
            phone_positions.add(i)
    for m in _IBAN_ZONE_RE.finditer(text):
        for i in range(m.start(), m.end()):
            phone_positions.add(i)

    result: list[str] = []
    seen: set[str] = set()
    for m in _ANY_NIF_RE.finditer(text):
        nif = m.group(1)
        if nif in seen:
            continue
        if not validate_nif(nif) or not is_valid_nif_prefix(nif):
            continue
        seen.add(nif)
        result.append(nif)
    return result


def extract_labeled_nifs(text: str) -> tuple[str | None, str | None]:
    """Extract supplier and client NIFs from labeled patterns."""
    supplier = None
    client = None
    m = _SUPPLIER_NIF_RE.search(text)
    if m and validate_nif(m.group(1)) and is_valid_nif_prefix(m.group(1)):
        supplier = m.group(1)
    m = _CLIENT_NIF_RE.search(text)
    if m and validate_nif(m.group(1)) and is_valid_nif_prefix(m.group(1)):
        client = m.group(1)
    return supplier, client


def extract_amounts(text: str) -> list[Decimal]:
    """Extract monetary amounts from text, ordered by magnitude (largest first)."""
    amounts: list[Decimal] = []
    for pattern in _AMOUNT_PATTERNS:
        for m in pattern.finditer(text):
            raw = m.group(1)
            try:
                amounts.append(normalize_amount(raw))
            except (InvalidOperation, ValueError):
                continue

    for groups in _MONEY_RE.findall(text):
        raw = groups[0] or groups[1]
        try:
            amounts.append(normalize_pt_amount(raw))
        except (InvalidOperation, ValueError):
            continue

    seen: set[str] = set()
    unique: list[Decimal] = []
    for a in amounts:
        key = str(a)
        if key not in seen:
            seen.add(key)
            unique.append(a)

    return sorted(unique, reverse=True)


def extract_vat_amount(text: str) -> Decimal:
    """Extract VAT/IVA amount from text."""
    for pattern in _VAT_PATTERNS:
        matches = pattern.findall(text)
        if matches:
            raw = matches[-1] if isinstance(matches[-1], str) else matches[-1]
            try:
                return normalize_amount(raw)
            except (InvalidOperation, ValueError):
                continue
    return Decimal("0")


def extract_dates(text: str) -> list[date]:
    """Extract dates from text, prioritizing labeled date patterns."""
    dates: list[date] = []

    m = _DATE_KEYWORD_NUMERIC_RE.search(text)
    if m:
        try:
            day, month, year = int(m.group(1)), int(m.group(2)), int(m.group(3))
            if year < 100:
                year += 2000
            dates.append(date(year, month, day))
        except ValueError:
            pass

    m = _DATE_KEYWORD_TEXTUAL_RE.search(text)
    if m:
        day = int(m.group(1))
        month_str = m.group(2).lower()
        year = int(m.group(3))
        month_num = _PT_MONTHS.get(month_str) or _PT_MONTHS.get(month_str[:3])
        if month_num:
            with contextlib.suppress(ValueError):
                dates.append(date(year, month_num, day))

    m = _DATE_ISO_RE.search(text)
    if m:
        with contextlib.suppress(ValueError):
            dates.append(date(int(m.group(1)), int(m.group(2)), int(m.group(3))))

    m = _DATE_NUMERIC_RE.search(text)
    if m:
        with contextlib.suppress(ValueError):
            dates.append(date(int(m.group(3)), int(m.group(2)), int(m.group(1))))

    m = _DATE_TEXTUAL_RE.search(text)
    if m:
        day = int(m.group(1))
        month_str = m.group(2).lower()
        year = int(m.group(3))
        month_num = _PT_MONTHS.get(month_str) or _PT_MONTHS.get(month_str[:3])
        if month_num:
            with contextlib.suppress(ValueError):
                dates.append(date(year, month_num, day))

    # Deduplicate preserving order
    seen: set[str] = set()
    unique: list[date] = []
    for d in dates:
        key = d.isoformat()
        if key not in seen:
            seen.add(key)
            unique.append(d)
    return unique


def run_deterministic_extraction(text: str) -> DeterministicHints:
    """Run all deterministic parsers on OCR text and return consolidated hints."""
    from app.taxonomy import classify_by_keywords

    nifs = extract_nifs(text)
    ibans = extract_ibans(text)
    dates = extract_dates(text)
    amounts = extract_amounts(text)
    atcud = extract_atcud(text)
    type_candidates = classify_by_keywords(text)

    return DeterministicHints(
        nifs=nifs,
        ibans=ibans,
        dates=[d.isoformat() for d in dates],
        amounts=amounts,
        atcud=atcud,
        type_candidates=type_candidates,
    )
