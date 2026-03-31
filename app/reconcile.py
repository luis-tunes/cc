from datetime import timedelta
from decimal import Decimal

from app.db import get_conn

__fingerprint__ = "TIM-LT-a1c7e9b3-d524-4f8a-b6d2-3e5f7a9c1b84"

AMOUNT_TOLERANCE = Decimal("0.01")
DATE_TOLERANCE = timedelta(days=7)
SUGGESTION_AMOUNT_TOLERANCE = Decimal("50")
SUGGESTION_DATE_TOLERANCE = timedelta(days=45)
AUTO_APPROVE_THRESHOLD = Decimal("0.95")

# Weights for confidence scoring
W_AMOUNT = Decimal("0.50")
W_DATE = Decimal("0.20")
W_NIF = Decimal("0.20")
W_DESC = Decimal("0.10")


def _nif_match_score(doc_nif: str, tx_nif: str | None, tx_desc: str) -> Decimal:
    """Score NIF match: 1.0 if exact match, 0.5 if NIF found in description, 0.0 otherwise."""
    if not doc_nif:
        return Decimal("0")
    if tx_nif and doc_nif == tx_nif:
        return Decimal("1")
    if doc_nif in tx_desc:
        return Decimal("0.5")
    return Decimal("0")


def _desc_match_score(doc: dict, tx_desc: str) -> Decimal:
    """Score description match: checks if supplier NIF, invoice ref, or keywords appear in tx description."""
    if not tx_desc:
        return Decimal("0")
    tx_lower = tx_desc.lower()
    score = Decimal("0")

    # Check supplier NIF in description
    supplier_nif = doc.get("supplier_nif", "")
    if supplier_nif and supplier_nif in tx_lower:
        score += Decimal("0.4")

    # Check if document type keywords appear
    doc_type = doc.get("type", "")
    type_keywords = {
        "fatura": ["fatura", "ft", "fat"],
        "fatura-fornecedor": ["fatura", "ft", "fat", "fornecedor"],
        "recibo": ["recibo", "rc", "pagamento"],
        "nota-credito": ["credito", "nc", "devolução"],
    }
    for kw in type_keywords.get(doc_type, []):
        if kw in tx_lower:
            score += Decimal("0.3")
            break

    # Check amount in description (formatted as PT locale)
    total = doc.get("total")
    if total:
        total_str = str(total).replace(".", ",")
        if total_str in tx_lower:
            score += Decimal("0.3")

    return min(score, Decimal("1"))


