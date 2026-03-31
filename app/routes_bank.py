import csv
import datetime
import io
import logging
from decimal import Decimal

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, UploadFile
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.auth import AuthInfo, require_auth
from app.cache import cache_invalidate
from app.db import get_conn, log_activity
from app.limiter import EXPENSIVE_RATE, UPLOAD_RATE, limiter
from app.reconcile import reconcile_all, suggest_matches

logger = logging.getLogger(__name__)

MAX_UPLOAD_BYTES = 50 * 1024 * 1024


def _auto_reconcile(tenant_id: str) -> None:
    try:
        result = reconcile_all(tenant_id)
        if result:
            logger.info("auto-reconcile: tenant=%s matched=%d", tenant_id, len(result))
        cache_invalidate(f"dashboard:{tenant_id}")
    except Exception:
        logger.exception("auto-reconcile failed for tenant=%s", tenant_id)


def _auto_classify(tenant_id: str) -> None:
    try:
        from app.classify_movements import classify_all_movements
        result = classify_all_movements(tenant_id)
        if result["classified"]:
            logger.info("auto-classify: tenant=%s classified=%d/%d", tenant_id, result["classified"], result["total"])
    except Exception:
        logger.exception("auto-classify failed for tenant=%s", tenant_id)


class BankTransactionOut(BaseModel):
    id: int
    date: datetime.date
    description: str
    amount: Decimal
    category: str | None = None
    snc_account: str | None = None
    entity_nif: str | None = None
    classification_source: str | None = None

class ManualClassification(BaseModel):
    category: str | None = None
    snc_account: str | None = None
    entity_nif: str | None = None

class ReconciliationPatch(BaseModel):
    status: str | None = None

class MovementRuleOut(BaseModel):
    id: int
    name: str
    pattern: str
    category: str
    snc_account: str
    entity_nif: str | None = None
    priority: int
    active: bool

class MovementRuleCreate(BaseModel):
    name: str = ""
    pattern: str
    category: str = ""
    snc_account: str = ""
    entity_nif: str | None = None
    priority: int = 0
    active: bool = True

class MovementRulePatch(BaseModel):
    name: str | None = None
    pattern: str | None = None
    category: str | None = None
    snc_account: str | None = None
    entity_nif: str | None = None
    priority: int | None = None
    active: bool | None = None


VALID_RECON_STATUSES = {"pendente", "aprovado", "rejeitado", "a_rever"}

router = APIRouter()


@router.post("/bank-transactions/upload")
@limiter.limit(UPLOAD_RATE)
async def upload_bank_csv(request: Request, file: UploadFile, background_tasks: BackgroundTasks, auth: AuthInfo = Depends(require_auth)):
    MAX_CSV_ROWS = 10_000
    content = await file.read()
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail=f"file too large (max {MAX_UPLOAD_BYTES // (1024*1024)} MB)")
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    if not reader.fieldnames or not {"date", "description", "amount"}.issubset(set(reader.fieldnames)):
        raise HTTPException(status_code=422, detail="CSV must have columns: date, description, amount")
    tid = auth.tenant_id
    count = 0
    skipped = 0
    errors = []
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT date, description, amount FROM bank_transactions WHERE tenant_id = %s",
            (tid,),
        ).fetchall()
        existing_set = {(str(r["date"]), r["description"], r["amount"]) for r in existing}

        for line_num, row in enumerate(reader, start=2):
            if count >= MAX_CSV_ROWS:
                errors.append(f"Limite de {MAX_CSV_ROWS} linhas atingido, restantes ignoradas")
                break
            try:
                tx_date = datetime.date.fromisoformat(row["date"].strip())
            except (ValueError, AttributeError):
                errors.append(f"Linha {line_num}: data inválida '{row.get('date', '')}'")
                continue
            description = row["description"].strip()
            try:
                amount = Decimal(row["amount"].strip().replace(",", "."))
            except Exception:
                errors.append(f"Linha {line_num}: valor inválido '{row.get('amount', '')}'")
                continue
            key = (str(tx_date), description, amount)
            if key in existing_set:
                skipped += 1
                continue
            existing_set.add(key)
            conn.execute(
                "INSERT INTO bank_transactions (date, description, amount, tenant_id) VALUES (%s, %s, %s, %s)",
                (tx_date, description, amount, tid),
            )
            count += 1
        conn.commit()
    if errors and count == 0 and skipped == 0:
        raise HTTPException(status_code=422, detail="Nenhuma linha importada. Erros: " + "; ".join(errors[:5]))
    cache_invalidate(f"dashboard:{tid}")
    background_tasks.add_task(_auto_classify, tid)
    background_tasks.add_task(_auto_reconcile, tid)
    return {"imported": count, "skipped": skipped, "errors": errors[:10]}


