"""Movement classification engine.

Classifies bank movements using tenant rules (pattern matching on description).
Also detects entities (matching suppliers by name/NIF) and flags duplicates.
"""

import re
import logging
from datetime import timedelta
from decimal import Decimal

from app.db import get_conn

log = logging.getLogger(__name__)

DUPLICATE_AMOUNT_TOLERANCE = Decimal("0.01")
DUPLICATE_DATE_TOLERANCE = timedelta(days=3)


def classify_movement(description: str, tenant_id: str | None) -> dict | None:
    """Match a movement description against tenant movement_rules.

    Returns {"category": str, "snc_account": str, "entity_nif": str|None, "source": "rule"} or None.
    """
    if not tenant_id:
        return None
    with get_conn() as conn:
        rules = conn.execute(
            """SELECT id, pattern, category, snc_account, entity_nif
               FROM movement_rules
               WHERE tenant_id = %s AND active = true
               ORDER BY priority ASC, id ASC""",
            (tenant_id,),
        ).fetchall()
    desc_lower = description.lower()
    for rule in rules:
        pattern = rule["pattern"].lower()
        if pattern in desc_lower:
            return {
                "category": rule["category"],
                "snc_account": rule["snc_account"],
                "entity_nif": rule["entity_nif"],
                "source": "rule",
            }
    return None


def detect_entity(description: str, tenant_id: str | None) -> dict | None:
    """Match a movement description against known suppliers by name.

    Returns {"nif": str, "name": str, "type": "fornecedor"} or None.
    """
    if not tenant_id:
        return None
    with get_conn() as conn:
        suppliers = conn.execute(
            "SELECT id, name, nif FROM suppliers WHERE tenant_id = %s",
            (tenant_id,),
        ).fetchall()
    desc_lower = description.lower()
    for sup in suppliers:
        if sup["name"] and sup["name"].lower() in desc_lower:
            return {"nif": sup["nif"], "name": sup["name"], "type": "fornecedor"}
    return None


def find_duplicates(tenant_id: str | None) -> list[dict]:
    """Find bank transactions with same amount within ±3 days of each other."""
    if not tenant_id:
        return []
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT a.id as id_a, b.id as id_b,
                      a.amount, a.date as date_a, b.date as date_b,
                      a.description as desc_a, b.description as desc_b
               FROM bank_transactions a
               JOIN bank_transactions b ON a.id < b.id
                 AND a.tenant_id = b.tenant_id
                 AND ABS(a.amount - b.amount) < %s
                 AND ABS(a.date - b.date) <= %s
               WHERE a.tenant_id = %s
               ORDER BY a.date DESC
               LIMIT 100""",
            (float(DUPLICATE_AMOUNT_TOLERANCE), DUPLICATE_DATE_TOLERANCE.days, tenant_id),
        ).fetchall()
    return [dict(r) for r in rows]


def classify_all_movements(tenant_id: str | None) -> dict:
    """Classify all unclassified movements for a tenant. Returns summary."""
    if not tenant_id:
        return {"classified": 0, "entities": 0}
    with get_conn() as conn:
        txs = conn.execute(
            "SELECT id, description FROM bank_transactions WHERE tenant_id = %s",
            (tenant_id,),
        ).fetchall()

    classified = 0
    entities = 0
    for tx in txs:
        result = classify_movement(tx["description"], tenant_id)
        if result:
            classified += 1
        entity = detect_entity(tx["description"], tenant_id)
        if entity:
            entities += 1
    return {"classified": classified, "entities": entities, "total": len(txs)}
