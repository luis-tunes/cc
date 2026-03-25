from datetime import timedelta
from decimal import Decimal
from app.db import get_conn

AMOUNT_TOLERANCE = Decimal("0.01")
DATE_TOLERANCE = timedelta(days=5)
SUGGESTION_AMOUNT_TOLERANCE = Decimal("50")
SUGGESTION_DATE_TOLERANCE = timedelta(days=30)


def reconcile_all(tenant_id: str) -> list[dict]:
    with get_conn() as conn:
        # Advisory lock per tenant to serialize concurrent reconciliation calls
        conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (f"reconcile:{tenant_id}",))
        docs = conn.execute(
            """SELECT id, total, date FROM documents
               WHERE date IS NOT NULL AND total IS NOT NULL
                 AND id NOT IN (SELECT document_id FROM reconciliations)
                 AND tenant_id = %s""",
            (tenant_id,),
        ).fetchall()
        txs = conn.execute(
            """SELECT id, amount, date FROM bank_transactions
               WHERE id NOT IN (SELECT bank_transaction_id FROM reconciliations)
                 AND tenant_id = %s""",
            (tenant_id,),
        ).fetchall()
        matches = []
        used_tx = set()
        for doc in docs:
            for tx in txs:
                if tx["id"] in used_tx:
                    continue
                amount_diff = abs(doc["total"] - abs(tx["amount"]))
                date_diff = abs(doc["date"] - tx["date"])
                if amount_diff < AMOUNT_TOLERANCE and date_diff <= DATE_TOLERANCE:
                    confidence = Decimal("1") - amount_diff
                    conn.execute(
                        """INSERT INTO reconciliations (document_id, bank_transaction_id, match_confidence, tenant_id)
                           VALUES (%s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                        (doc["id"], tx["id"], confidence, tenant_id),
                    )
                    used_tx.add(tx["id"])
                    matches.append({"document_id": doc["id"], "bank_transaction_id": tx["id"], "confidence": float(confidence)})
                    break
        conn.commit()
    return matches


def suggest_matches(doc_id: int, tenant_id: str, limit: int = 3) -> list[dict]:
    """Return top-N closest unreconciled bank transactions for a document."""
    with get_conn() as conn:
        doc = conn.execute(
            "SELECT id, total, date FROM documents WHERE id = %s AND tenant_id = %s",
            (doc_id, tenant_id),
        ).fetchone()
        if not doc or doc["total"] is None or doc["date"] is None:
            return []
        txs = conn.execute(
            """SELECT id, amount, date, description FROM bank_transactions
               WHERE id NOT IN (SELECT bank_transaction_id FROM reconciliations)
                 AND tenant_id = %s""",
            (tenant_id,),
        ).fetchall()

    candidates = []
    for tx in txs:
        amount_diff = abs(doc["total"] - abs(tx["amount"]))
        date_diff = abs(doc["date"] - tx["date"])
        if amount_diff > SUGGESTION_AMOUNT_TOLERANCE or date_diff > SUGGESTION_DATE_TOLERANCE:
            continue
        # Score: lower is better. Normalize amount to 0-1 range, date to 0-1 range
        amount_score = float(amount_diff / max(doc["total"], Decimal("1")))
        date_score = date_diff.days / SUGGESTION_DATE_TOLERANCE.days
        score = amount_score * 0.7 + date_score * 0.3
        confidence = max(0, round((1 - score) * 100))
        candidates.append({
            "bank_transaction_id": tx["id"],
            "description": tx["description"],
            "amount": float(tx["amount"]),
            "date": str(tx["date"]),
            "confidence": confidence,
            "amount_diff": float(amount_diff),
            "date_diff": date_diff.days,
        })
    candidates.sort(key=lambda c: -c["confidence"])
    return candidates[:limit]
