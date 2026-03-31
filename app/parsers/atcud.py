"""ATCUD extraction and validation for Portuguese fiscal documents.

ATCUD (Código Único de Documento) is mandatory since January 2023.
Format: XXXXXXXX-N where X is alphanumeric (8 chars) and N is a sequence number.
On documents it appears as "ATCUD:XXXXXXXX-NNNNN" or just the code.
"""

from __future__ import annotations

import re

# Matches ATCUD in context: "ATCUD:ABC12345-1" or "ATCUD: ABC12345-1234"
_ATCUD_LABELED_RE = re.compile(
    r"ATCUD\s*[:=\s]\s*([A-Za-z0-9]{8}-\d+)", re.IGNORECASE,
)

# Standalone ATCUD pattern (8 alphanumeric + hyphen + digits)
_ATCUD_STANDALONE_RE = re.compile(r"\b([A-Za-z0-9]{8}-\d{1,10})\b")

# Validation pattern
_ATCUD_VALID_RE = re.compile(r"^[A-Za-z0-9]{8}-\d+$")


def extract_atcud(text: str) -> str | None:
    """Extract ATCUD code from document text.

    Tries labeled pattern first (ATCUD:...), then standalone.
    Returns the ATCUD string or None if not found.
    """
    m = _ATCUD_LABELED_RE.search(text)
    if m:
        return m.group(1)
    # Standalone is less reliable — only return if it looks valid
    m = _ATCUD_STANDALONE_RE.search(text)
    if m and validate_atcud(m.group(1)):
        return m.group(1)
    return None


def validate_atcud(atcud: str) -> bool:
    """Validate ATCUD format: 8 alphanumeric chars + hyphen + sequence number."""
    return bool(_ATCUD_VALID_RE.match(atcud))
