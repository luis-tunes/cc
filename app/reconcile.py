from datetime import timedelta
from decimal import Decimal
from app.db import get_conn

AMOUNT_TOLERANCE = Decimal("0.01")
DATE_TOLERANCE = timedelta(days=5)

def reconcile_all(tenant_id: str | None = None) -> list[dict]:
    tf = " AND tenant_id = %s" if tenant_id else ""
    tp = [tenant_id] if tenant_id else []
    with get_conn() as conn:
        docs = conn.execute(
            f"""SELECT id, total, date FROM documents
               WHERE id NOT IN (SELECT document_id FROM reconciliations){tf}""",
            tp,
        ).fetchall()
        txs = conn.execute(
            f"""SELECT id, amount, date FROM bank_transactions
               WHERE id NOT IN (SELECT bank_transaction_id FROM reconciliations){tf}""",
            tp,
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