@router.get("/bank-transactions", response_model=list[BankTransactionOut])
async def list_bank_transactions(
    date_from: datetime.date | None = None,
    date_to: datetime.date | None = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    clauses: list[str] = ["tenant_id = %s"]
    params: list = [auth.tenant_id]
    if date_from:
        clauses.append("date >= %s")
        params.append(date_from)
    if date_to:
        clauses.append("date <= %s")
        params.append(date_to)
    where = "WHERE " + " AND ".join(clauses)
    params.extend([limit, offset])
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT id, date, description, amount, category, snc_account, entity_nif, classification_source FROM bank_transactions {where} ORDER BY date DESC LIMIT %s OFFSET %s",
            params,
        ).fetchall()
    return rows


@router.patch("/bank-transactions/{tx_id}")
async def update_bank_transaction(tx_id: int, body: ManualClassification, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM bank_transactions WHERE id = %s AND tenant_id = %s",
            (tx_id, auth.tenant_id),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="Transaction not found")
        conn.execute(
            """UPDATE bank_transactions
               SET category = %s, snc_account = %s, entity_nif = %s, classification_source = 'manual'
               WHERE id = %s""",
            (body.category, body.snc_account, body.entity_nif, tx_id),
        )
        conn.commit()
    cache_invalidate(f"dashboard:{auth.tenant_id}")
    return {"ok": True}


@router.post("/bank-transactions/classify-all")
@limiter.limit(EXPENSIVE_RATE)
async def classify_all(request: Request, auth: AuthInfo = Depends(require_auth)):
    from app.classify_movements import classify_all_movements
    result = classify_all_movements(auth.tenant_id)
    cache_invalidate(f"dashboard:{auth.tenant_id}")
    return result


@router.delete("/bank-transactions/{tx_id}", status_code=204)
async def delete_bank_transaction(tx_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id FROM bank_transactions WHERE id = %s AND tenant_id = %s",
            (tx_id, tid),
        ).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="transaction not found")
        conn.execute("DELETE FROM reconciliations WHERE bank_transaction_id = %s AND tenant_id = %s", (tx_id, tid))
        conn.execute("DELETE FROM bank_transactions WHERE id = %s AND tenant_id = %s", (tx_id, tid))
        log_activity(conn, tid, "bank_transaction", tx_id, "deleted")
        conn.commit()
    return None


@router.get("/bank-transactions/enrich")
async def enrich_movements(
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    from app.classify_movements import _fetch_rules, _fetch_suppliers, classify_movement, detect_entity
    tid = auth.tenant_id
    clauses: list[str] = ["tenant_id = %s"]
    params: list = [tid]
    where = "WHERE " + " AND ".join(clauses)
    params.extend([limit, offset])
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT id, date, description, amount FROM bank_transactions {where} ORDER BY date DESC LIMIT %s OFFSET %s",
            params,
        ).fetchall()
    rules = _fetch_rules(tid)
    suppliers = _fetch_suppliers(tid)
    results = []
    for tx in rows:
        cls = classify_movement(tx["description"], tid, _rules=rules)
        entity = detect_entity(tx["description"], tid, _suppliers=suppliers)
        results.append({
            **dict(tx),
            "category": cls["category"] if cls else None,
            "snc_account": cls["snc_account"] if cls else None,
            "entity_nif": (cls["entity_nif"] if cls and cls.get("entity_nif") else None)
                         or (entity["nif"] if entity else None),
            "entity_name": entity["name"] if entity else None,
            "classified": cls is not None,
        })
    return results


@router.get("/bank-transactions/duplicates")
async def list_duplicates(auth: AuthInfo = Depends(require_auth)):
    from app.classify_movements import find_duplicates
    return find_duplicates(auth.tenant_id)


# --- Reconciliation ---

