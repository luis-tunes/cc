"""Auto-classification engine.

Matches documents against tenant classification rules (first match wins).
"""

import logging
import re
from decimal import Decimal, InvalidOperation

from app.db import get_conn

log = logging.getLogger(__name__)


def fetch_rules(tenant_id: str) -> list[dict]:
    """Fetch active classification rules for a tenant (sorted by priority)."""
    with get_conn() as conn:
        return [dict(r) for r in conn.execute(
            """SELECT id, field, operator, value, account, label
               FROM classification_rules
               WHERE tenant_id = %s AND active = true
               ORDER BY priority ASC, id ASC""",
            (tenant_id,),
        ).fetchall()]


def classify_document(doc: dict, tenant_id: str, *, _rules: list[dict] | None = None) -> dict | None:
    """Run classification rules against a document.

    Returns {"account": str, "label": str, "source": "rule"} or None.
    Pass _rules to avoid repeated DB queries in batch scenarios.
    """
    rules = _rules if _rules is not None else fetch_rules(tenant_id)

    for rule in rules:
        if _matches(rule, doc):
            return {
                "account": rule["account"],
                "label": rule["label"],
                "source": "rule",
            }
    return None


def _matches(rule: dict, doc: dict) -> bool:
    """Check if a single rule matches a document."""
    field = rule["field"]
    op = rule["operator"]
    expected = rule["value"]

    # Get actual value from document
    actual = _get_field(doc, field)
    if actual is None:
        return False

    actual_str = str(actual).strip().lower()
    expected_lower = expected.strip().lower()

    if op == "equals":
        return bool(actual_str == expected_lower)
    if op == "not_equals":
        return bool(actual_str != expected_lower)
    if op == "contains":
        return expected_lower in actual_str
    if op == "not_contains":
        return expected_lower not in actual_str
    if op == "starts_with":
        return actual_str.startswith(expected_lower)
    if op == "regex":
        try:
            return bool(re.search(expected, str(actual).strip(), re.IGNORECASE))
        except re.error:
            return False
    if op in ("gte", "lte"):
        try:
            actual_num = Decimal(str(actual))
            expected_num = Decimal(expected)
        except (InvalidOperation, ValueError):
            return False
        return actual_num >= expected_num if op == "gte" else actual_num <= expected_num
    return False


def _get_field(doc: dict, field: str):
    """Extract a field value from a document dict."""
    mapping = {
        "supplier_nif": "supplier_nif",
        "description": "raw_text",
        "amount_gte": "total",
        "amount_lte": "total",
        "type": "type",
    }
    return doc.get(mapping.get(field, field))