def reconcile_all(tenant_id: str) -> list[dict]:
    with get_conn() as conn:
        # Advisory lock per tenant to serialize concurrent reconciliation calls
        conn.execute("SELECT pg_advisory_xact_lock(hashtext(%s))", (f"reconcile:{tenant_id}",))
        docs = conn.execute(
            """SELECT id, total, date, supplier_nif, type FROM documents
               WHERE date IS NOT NULL AND total IS NOT NULL
                 AND id NOT IN (SELECT document_id FROM reconciliations)
                 AND tenant_id = %s""",
            (tenant_id,),
        ).fetchall()
        txs = conn.execute(
            """SELECT id, amount, date, description, entity_nif FROM bank_transactions
               WHERE id NOT IN (SELECT bank_transaction_id FROM reconciliations)
                 AND tenant_id = %s""",
            (tenant_id,),
        ).fetchall()
        matches = []
        # Build hash-map of txs keyed by amount in cents for O(1) lookup
        tx_by_cents: dict[int, list[dict]] = {}
        for tx in txs:
            key = int(round(abs(tx["amount"]) * 100))
            tx_by_cents.setdefault(key, []).append(tx)

        for doc in docs:
            doc_cents = int(round(doc["total"] * 100))
            # Check exact bucket and ±1 cent (covers 0.01 tolerance)
            best = None
            best_confidence = Decimal("0")
            for key in (doc_cents - 1, doc_cents, doc_cents + 1):
                for tx in tx_by_cents.get(key, []):
                    amount_diff = abs(doc["total"] - abs(tx["amount"]))
                    if amount_diff >= AMOUNT_TOLERANCE:
                        continue
                    date_diff = abs(doc["date"] - tx["date"])
                    if date_diff > DATE_TOLERANCE:
                        continue
                    # Multi-factor confidence scoring
                    amount_score = Decimal("1") - (amount_diff / max(doc["total"], Decimal("0.01")))
                    date_score = Decimal(str(max(0, 1 - date_diff.days / DATE_TOLERANCE.days)))
                    nif_score = _nif_match_score(
                        doc.get("supplier_nif", ""),
                        tx.get("entity_nif"),
                        tx.get("description", ""),
                    )
                    desc_score = _desc_match_score(doc, tx.get("description", ""))

                    confidence = (
                        amount_score * W_AMOUNT
                        + date_score * W_DATE
                        + nif_score * W_NIF
                        + desc_score * W_DESC
                    ).quantize(Decimal("0.01"))
                    confidence = max(Decimal("0"), min(Decimal("1"), confidence))

                    if best is None or confidence > best_confidence:
                        best = tx
                        best_confidence = confidence
            if best is not None:
                status = "aprovado" if best_confidence >= AUTO_APPROVE_THRESHOLD else "pendente"
                conn.execute(
                    """INSERT INTO reconciliations (document_id, bank_transaction_id, match_confidence, status, tenant_id)
                       VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING""",
                    (doc["id"], best["id"], best_confidence, status, tenant_id),
                )
                # Reinforce SNC classification on bank transaction from document
                doc_snc = doc.get("snc_account")
                if doc_snc:
                    conn.execute(
                        """UPDATE bank_transactions SET snc_account = %s, classification_source = 'reconcile'
                           WHERE id = %s AND (snc_account IS NULL OR classification_source != 'manual')""",
                        (doc_snc, best["id"]),
                    )
                # Remove matched tx from its bucket
                bucket = tx_by_cents[int(round(abs(best["amount"]) * 100))]
                bucket.remove(best)
                matches.append({
                    "document_id": doc["id"],
                    "bank_transaction_id": best["id"],
                    "confidence": float(best_confidence),
                    "auto_approved": status == "aprovado",
                })
        conn.commit()
    return matches


