"""IBAN extraction and validation for Portuguese bank accounts.

Portuguese IBAN format: PT50 BBBB SSSS CCCCCCCCCCC KK
  - PT = country code
  - 50 = check digits (example; varies)
  - BBBB = bank code (4 digits)
  - SSSS = branch code (4 digits)
  - CCCCCCCCCCC = account number (11 digits)
  - KK = national check digits (2 digits)
  Total: 25 characters
"""

from __future__ import annotations

import re

# Match IBAN with optional spaces/separators
_IBAN_RE = re.compile(
    r"\b([A-Z]{2}\d{2})\s*(\d{4})\s*(\d{4})\s*(\d{4})\s*(\d{4})\s*(\d{4})\s*(\d{1,4})?\b",
    re.IGNORECASE,
)

# Compact IBAN (no spaces)
_IBAN_COMPACT_RE = re.compile(r"\b([A-Z]{2}\d{23})\b", re.IGNORECASE)


def extract_ibans(text: str) -> list[str]:
    """Extract all IBANs from text, returning compact format (no spaces)."""
    result: list[str] = []
    seen: set[str] = set()

    # Try spaced format first
    for m in _IBAN_RE.finditer(text):
        groups = [g for g in m.groups() if g]
        iban = "".join(groups).upper().replace(" ", "")
        if len(iban) >= 25 and iban not in seen:
            iban = iban[:25]  # Trim to standard length
            if validate_iban_checksum(iban):
                seen.add(iban)
                result.append(iban)

    # Try compact format
    for m in _IBAN_COMPACT_RE.finditer(text):
        iban = m.group(1).upper()
        if iban not in seen and validate_iban_checksum(iban):
            seen.add(iban)
            result.append(iban)

    return result


def validate_iban_checksum(iban: str) -> bool:
    """Validate IBAN using ISO 13616 mod-97 check."""
    iban = iban.upper().replace(" ", "")
    if len(iban) < 15 or not iban[:2].isalpha() or not iban[2:4].isdigit():
        return False

    # Move first 4 chars to end
    rearranged = iban[4:] + iban[:4]

    # Convert letters to numbers (A=10, B=11, ... Z=35)
    numeric = ""
    for ch in rearranged:
        if ch.isdigit():
            numeric += ch
        elif ch.isalpha():
            numeric += str(ord(ch) - ord("A") + 10)
        else:
            return False

    try:
        return int(numeric) % 97 == 1
    except (ValueError, OverflowError):
        return False


def is_portuguese_iban(iban: str) -> bool:
    """Check if IBAN is Portuguese (starts with PT)."""
    return iban.upper().startswith("PT") and len(iban) == 25