@router.post("/reconcile")
@limiter.limit(EXPENSIVE_RATE)
async def run_reconciliation(request: Request, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    matches = reconcile_all(tid)
    if matches:
        with get_conn() as conn:
            log_activity(conn, tid, "reconciliation", None, "run", f"{len(matches)} correspondências")
            conn.commit()
    cache_invalidate(f"dashboard:{tid}")
    return {"matched": len(matches), "matches": matches}


@router.get("/reconciliations")
async def list_reconciliations(
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    clauses: list[str] = ["r.tenant_id = %s"]
    params: list = [auth.tenant_id]
    where = "WHERE " + " AND ".join(clauses)
    params.extend([limit, offset])
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT r.id, r.document_id, r.bank_transaction_id, r.match_confidence,
                      r.status as reconciliation_status,
                      d.supplier_nif, d.total, d.vat as doc_vat, d.date as doc_date,
                      d.filename as doc_filename,
                      b.description, b.amount, b.date as tx_date
               FROM reconciliations r
               JOIN documents d ON d.id = r.document_id
               JOIN bank_transactions b ON b.id = r.bank_transaction_id
               {where}
               ORDER BY r.created_at DESC LIMIT %s OFFSET %s""",
            params,
        ).fetchall()
    return rows


@router.patch("/reconciliations/{recon_id}")
async def patch_reconciliation(recon_id: int, patch: ReconciliationPatch, auth: AuthInfo = Depends(require_auth)):
    if patch.status and patch.status not in VALID_RECON_STATUSES:
        raise HTTPException(status_code=422, detail=f"invalid status: {patch.status}")
    tid = auth.tenant_id
    updates = patch.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    set_parts = []
    params: list = []
    for k, v in updates.items():
        set_parts.append(f"{k} = %s")
        params.append(v)
    params.extend([recon_id, tid])
    with get_conn() as conn:
        row = conn.execute(
            f"UPDATE reconciliations SET {', '.join(set_parts)} WHERE id = %s AND tenant_id = %s RETURNING id, status",
            params,
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="reconciliation not found")
    return row


@router.get("/reconciliations/{doc_id}/suggestions")
async def reconciliation_suggestions(doc_id: int, auth: AuthInfo = Depends(require_auth)):
    return suggest_matches(doc_id, auth.tenant_id)


# --- Movement Rules CRUD ---

@router.get("/movement-rules", response_model=list[MovementRuleOut])
async def list_movement_rules(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        return conn.execute(
            "SELECT id, name, pattern, category, snc_account, entity_nif, priority, active FROM movement_rules WHERE tenant_id = %s ORDER BY priority ASC, id ASC",
            (tid,),
        ).fetchall()


@router.post("/movement-rules", response_model=MovementRuleOut, status_code=201)
async def create_movement_rule(body: MovementRuleCreate, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO movement_rules (tenant_id, name, pattern, category, snc_account, entity_nif, priority, active)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, name, pattern, category, snc_account, entity_nif, priority, active""",
            (tid, body.name, body.pattern, body.category, body.snc_account, body.entity_nif, body.priority, body.active),
        ).fetchone()
        log_activity(conn, tid, "movement_rule", row["id"], "created", body.pattern)
        conn.commit()
    return row


@router.patch("/movement-rules/{rule_id}", response_model=MovementRuleOut)
async def update_movement_rule(rule_id: int, patch: MovementRulePatch, auth: AuthInfo = Depends(require_auth)):
    updates = patch.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    tid = auth.tenant_id
    set_parts = []
    params: list = []
    for k, v in updates.items():
        set_parts.append(f"{k} = %s")
        params.append(v)
    params.extend([rule_id, tid])
    with get_conn() as conn:
        row = conn.execute(
            f"UPDATE movement_rules SET {', '.join(set_parts)} WHERE id = %s AND tenant_id = %s RETURNING id, name, pattern, category, snc_account, entity_nif, priority, active",
            params,
        ).fetchone()
        if row:
            log_activity(conn, tid, "movement_rule", rule_id, "updated", str(list(updates.keys())))
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="rule not found")
    return row


@router.delete("/movement-rules/{rule_id}", status_code=204)
async def delete_movement_rule(rule_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM movement_rules WHERE id = %s AND tenant_id = %s RETURNING id",
            (rule_id, tid),
        ).fetchone()
        if row:
            log_activity(conn, tid, "movement_rule", rule_id, "deleted")
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="rule not found")


# --- CSV Exports ---

@router.get("/export/bank-transactions/csv")
@limiter.limit(EXPENSIVE_RATE)
async def export_bank_transactions_csv(request: Request, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, date, description, amount FROM bank_transactions WHERE tenant_id = %s ORDER BY date DESC",
            (tid,),
        ).fetchall()
    output = io.StringIO()
    writer = csv.DictWriter(output, extrasaction="ignore", fieldnames=["id", "date", "description", "amount"])
    writer.writeheader()
    for r in rows:
        writer.writerow(dict(r))
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=movimentos.csv"},
    )


@router.get("/export/reconciliations/csv")
@limiter.limit(EXPENSIVE_RATE)
async def export_reconciliations_csv(request: Request, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT r.id, r.document_id, r.bank_transaction_id, r.match_confidence, r.status,
                      d.supplier_nif, d.total, d.date as doc_date,
                      b.description, b.amount, b.date as tx_date
               FROM reconciliations r
               JOIN documents d ON d.id = r.document_id
               JOIN bank_transactions b ON b.id = r.bank_transaction_id
               WHERE r.tenant_id = %s ORDER BY r.created_at DESC""",
            (tid,),
        ).fetchall()
    output = io.StringIO()
    writer = csv.DictWriter(output, extrasaction="ignore", fieldnames=["id", "document_id", "bank_transaction_id", "match_confidence", "status", "supplier_nif", "total", "doc_date", "description", "amount", "tx_date"])
    writer.writeheader()
    for r in rows:
        writer.writerow(dict(r))
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=reconciliacoes.csv"},
    )