def suggest_matches(doc_id: int, tenant_id: str, limit: int = 3) -> list[dict]:
    """Return top-N closest unreconciled bank transactions for a document."""
    with get_conn() as conn:
        doc = conn.execute(
            "SELECT id, total, date, supplier_nif, type FROM documents WHERE id = %s AND tenant_id = %s",
            (doc_id, tenant_id),
        ).fetchone()
        if not doc or doc["total"] is None or doc["date"] is None:
            return []
        txs = conn.execute(
            """SELECT id, amount, date, description, entity_nif FROM bank_transactions
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
        # Multi-factor scoring
        amount_score = float(1 - amount_diff / max(doc["total"], Decimal("1")))
        date_score = 1 - date_diff.days / SUGGESTION_DATE_TOLERANCE.days
        nif_score = float(_nif_match_score(
            doc.get("supplier_nif", ""),
            tx.get("entity_nif"),
            tx.get("description", ""),
        ))
        desc_score = float(_desc_match_score(doc, tx.get("description", "")))

        score = (
            amount_score * float(W_AMOUNT)
            + date_score * float(W_DATE)
            + nif_score * float(W_NIF)
            + desc_score * float(W_DESC)
        )
        confidence = max(0, round(score * 100))
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


def flag_unmatched_movements(tenant_id: str) -> list[dict]:
    """Flag bank transactions without matching documents. Creates alerts."""
    with get_conn() as conn:
        unmatched = conn.execute(
            """SELECT id, date, description, amount FROM bank_transactions
               WHERE id NOT IN (SELECT bank_transaction_id FROM reconciliations)
                 AND tenant_id = %s
               ORDER BY date DESC""",
            (tenant_id,),
        ).fetchall()
        if not unmatched:
            return []

        # Clear previous missing_document alerts (regenerate fresh)
        conn.execute(
            "DELETE FROM alerts WHERE tenant_id = %s AND type = 'missing_document'",
            (tenant_id,),
        )

        flagged = []
        for tx in unmatched:
            conn.execute(
                """INSERT INTO alerts (tenant_id, type, severity, title, description, action_url)
                   VALUES (%s, %s, %s, %s, %s, %s)""",
                (
                    tenant_id,
                    "missing_document",
                    "atencao",
                    f"Sem documento: {tx['description'][:60]}",
                    f"Movimento de {tx['date']} — {tx['amount']} EUR sem documento justificativo.",
                    "/movimentos-bancarios",
                ),
            )
            flagged.append({
                "bank_transaction_id": tx["id"],
                "date": str(tx["date"]),
                "description": tx["description"],
                "amount": float(tx["amount"]),
            })
        conn.commit()
    return flagged


def get_reconciliation_summary(tenant_id: str, year: int, month: int) -> dict:
    """Monthly reconciliation summary for the accountant."""
    import datetime as _dt

    first_day = _dt.date(year, month, 1)
    if month == 12:
        last_day = _dt.date(year + 1, 1, 1) - _dt.timedelta(days=1)
    else:
        last_day = _dt.date(year, month + 1, 1) - _dt.timedelta(days=1)

    with get_conn() as conn:
        # Total movements in the month
        total_row = conn.execute(
            """SELECT COUNT(*) as cnt, COALESCE(SUM(ABS(amount)), 0) as total_amount
               FROM bank_transactions
               WHERE tenant_id = %s AND date >= %s AND date <= %s""",
            (tenant_id, first_day, last_day),
        ).fetchone()

        # Reconciled (any status)
        reconciled_row = conn.execute(
            """SELECT COUNT(DISTINCT r.bank_transaction_id) as cnt
               FROM reconciliations r
               JOIN bank_transactions bt ON bt.id = r.bank_transaction_id
               WHERE r.tenant_id = %s AND bt.date >= %s AND bt.date <= %s""",
            (tenant_id, first_day, last_day),
        ).fetchone()

        # Approved
        approved_row = conn.execute(
            """SELECT COUNT(DISTINCT r.bank_transaction_id) as cnt
               FROM reconciliations r
               JOIN bank_transactions bt ON bt.id = r.bank_transaction_id
               WHERE r.tenant_id = %s AND bt.date >= %s AND bt.date <= %s
                 AND r.status = 'aprovado'""",
            (tenant_id, first_day, last_day),
        ).fetchone()

        # Pending review
        pending_row = conn.execute(
            """SELECT COUNT(DISTINCT r.bank_transaction_id) as cnt
               FROM reconciliations r
               JOIN bank_transactions bt ON bt.id = r.bank_transaction_id
               WHERE r.tenant_id = %s AND bt.date >= %s AND bt.date <= %s
                 AND r.status = 'pendente'""",
            (tenant_id, first_day, last_day),
        ).fetchone()

    total = total_row["cnt"] if total_row else 0
    reconciled = reconciled_row["cnt"] if reconciled_row else 0
    approved = approved_row["cnt"] if approved_row else 0
    pending = pending_row["cnt"] if pending_row else 0
    missing_docs = total - reconciled

    return {
        "year": year,
        "month": month,
        "total_movements": total,
        "total_amount": float(total_row["total_amount"]) if total_row else 0,
        "reconciled": reconciled,
        "approved": approved,
        "pending_review": pending,
        "missing_documents": missing_docs,
        "completion_pct": round(reconciled / total * 100, 1) if total > 0 else 0,
    }
