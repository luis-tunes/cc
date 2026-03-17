import csv
import datetime
import io
import json
import logging
import os
from decimal import Decimal
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.auth import AuthInfo, optional_auth, require_auth
from app.db import get_conn, log_activity
from app.parse import ingest_document, validate_nif
from app.reconcile import reconcile_all, suggest_matches
from app.cache import cache_get, cache_set, cache_invalidate
from app.assistant import answer_question as _answer_question

logger = logging.getLogger(__name__)

PAPERLESS_URL = os.environ.get("PAPERLESS_URL", "http://paperless:8000")
PAPERLESS_TOKEN = os.environ.get("PAPERLESS_TOKEN", "")

router = APIRouter()


def _tenant_clause(auth: AuthInfo | None, clauses: list, params: list) -> None:
    """Append tenant_id filter if auth provides one."""
    if auth and auth.tenant_id:
        clauses.append("tenant_id = %s")
        params.append(auth.tenant_id)

# --- Models ---

class DocumentOut(BaseModel):
    id: int
    supplier_nif: str
    client_nif: str
    total: Decimal
    vat: Decimal
    date: datetime.date | None
    type: str
    filename: str | None = None
    raw_text: str | None = None
    status: str = "pendente"
    paperless_id: int | None = None
    created_at: datetime.datetime | None = None
    notes: str | None = None
    snc_account: str | None = None
    classification_source: str | None = None

class DocumentPatch(BaseModel):
    status: Optional[str] = None
    type: Optional[str] = None
    supplier_nif: Optional[str] = None
    client_nif: Optional[str] = None
    total: Optional[Decimal] = None
    vat: Optional[Decimal] = None
    date: Optional[datetime.date] = None
    filename: Optional[str] = None
    notes: Optional[str] = None

class BankTransactionOut(BaseModel):
    id: int
    date: datetime.date
    description: str
    amount: Decimal

class WebhookPayload(BaseModel):
    document_id: int

# --- Webhook ---

@router.post("/webhook")
async def paperless_webhook(payload: WebhookPayload):
    try:
        doc_id = ingest_document(payload.document_id)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e))
    return {"document_id": doc_id}

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif"}
MIME_MAP = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
}

@router.post("/documents/upload")
async def upload_document(file: UploadFile, auth: AuthInfo = Depends(require_auth)):
    if not file.filename:
        raise HTTPException(status_code=422, detail="filename is required")
    ext = os.path.splitext(file.filename.lower())[1]
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=422,
            detail=f"unsupported file type '{ext}'; accepted: PDF, JPG, PNG, TIFF",
        )

    try:
        content = await file.read()
        logger.info("upload: file=%s size=%d ext=%s", file.filename, len(content), ext)
        mime = MIME_MAP.get(ext, "application/octet-stream")

        tid = auth.tenant_id if auth else None

        # Save DB record first so the upload is never lost
        try:
            with get_conn() as conn:
                row = conn.execute(
                    "INSERT INTO documents (supplier_nif, client_nif, total, vat, type, filename, status, tenant_id) VALUES ('','',0,0,'outro',%s,'pendente ocr',%s) RETURNING id",
                    (file.filename, tid),
                ).fetchone()
                log_activity(conn, tid or "", "document", row["id"], "uploaded", file.filename)
                conn.commit()
                local_id = row["id"]
        except Exception:
            logger.exception("upload: DB insert failed for file=%s", file.filename)
            raise HTTPException(status_code=500, detail="database error saving document record")

        # Forward to Paperless for OCR (best-effort)
        paperless_ok = False
        headers = {"Authorization": f"Token {PAPERLESS_TOKEN}"}
        transport = httpx.HTTPTransport(retries=3)
        try:
            with httpx.Client(transport=transport) as client:
                r = client.post(
                    f"{PAPERLESS_URL}/api/documents/post_document/",
                    headers=headers,
                    files={"document": (file.filename, content, mime)},
                    timeout=60,
                )
            if r.status_code in (200, 202):
                paperless_ok = True
            else:
                logger.error("upload: paperless rejected file=%s status=%d body=%s", file.filename, r.status_code, r.text[:500])
        except Exception as exc:
            logger.warning("upload: paperless unreachable for file=%s: %s", file.filename, exc)

        if paperless_ok:
            with get_conn() as conn:
                conn.execute("UPDATE documents SET status = 'a processar' WHERE id = %s", (local_id,))
                conn.commit()

        status_msg = "accepted" if paperless_ok else "accepted_without_ocr"
        logger.info("upload: %s file=%s id=%d paperless=%s", status_msg, file.filename, local_id, paperless_ok)
        return {"status": status_msg, "filename": file.filename, "id": local_id}

    except HTTPException:
        raise
    except Exception:
        logger.exception("upload: unexpected error for file=%s", getattr(file, 'filename', '?'))
        raise HTTPException(status_code=500, detail="internal error during upload")


@router.get("/debug/upload-check")
async def upload_preflight():
    """Test DB and Paperless connectivity. Only works when AUTH_DISABLED=1."""
    if not os.environ.get("AUTH_DISABLED", "0") == "1":
        raise HTTPException(status_code=404)
    results: dict = {}
    # DB check
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1")
        results["db"] = "ok"
    except Exception as e:
        results["db"] = f"error: {e}"
    # Paperless check
    try:
        r = httpx.get(
            f"{PAPERLESS_URL}/api/",
            headers={"Authorization": f"Token {PAPERLESS_TOKEN}"},
            timeout=10,
        )
        results["paperless"] = f"status={r.status_code}"
        if r.status_code == 200:
            results["paperless_auth"] = "ok"
        else:
            results["paperless_auth"] = f"failed ({r.status_code}): {r.text[:200]}"
    except Exception as e:
        results["paperless"] = f"unreachable: {e}"
    results["paperless_url"] = PAPERLESS_URL
    results["paperless_token_set"] = bool(PAPERLESS_TOKEN)
    return results

# --- Documents ---

@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(
    supplier_nif: str | None = None,
    date_from: datetime.date | None = None,
    date_to: datetime.date | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    auth: AuthInfo = Depends(require_auth),
):
    clauses: list[str] = []
    params: list = []
    _tenant_clause(auth, clauses, params)
    if supplier_nif:
        clauses.append("supplier_nif = %s")
        params.append(supplier_nif)
    if date_from:
        clauses.append("date >= %s")
        params.append(date_from)
    if date_to:
        clauses.append("date <= %s")
        params.append(date_to)
    if status:
        clauses.append("status = %s")
        params.append(status)
    if search:
        clauses.append("(supplier_nif ILIKE %s OR client_nif ILIKE %s OR filename ILIKE %s)")
        q = f"%{search}%"
        params.extend([q, q, q])
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    params.extend([limit, offset])
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT id, supplier_nif, client_nif, total, vat, date, type, filename, raw_text, status, paperless_id, created_at, notes, snc_account, classification_source FROM documents {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
            params,
        ).fetchall()
    return rows


@router.post("/documents/auto-classify")
async def auto_classify_documents(auth: AuthInfo = Depends(require_auth)):
    """Run classification rules against all unclassified documents for the tenant."""
    from app.classify import classify_document
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        docs = conn.execute(
            """SELECT id, supplier_nif, client_nif, total, vat, date, type, filename, raw_text, status
               FROM documents
               WHERE tenant_id = %s AND (snc_account IS NULL OR snc_account = '')
               AND status != 'arquivado'""",
            (tid,),
        ).fetchall()

    classified = 0
    skipped = 0
    for doc in docs:
        result = classify_document(dict(doc), tid)
        if result:
            with get_conn() as conn:
                conn.execute(
                    "UPDATE documents SET snc_account = %s, classification_source = %s WHERE id = %s AND tenant_id = %s",
                    (result["account"], result["source"], doc["id"], tid),
                )
                log_activity(conn, tid, "document", doc["id"], "auto_classified",
                             f"Conta {result['account']} via regra")
                conn.commit()
            classified += 1
        else:
            skipped += 1

    with get_conn() as conn:
        total_classified = conn.execute(
            "SELECT COUNT(*) AS n FROM documents WHERE tenant_id = %s AND snc_account IS NOT NULL AND snc_account != ''",
            (tid,),
        ).fetchone()["n"]
        total_unclassified = conn.execute(
            "SELECT COUNT(*) AS n FROM documents WHERE tenant_id = %s AND (snc_account IS NULL OR snc_account = '') AND status != 'arquivado'",
            (tid,),
        ).fetchone()["n"]

    return {
        "classified_now": classified,
        "skipped": skipped,
        "total_processed": len(docs),
        "total_classified": total_classified,
        "total_unclassified": total_unclassified,
    }


@router.get("/documents/classification-stats")
async def classification_stats(auth: AuthInfo = Depends(require_auth)):
    """Return classification coverage statistics for the tenant."""
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*) AS n FROM documents WHERE tenant_id = %s AND status != 'arquivado'",
            (tid,),
        ).fetchone()["n"]
        classified = conn.execute(
            "SELECT COUNT(*) AS n FROM documents WHERE tenant_id = %s AND snc_account IS NOT NULL AND snc_account != '' AND status != 'arquivado'",
            (tid,),
        ).fetchone()["n"]
        by_account = conn.execute(
            """SELECT snc_account AS account, COUNT(*) AS count
               FROM documents
               WHERE tenant_id = %s AND snc_account IS NOT NULL AND snc_account != ''
               GROUP BY snc_account ORDER BY count DESC LIMIT 10""",
            (tid,),
        ).fetchall()
    return {
        "total": total,
        "classified": classified,
        "unclassified": total - classified,
        "coverage_pct": round((classified / total * 100), 1) if total > 0 else 0.0,
        "by_account": [dict(r) for r in by_account],
    }


@router.get("/documents/{doc_id}", response_model=DocumentOut)
async def get_document(doc_id: int, auth: AuthInfo = Depends(require_auth)):
    clauses = ["id = %s"]
    params: list = [doc_id]
    _tenant_clause(auth, clauses, params)
    where = "WHERE " + " AND ".join(clauses)
    with get_conn() as conn:
        row = conn.execute(
            f"SELECT id, supplier_nif, client_nif, total, vat, date, type, filename, raw_text, status, paperless_id, created_at, notes, snc_account, classification_source FROM documents {where}",
            params,
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")
    return row

@router.patch("/documents/{doc_id}", response_model=DocumentOut)
async def update_document(doc_id: int, patch: DocumentPatch, auth: AuthInfo = Depends(require_auth)):
    updates = patch.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    set_parts = []
    params: list = []
    for k, v in updates.items():
        set_parts.append(f"{k} = %s")
        params.append(v)
    wheres = ["id = %s"]
    params.append(doc_id)
    if auth and auth.tenant_id:
        wheres.append("tenant_id = %s")
        params.append(auth.tenant_id)
    where = " AND ".join(wheres)
    with get_conn() as conn:
        row = conn.execute(
            f"UPDATE documents SET {', '.join(set_parts)} WHERE {where} RETURNING id, supplier_nif, client_nif, total, vat, date, type, filename, raw_text, status, paperless_id, created_at, notes, snc_account, classification_source",
            params,
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")
    return row


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: int, auth: AuthInfo = Depends(require_auth)):
    wheres = ["id = %s"]
    params: list = [doc_id]
    if auth and auth.tenant_id:
        wheres.append("tenant_id = %s")
        params.append(auth.tenant_id)
    where = " AND ".join(wheres)
    with get_conn() as conn:
        row = conn.execute(f"SELECT id, paperless_id FROM documents WHERE {where}", params).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="document not found")
        conn.execute("DELETE FROM reconciliations WHERE document_id = %s", (doc_id,))
        conn.execute(f"DELETE FROM documents WHERE {where}", params)
        log_activity(conn, (auth.tenant_id if auth else "") or "", "document", doc_id, "deleted", None)
        conn.commit()
    return None


@router.get("/documents/{doc_id}/preview")
async def document_preview(doc_id: int, auth: AuthInfo = Depends(require_auth)):
    """Proxy the document file from Paperless-ngx for preview."""
    wheres = ["id = %s"]
    params: list = [doc_id]
    if auth and auth.tenant_id:
        wheres.append("tenant_id = %s")
        params.append(auth.tenant_id)
    where = " AND ".join(wheres)
    with get_conn() as conn:
        row = conn.execute(
            f"SELECT paperless_id, filename FROM documents WHERE {where}", params
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")

    paperless_id = row["paperless_id"]
    filename = row["filename"] or "document"
    ext = os.path.splitext(filename.lower())[1]
    content_type = MIME_MAP.get(ext, "application/pdf")

    if not paperless_id or not PAPERLESS_TOKEN:
        raise HTTPException(status_code=404, detail="no preview available")

    headers = {"Authorization": f"Token {PAPERLESS_TOKEN}"}
    try:
        with httpx.Client() as client:
            r = client.get(
                f"{PAPERLESS_URL}/api/documents/{paperless_id}/download/",
                headers=headers,
                timeout=30,
            )
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="failed to fetch from OCR service")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="OCR service unavailable")

    return StreamingResponse(
        io.BytesIO(r.content),
        media_type=content_type,
        headers={"Content-Disposition": f'inline; filename="{filename}"'},
    )


@router.get("/documents/{doc_id}/thumbnail")
async def document_thumbnail(doc_id: int, auth: AuthInfo = Depends(require_auth)):
    """Proxy the document thumbnail from Paperless-ngx."""
    wheres = ["id = %s"]
    params: list = [doc_id]
    if auth and auth.tenant_id:
        wheres.append("tenant_id = %s")
        params.append(auth.tenant_id)
    where = " AND ".join(wheres)
    with get_conn() as conn:
        row = conn.execute(
            f"SELECT paperless_id FROM documents WHERE {where}", params
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")

    paperless_id = row["paperless_id"]
    if not paperless_id or not PAPERLESS_TOKEN:
        raise HTTPException(status_code=404, detail="no thumbnail available")

    headers = {"Authorization": f"Token {PAPERLESS_TOKEN}"}
    try:
        with httpx.Client() as client:
            r = client.get(
                f"{PAPERLESS_URL}/api/documents/{paperless_id}/thumb/",
                headers=headers,
                timeout=15,
            )
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="failed to fetch thumbnail")
    except httpx.HTTPError:
        raise HTTPException(status_code=502, detail="OCR service unavailable")

    return StreamingResponse(
        io.BytesIO(r.content),
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=3600"},
    )

# --- Bank Transactions ---

@router.post("/bank-transactions/upload")
async def upload_bank_csv(file: UploadFile, auth: AuthInfo = Depends(require_auth)):
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    if not reader.fieldnames or not {"date", "description", "amount"}.issubset(set(reader.fieldnames)):
        raise HTTPException(status_code=422, detail="CSV must have columns: date, description, amount")
    tid = auth.tenant_id if auth else None
    count = 0
    errors = []
    with get_conn() as conn:
        for line_num, row in enumerate(reader, start=2):
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
            conn.execute(
                "INSERT INTO bank_transactions (date, description, amount, tenant_id) VALUES (%s, %s, %s, %s)",
                (tx_date, description, amount, tid),
            )
            count += 1
        conn.commit()
    if errors and count == 0:
        raise HTTPException(status_code=422, detail="Nenhuma linha importada. Erros: " + "; ".join(errors[:5]))
    return {"imported": count, "errors": errors[:10]}

@router.get("/bank-transactions", response_model=list[BankTransactionOut])
async def list_bank_transactions(
    date_from: datetime.date | None = None,
    date_to: datetime.date | None = None,
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    auth: AuthInfo = Depends(require_auth),
):
    clauses: list[str] = []
    params: list = []
    _tenant_clause(auth, clauses, params)
    if date_from:
        clauses.append("date >= %s")
        params.append(date_from)
    if date_to:
        clauses.append("date <= %s")
        params.append(date_to)
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    params.extend([limit, offset])
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT id, date, description, amount FROM bank_transactions {where} ORDER BY date DESC LIMIT %s OFFSET %s",
            params,
        ).fetchall()
    return rows

# --- Reconciliation ---

@router.post("/reconcile")
async def run_reconciliation(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id if auth else None
    matches = reconcile_all(tid)
    if tid and matches:
        with get_conn() as conn:
            log_activity(conn, tid, "reconciliation", None, "run", f"{len(matches)} correspondências")
            conn.commit()
    return {"matched": len(matches), "matches": matches}

@router.get("/reconciliations")
async def list_reconciliations(
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    auth: AuthInfo = Depends(require_auth),
):
    clauses: list[str] = []
    params: list = []
    if auth and auth.tenant_id:
        clauses.append("r.tenant_id = %s")
        params.append(auth.tenant_id)
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
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


class ReconciliationPatch(BaseModel):
    status: Optional[str] = None

VALID_RECON_STATUSES = {"pendente", "aprovado", "rejeitado", "a_rever"}

@router.patch("/reconciliations/{recon_id}")
async def patch_reconciliation(recon_id: int, patch: ReconciliationPatch, auth: AuthInfo = Depends(require_auth)):
    if patch.status and patch.status not in VALID_RECON_STATUSES:
        raise HTTPException(status_code=422, detail=f"invalid status: {patch.status}")
    tid = auth.tenant_id or ""
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
    tid = auth.tenant_id if auth else None
    return suggest_matches(doc_id, tid)

# --- Movement Classification ---

@router.get("/bank-transactions/enrich")
async def enrich_movements(
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    auth: AuthInfo = Depends(require_auth),
):
    """List bank transactions with classification and entity detection."""
    from app.classify_movements import classify_movement, detect_entity
    tid = auth.tenant_id or ""
    clauses: list[str] = []
    params: list = []
    if tid:
        clauses.append("tenant_id = %s")
        params.append(tid)
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    params.extend([limit, offset])
    with get_conn() as conn:
        rows = conn.execute(
            f"SELECT id, date, description, amount FROM bank_transactions {where} ORDER BY date DESC LIMIT %s OFFSET %s",
            params,
        ).fetchall()
    results = []
    for tx in rows:
        cls = classify_movement(tx["description"], tid)
        entity = detect_entity(tx["description"], tid)
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
    tid = auth.tenant_id if auth else None
    return find_duplicates(tid)


# --- Movement Rules CRUD ---

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
    name: Optional[str] = None
    pattern: Optional[str] = None
    category: Optional[str] = None
    snc_account: Optional[str] = None
    entity_nif: Optional[str] = None
    priority: Optional[int] = None
    active: Optional[bool] = None

@router.get("/movement-rules", response_model=list[MovementRuleOut])
async def list_movement_rules(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        return conn.execute(
            "SELECT id, name, pattern, category, snc_account, entity_nif, priority, active FROM movement_rules WHERE tenant_id = %s ORDER BY priority ASC, id ASC",
            (tid,),
        ).fetchall()

@router.post("/movement-rules", response_model=MovementRuleOut, status_code=201)
async def create_movement_rule(body: MovementRuleCreate, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO movement_rules (tenant_id, name, pattern, category, snc_account, entity_nif, priority, active)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, name, pattern, category, snc_account, entity_nif, priority, active""",
            (tid, body.name, body.pattern, body.category, body.snc_account, body.entity_nif, body.priority, body.active),
        ).fetchone()
        conn.commit()
    return row

@router.patch("/movement-rules/{rule_id}", response_model=MovementRuleOut)
async def update_movement_rule(rule_id: int, patch: MovementRulePatch, auth: AuthInfo = Depends(require_auth)):
    updates = patch.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    tid = auth.tenant_id or ""
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
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="rule not found")
    return row

@router.delete("/movement-rules/{rule_id}", status_code=204)
async def delete_movement_rule(rule_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM movement_rules WHERE id = %s AND tenant_id = %s RETURNING id",
            (rule_id, tid),
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="rule not found")


# --- Alerts ---

class AlertOut(BaseModel):
    id: int
    type: str
    severity: str
    title: str
    description: str
    action_url: str | None = None
    read: bool
    created_at: datetime.datetime | None = None

@router.get("/alerts", response_model=list[AlertOut])
async def list_alerts(
    unread_only: bool = Query(default=False),
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id or ""
    clauses = ["tenant_id = %s"]
    params: list = [tid]
    if unread_only:
        clauses.append("read = false")
    where = "WHERE " + " AND ".join(clauses)
    with get_conn() as conn:
        return conn.execute(
            f"SELECT id, type, severity, title, description, action_url, read, created_at FROM alerts {where} ORDER BY created_at DESC LIMIT 100",
            params,
        ).fetchall()

@router.patch("/alerts/{alert_id}")
async def patch_alert(alert_id: int, auth: AuthInfo = Depends(require_auth)):
    """Mark an alert as read."""
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        row = conn.execute(
            "UPDATE alerts SET read = true WHERE id = %s AND tenant_id = %s RETURNING id",
            (alert_id, tid),
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="alert not found")
    return {"id": alert_id, "read": True}

@router.post("/alerts/generate")
async def generate_alerts(auth: AuthInfo = Depends(require_auth)):
    """Run the alerts engine to generate new compliance alerts."""
    from app.alerts import generate_compliance_alerts
    tid = auth.tenant_id or ""
    count = generate_compliance_alerts(tid)
    return {"generated": count}


# --- Assets ---

class AssetOut(BaseModel):
    id: int
    name: str
    category: str
    acquisition_date: datetime.date
    acquisition_cost: Decimal
    useful_life_years: int
    depreciation_method: str
    current_value: Decimal
    status: str
    supplier: str | None = None
    invoice_ref: str | None = None
    notes: str | None = None
    created_at: datetime.datetime | None = None

class AssetCreate(BaseModel):
    name: str
    category: str = "equipamento"
    acquisition_date: datetime.date
    acquisition_cost: Decimal
    useful_life_years: int = 5
    depreciation_method: str = "linha-reta"
    status: str = "ativo"
    supplier: str | None = None
    invoice_ref: str | None = None
    notes: str | None = None

class AssetPatch(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    acquisition_date: Optional[datetime.date] = None
    acquisition_cost: Optional[Decimal] = None
    useful_life_years: Optional[int] = None
    depreciation_method: Optional[str] = None
    status: Optional[str] = None
    supplier: Optional[str] = None
    invoice_ref: Optional[str] = None
    notes: Optional[str] = None

VALID_ASSET_CATEGORIES = {"equipamento", "mobiliário", "veículo", "imóvel", "informático", "intangível"}
VALID_DEPRECIATION_METHODS = {"linha-reta", "quotas-decrescentes", "não-definido"}
VALID_ASSET_STATUSES = {"ativo", "abatido", "vendido"}

@router.get("/assets", response_model=list[AssetOut])
async def list_assets(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT id, name, category, acquisition_date, acquisition_cost,
                      useful_life_years, depreciation_method, current_value,
                      status, supplier, invoice_ref, notes, created_at
               FROM assets WHERE tenant_id = %s ORDER BY acquisition_date DESC""",
            (tid,),
        ).fetchall()
    # Compute current_value based on depreciation
    from app.assets import compute_current_value
    result = []
    for r in rows:
        cv = compute_current_value(r)
        row_dict = dict(r)
        row_dict["current_value"] = cv
        result.append(row_dict)
    return result

@router.get("/assets/summary")
async def assets_summary(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or ""
    from app.assets import compute_current_value
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT id, name, category, acquisition_date, acquisition_cost,
                      useful_life_years, depreciation_method, current_value,
                      status, supplier, invoice_ref, notes, created_at
               FROM assets WHERE tenant_id = %s""",
            (tid,),
        ).fetchall()
    total_acquisition = sum(r["acquisition_cost"] for r in rows)
    current_values = [compute_current_value(r) for r in rows]
    total_current = sum(current_values)
    total_depreciation = total_acquisition - total_current
    annual_dep = sum(
        r["acquisition_cost"] / max(r["useful_life_years"], 1)
        for r in rows if r["depreciation_method"] != "não-definido" and r["status"] == "ativo"
    )
    without_method = sum(1 for r in rows if r["depreciation_method"] == "não-definido")
    return {
        "total_assets": len(rows),
        "total_acquisition_value": float(total_acquisition),
        "total_current_value": float(total_current),
        "total_depreciation": float(total_depreciation),
        "annual_depreciation": float(annual_dep),
        "without_method": without_method,
    }

@router.get("/assets/{asset_id}", response_model=AssetOut)
async def get_asset(asset_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        row = conn.execute(
            """SELECT id, name, category, acquisition_date, acquisition_cost,
                      useful_life_years, depreciation_method, current_value,
                      status, supplier, invoice_ref, notes, created_at
               FROM assets WHERE id = %s AND tenant_id = %s""",
            (asset_id, tid),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="asset not found")
    from app.assets import compute_current_value
    row_dict = dict(row)
    row_dict["current_value"] = compute_current_value(row)
    return row_dict

@router.post("/assets", response_model=AssetOut, status_code=201)
async def create_asset(body: AssetCreate, auth: AuthInfo = Depends(require_auth)):
    if body.category not in VALID_ASSET_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"invalid category: {body.category}")
    if body.depreciation_method not in VALID_DEPRECIATION_METHODS:
        raise HTTPException(status_code=422, detail=f"invalid method: {body.depreciation_method}")
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO assets (tenant_id, name, category, acquisition_date, acquisition_cost,
                      useful_life_years, depreciation_method, current_value, status, supplier, invoice_ref, notes)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, name, category, acquisition_date, acquisition_cost,
                         useful_life_years, depreciation_method, current_value,
                         status, supplier, invoice_ref, notes, created_at""",
            (tid, body.name, body.category, body.acquisition_date, body.acquisition_cost,
             body.useful_life_years, body.depreciation_method, body.acquisition_cost,
             body.status, body.supplier, body.invoice_ref, body.notes),
        ).fetchone()
        conn.commit()
    return row

@router.patch("/assets/{asset_id}", response_model=AssetOut)
async def update_asset(asset_id: int, patch: AssetPatch, auth: AuthInfo = Depends(require_auth)):
    updates = patch.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    if "category" in updates and updates["category"] not in VALID_ASSET_CATEGORIES:
        raise HTTPException(status_code=422, detail=f"invalid category: {updates['category']}")
    if "depreciation_method" in updates and updates["depreciation_method"] not in VALID_DEPRECIATION_METHODS:
        raise HTTPException(status_code=422, detail=f"invalid method: {updates['depreciation_method']}")
    if "status" in updates and updates["status"] not in VALID_ASSET_STATUSES:
        raise HTTPException(status_code=422, detail=f"invalid status: {updates['status']}")
    tid = auth.tenant_id or ""
    set_parts = []
    params: list = []
    for k, v in updates.items():
        set_parts.append(f"{k} = %s")
        params.append(v)
    params.extend([asset_id, tid])
    with get_conn() as conn:
        row = conn.execute(
            f"""UPDATE assets SET {', '.join(set_parts)} WHERE id = %s AND tenant_id = %s
                RETURNING id, name, category, acquisition_date, acquisition_cost,
                          useful_life_years, depreciation_method, current_value,
                          status, supplier, invoice_ref, notes, created_at""",
            params,
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="asset not found")
    return row

@router.delete("/assets/{asset_id}", status_code=204)
async def delete_asset(asset_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM assets WHERE id = %s AND tenant_id = %s RETURNING id",
            (asset_id, tid),
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="asset not found")


# --- CSV Export (generic) ---

@router.get("/export/bank-transactions/csv")
async def export_bank_transactions_csv(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or ""
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
async def export_reconciliations_csv(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or ""
    clauses = []
    params: list = []
    if tid:
        clauses.append("r.tenant_id = %s")
        params.append(tid)
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT r.id, r.document_id, r.bank_transaction_id, r.match_confidence, r.status,
                      d.supplier_nif, d.total, d.date as doc_date,
                      b.description, b.amount, b.date as tx_date
               FROM reconciliations r
               JOIN documents d ON d.id = r.document_id
               JOIN bank_transactions b ON b.id = r.bank_transaction_id
               {where} ORDER BY r.created_at DESC""",
            params,
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

@router.get("/export/assets/csv")
async def export_assets_csv(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT id, name, category, acquisition_date, acquisition_cost,
                      useful_life_years, depreciation_method, current_value, status, supplier, invoice_ref
               FROM assets WHERE tenant_id = %s ORDER BY acquisition_date DESC""",
            (tid,),
        ).fetchall()
    output = io.StringIO()
    writer = csv.DictWriter(output, extrasaction="ignore", fieldnames=["id", "name", "category", "acquisition_date", "acquisition_cost", "useful_life_years", "depreciation_method", "current_value", "status", "supplier", "invoice_ref"])
    writer.writeheader()
    for r in rows:
        writer.writerow(dict(r))
    output.seek(0)
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=ativos.csv"},
    )

# --- Dashboard ---

@router.get("/dashboard/summary")
async def dashboard_summary(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id if auth and auth.tenant_id else None
    cache_key = f"dashboard:{tid or 'anon'}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    tf = ""
    tp: list = []
    if tid:
        tf = " WHERE tenant_id = %s"
        tp = [tid]
    with get_conn() as conn:
        docs = conn.execute(f"SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM documents{tf}", tp).fetchone()
        txs = conn.execute(f"SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM bank_transactions{tf}", tp).fetchone()
        recs = conn.execute(f"SELECT COUNT(*) as count FROM reconciliations{tf}", tp).fetchone()
        unmatched = conn.execute(
            f"SELECT COUNT(*) as count FROM documents WHERE id NOT IN (SELECT document_id FROM reconciliations){' AND tenant_id = %s' if tp else ''}",
            tp,
        ).fetchone()
        pending = conn.execute(f"SELECT COUNT(*) as count FROM documents WHERE status = 'pendente'{' AND tenant_id = %s' if tp else ''}", tp).fetchone()
        classified = conn.execute(f"SELECT COUNT(*) as count FROM documents WHERE status IN ('classificado','revisto'){' AND tenant_id = %s' if tp else ''}", tp).fetchone()
    result = {
        "documents": {"count": docs["count"], "total": str(docs["total"])},
        "bank_transactions": {"count": txs["count"], "total": str(txs["total"])},
        "reconciliations": recs["count"],
        "unmatched_documents": unmatched["count"],
        "pending_review": pending["count"],
        "classified": classified["count"],
    }
    cache_set(cache_key, result, ttl=300)
    return result

@router.get("/dashboard/monthly")
async def monthly_summary(auth: AuthInfo = Depends(require_auth)):
    tf = ""
    tp: list = []
    if auth and auth.tenant_id:
        tf = " WHERE tenant_id = %s"
        tp = [auth.tenant_id]
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT to_char(date, 'YYYY-MM') as month,
                      COUNT(*) as doc_count,
                      COALESCE(SUM(total),0) as total,
                      COALESCE(SUM(vat),0) as vat
               FROM documents{tf} GROUP BY month ORDER BY month DESC LIMIT 12""",
            tp,
        ).fetchall()
    return [{"month": r["month"], "doc_count": r["doc_count"],
             "total": str(r["total"]), "vat": str(r["vat"])} for r in rows]

@router.get("/export/csv")
async def export_csv(auth: AuthInfo = Depends(require_auth)):
    clauses: list[str] = []
    params: list = []
    _tenant_clause(auth, clauses, params)
    where = "WHERE " + " AND ".join(clauses) if clauses else ""
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    with get_conn() as conn:
        docs = conn.execute(
            f"SELECT id, supplier_nif, client_nif, total, vat, date, type FROM documents {where} ORDER BY date DESC",
            params,
        ).fetchall()
    w.writerow(["ID", "NIF Fornecedor", "NIF Cliente", "Total", "IVA", "Data", "Tipo"])
    for d in docs:
        w.writerow([d["id"], d["supplier_nif"], d["client_nif"], str(d["total"]), str(d["vat"]), d["date"], d["type"]])
    buf.seek(0)
    return StreamingResponse(
        iter([buf.getvalue()]),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=documentos.csv"},
    )

# --- Entity Profile ---

ENTITY_FIELDS = [
    "legal_name", "nif", "cae", "cae_description", "entity_category",
    "accounting_regime", "vat_regime", "reporting_frequency", "employees",
    "turnover_range", "balance_sheet_range", "accountant_name",
    "accountant_email", "accountant_nif", "fiscal_rep_name", "fiscal_rep_nif",
    "address", "postal_code", "city",
]

@router.get("/entity")
async def get_entity(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        row = conn.execute(
            "SELECT data FROM tenant_settings WHERE tenant_id = %s AND key = 'entity_profile'",
            (tid,),
        ).fetchone()
    if row:
        import json as _json
        return _json.loads(row["data"])
    return {}


@router.put("/entity")
async def put_entity(request_body: dict, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    import json as _json
    data_json = _json.dumps(request_body)
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO tenant_settings (tenant_id, key, data) VALUES (%s, 'entity_profile', %s)
               ON CONFLICT (tenant_id, key) DO UPDATE SET data = %s, updated_at = now()""",
            (tid, data_json, data_json),
        )
        conn.commit()
    return request_body


# ═══════════════════════════════════════════════════════════════════════
# ── Inventory / Operations ────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

# --- Unit Families ---

@router.get("/unit-families")
async def list_unit_families(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        families = conn.execute(
            "SELECT id, name, base_unit FROM unit_families WHERE tenant_id = %s ORDER BY name",
            (tid,),
        ).fetchall()
        if not families:
            return []
        fam_ids = [f["id"] for f in families]
        conv_rows = conn.execute(
            "SELECT unit_family_id, from_unit, to_unit, factor FROM unit_conversions WHERE unit_family_id = ANY(%s)",
            (fam_ids,),
        ).fetchall()
        conv_map: dict[int, list[dict]] = {}
        for c in conv_rows:
            conv_map.setdefault(c["unit_family_id"], []).append(
                {"from_unit": c["from_unit"], "to_unit": c["to_unit"], "factor": c["factor"]}
            )
        result = []
        for f in families:
            result.append({**dict(f), "conversions": conv_map.get(f["id"], [])})
    return result


@router.post("/unit-families")
async def create_unit_family(body: dict, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    name = body.get("name", "")
    base_unit = body.get("base_unit", "")
    conversions = body.get("conversions", [])
    if not name or not base_unit:
        raise HTTPException(status_code=422, detail="name and base_unit required")
    with get_conn() as conn:
        row = conn.execute(
            "INSERT INTO unit_families (tenant_id, name, base_unit) VALUES (%s, %s, %s) RETURNING id, name, base_unit",
            (tid, name, base_unit),
        ).fetchone()
        fam_id = row["id"]
        for c in conversions:
            conn.execute(
                "INSERT INTO unit_conversions (unit_family_id, from_unit, to_unit, factor) VALUES (%s, %s, %s, %s)",
                (fam_id, c["from_unit"], c["to_unit"], Decimal(str(c["factor"]))),
            )
        conn.commit()
    return {**dict(row), "conversions": conversions}


# --- Suppliers ---

@router.get("/suppliers")
async def list_suppliers(
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, nif, category, avg_delivery_days, reliability FROM suppliers WHERE tenant_id = %s ORDER BY name LIMIT %s OFFSET %s",
            (tid, limit, offset),
        ).fetchall()
        if not rows:
            return []
        sup_ids = [s["id"] for s in rows]
        # Batch-fetch supplier_ingredients for all suppliers
        si_rows = conn.execute(
            "SELECT supplier_id, ingredient_id FROM supplier_ingredients WHERE supplier_id = ANY(%s)",
            (sup_ids,),
        ).fetchall()
        si_map: dict[int, list[int]] = {}
        for si in si_rows:
            si_map.setdefault(si["supplier_id"], []).append(si["ingredient_id"])
        # Batch-fetch price_history for all suppliers
        ph_rows = conn.execute(
            "SELECT ingredient_id, price, date, supplier_id FROM price_history WHERE supplier_id = ANY(%s) AND tenant_id = %s ORDER BY date DESC",
            (sup_ids, tid),
        ).fetchall()
        ph_map: dict[int, list[dict]] = {}
        for ph in ph_rows:
            ph_map.setdefault(ph["supplier_id"], []).append(dict(ph))
        result = []
        for s in rows:
            result.append({
                **dict(s),
                "ingredient_ids": si_map.get(s["id"], []),
                "price_history": ph_map.get(s["id"], [])[:50],
            })
    return result


@router.post("/suppliers")
async def create_supplier(body: dict, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="name required")
    nif = (body.get("nif") or "").strip()
    if nif and (not nif.isdigit() or len(nif) != 9):
        raise HTTPException(status_code=422, detail="NIF must be exactly 9 digits")
    if nif and not validate_nif(nif):
        raise HTTPException(status_code=422, detail="NIF inválido (checksum mod-11 falhou)")
    try:
        reliability = min(max(Decimal(str(body.get("reliability", 80))), Decimal("0")), Decimal("100"))
        avg_days = max(int(body.get("avg_delivery_days", 3)), 0)
    except (ValueError, ArithmeticError):
        raise HTTPException(status_code=422, detail="invalid numeric value")
    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO suppliers (tenant_id, name, nif, category, avg_delivery_days, reliability)
               VALUES (%s, %s, %s, %s, %s, %s)
               RETURNING id, name, nif, category, avg_delivery_days, reliability""",
            (tid, name, nif, (body.get("category") or "").strip(),
             avg_days, reliability),
        ).fetchone()
        # Link ingredients if provided
        for ing_id in body.get("ingredient_ids", []):
            conn.execute(
                "INSERT INTO supplier_ingredients (supplier_id, ingredient_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (row["id"], ing_id),
            )
        conn.commit()
    return {**dict(row), "ingredient_ids": body.get("ingredient_ids", []), "price_history": []}


@router.patch("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: int, body: dict, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    fields = {k: body[k] for k in ("name", "nif", "category", "avg_delivery_days", "reliability") if k in body}
    if not fields:
        raise HTTPException(status_code=422, detail="no fields to update")
    if "nif" in fields:
        nif = (fields["nif"] or "").strip()
        if nif and (not nif.isdigit() or len(nif) != 9):
            raise HTTPException(status_code=422, detail="NIF must be exactly 9 digits")
        if nif and not validate_nif(nif):
            raise HTTPException(status_code=422, detail="NIF inválido (checksum mod-11 falhou)")
        fields["nif"] = nif
    if "name" in fields:
        name = (fields["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="name required")
        fields["name"] = name
    if "reliability" in fields:
        try:
            fields["reliability"] = min(max(Decimal(str(fields["reliability"])), Decimal("0")), Decimal("100"))
        except (ValueError, ArithmeticError):
            raise HTTPException(status_code=422, detail="invalid reliability value")
    if "avg_delivery_days" in fields:
        try:
            fields["avg_delivery_days"] = max(int(fields["avg_delivery_days"]), 0)
        except (ValueError, TypeError):
            raise HTTPException(status_code=422, detail="invalid avg_delivery_days value")
    set_parts = [f"{k} = %s" for k in fields]
    params = list(fields.values()) + [supplier_id, tid]
    with get_conn() as conn:
        row = conn.execute(
            f"UPDATE suppliers SET {', '.join(set_parts)} WHERE id = %s AND tenant_id = %s RETURNING id, name, nif, category, avg_delivery_days, reliability",
            params,
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="supplier not found")
    return dict(row)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        row = conn.execute("DELETE FROM suppliers WHERE id = %s AND tenant_id = %s RETURNING id", (supplier_id, tid)).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="supplier not found")
    return {"deleted": True}


# --- Ingredients ---

def _get_current_stock(conn, ingredient_id: int, tenant_id: str | None = None) -> Decimal:
    """Compute current stock from stock_events ledger."""
    sql = """SELECT COALESCE(SUM(
            CASE
                WHEN type = 'entrada' THEN qty
                WHEN type IN ('saída', 'desperdício') THEN -qty
                WHEN type = 'ajuste' THEN qty
                ELSE 0
            END
        ), 0) AS stock
        FROM stock_events WHERE ingredient_id = %s"""
    params: list = [ingredient_id]
    if tenant_id:
        sql += " AND tenant_id = %s"
        params.append(tenant_id)
    row = conn.execute(sql, params).fetchone()
    return row["stock"] if row else Decimal("0")


def _get_ingredient_status(stock: Decimal, min_threshold: Decimal) -> str:
    if stock <= 0:
        return "rutura"
    if min_threshold > 0 and stock < min_threshold:
        return "baixo"
    if min_threshold > 0 and stock > min_threshold * 3:
        return "excesso"
    return "normal"


def _get_batch_stock(conn, ingredient_ids: list[int], tenant_id: str | None = None) -> dict[int, Decimal]:
    """Compute current stock for multiple ingredients in one query. Returns {ingredient_id: stock}."""
    if not ingredient_ids:
        return {}
    sql = """SELECT ingredient_id,
                    COALESCE(SUM(
                        CASE
                            WHEN type = 'entrada' THEN qty
                            WHEN type IN ('saída', 'desperdício') THEN -qty
                            WHEN type = 'ajuste' THEN qty
                            ELSE 0
                        END
                    ), 0) AS stock
             FROM stock_events
             WHERE ingredient_id = ANY(%s)"""
    params: list = [ingredient_ids]
    if tenant_id:
        sql += " AND tenant_id = %s"
        params.append(tenant_id)
    sql += " GROUP BY ingredient_id"
    rows = conn.execute(sql, params).fetchall()
    result = {row["ingredient_id"]: row["stock"] for row in rows}
    for iid in ingredient_ids:
        result.setdefault(iid, Decimal("0"))
    return result


@router.get("/ingredients")
async def list_ingredients(
    category: str | None = None,
    status_filter: str | None = None,
    limit: int = Query(default=200, le=1000),
    offset: int = 0,
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        clauses = ["i.tenant_id = %s"]
        params: list = [tid]
        if category:
            clauses.append("i.category = %s")
            params.append(category)
        where = " AND ".join(clauses)
        params.extend([limit, offset])
        rows = conn.execute(
            f"""SELECT i.id, i.name, i.category, i.unit, i.min_threshold,
                       i.supplier_id, i.last_cost, i.avg_cost,
                       s.name as supplier_name
                FROM ingredients i
                LEFT JOIN suppliers s ON s.id = i.supplier_id
                WHERE {where}
                ORDER BY i.name
                LIMIT %s OFFSET %s""",
            params,
        ).fetchall()
        if not rows:
            return []
        # Batch-fetch stock for all ingredients in one query
        ing_ids = [r["id"] for r in rows]
        stock_rows = conn.execute(
            """SELECT ingredient_id,
                      COALESCE(SUM(
                          CASE
                              WHEN type = 'entrada' THEN qty
                              WHEN type IN ('saída', 'desperdício') THEN -qty
                              WHEN type = 'ajuste' THEN qty
                              ELSE 0
                          END
                      ), 0) AS stock
               FROM stock_events
               WHERE ingredient_id = ANY(%s) AND tenant_id = %s
               GROUP BY ingredient_id""",
            (ing_ids, tid),
        ).fetchall()
        stock_map: dict[int, Decimal] = {sr["ingredient_id"]: sr["stock"] for sr in stock_rows}
        result = []
        for r in rows:
            stock = stock_map.get(r["id"], Decimal("0"))
            ing_status = _get_ingredient_status(stock, r["min_threshold"])
            if status_filter and ing_status != status_filter:
                continue
            result.append({
                **dict(r),
                "stock": float(stock),
                "status": ing_status,
            })
    return result


@router.post("/ingredients")
async def create_ingredient(body: dict, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    name = (body.get("name") or "").strip()
    if not name:
        raise HTTPException(status_code=422, detail="name required")
    try:
        min_threshold = max(Decimal(str(body.get("min_threshold", 0))), Decimal("0"))
        last_cost = max(Decimal(str(body.get("last_cost", 0))), Decimal("0"))
        avg_cost = max(Decimal(str(body.get("avg_cost", 0))), Decimal("0"))
    except (ValueError, ArithmeticError):
        raise HTTPException(status_code=422, detail="invalid numeric value")
    supplier_id = body.get("supplier_id")
    with get_conn() as conn:
        # Verify supplier belongs to tenant if provided
        if supplier_id:
            sup = conn.execute("SELECT id FROM suppliers WHERE id = %s AND tenant_id = %s", (supplier_id, tid)).fetchone()
            if not sup:
                raise HTTPException(status_code=422, detail="supplier not found")
        row = conn.execute(
            """INSERT INTO ingredients (tenant_id, name, category, unit, min_threshold, supplier_id, last_cost, avg_cost)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, name, category, unit, min_threshold, supplier_id, last_cost, avg_cost""",
            (tid, name, (body.get("category") or "").strip(), body.get("unit", "kg"),
             min_threshold, supplier_id, last_cost, avg_cost),
        ).fetchone()
        # Link to supplier if provided
        if supplier_id:
            conn.execute(
                "INSERT INTO supplier_ingredients (supplier_id, ingredient_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (supplier_id, row["id"]),
            )
        conn.commit()
    return {**dict(row), "stock": 0, "status": "normal"}


@router.patch("/ingredients/{ingredient_id}")
async def update_ingredient(ingredient_id: int, body: dict, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    fields = {k: body[k] for k in ("name", "category", "unit", "min_threshold", "supplier_id", "last_cost", "avg_cost") if k in body}
    if not fields:
        raise HTTPException(status_code=422, detail="no fields to update")
    set_parts = [f"{k} = %s" for k in fields]
    params = list(fields.values()) + [ingredient_id, tid]
    with get_conn() as conn:
        row = conn.execute(
            f"""UPDATE ingredients SET {', '.join(set_parts)}
                WHERE id = %s AND tenant_id = %s
                RETURNING id, name, category, unit, min_threshold, supplier_id, last_cost, avg_cost""",
            params,
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="ingredient not found")
    return dict(row)


@router.delete("/ingredients/{ingredient_id}")
async def delete_ingredient(ingredient_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        row = conn.execute("DELETE FROM ingredients WHERE id = %s AND tenant_id = %s RETURNING id", (ingredient_id, tid)).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="ingredient not found")
    return {"deleted": True}


# --- Stock Events ---

@router.get("/stock-events")
async def list_stock_events(
    ingredient_id: int | None = None,
    event_type: str | None = None,
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id or auth.user_id
    clauses = ["se.tenant_id = %s"]
    params: list = [tid]
    if ingredient_id:
        clauses.append("se.ingredient_id = %s")
        params.append(ingredient_id)
    if event_type:
        clauses.append("se.type = %s")
        params.append(event_type)
    where = " AND ".join(clauses)
    params.extend([limit, offset])
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT se.id, se.type, se.ingredient_id, se.qty, se.unit,
                       se.date, se.source, se.reference, se.cost,
                       i.name as ingredient_name
                FROM stock_events se
                JOIN ingredients i ON i.id = se.ingredient_id
                WHERE {where}
                ORDER BY se.date DESC, se.id DESC
                LIMIT %s OFFSET %s""",
            params,
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/stock-events")
async def create_stock_event(body: dict, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    event_type = body.get("type", "")
    ingredient_id = body.get("ingredient_id")
    qty = body.get("qty")
    if not event_type or not ingredient_id or qty is None:
        raise HTTPException(status_code=422, detail="type, ingredient_id, and qty required")
    if event_type not in ("entrada", "saída", "desperdício", "ajuste"):
        raise HTTPException(status_code=422, detail="type must be entrada/saída/desperdício/ajuste")
    try:
        qty_dec = Decimal(str(qty))
    except (ValueError, ArithmeticError):
        raise HTTPException(status_code=422, detail="invalid qty value")
    if qty_dec <= 0:
        raise HTTPException(status_code=422, detail="qty must be positive")
    with get_conn() as conn:
        # Verify ingredient exists and belongs to tenant
        ing = conn.execute(
            "SELECT id, unit FROM ingredients WHERE id = %s AND tenant_id = %s",
            (ingredient_id, tid),
        ).fetchone()
        if not ing:
            raise HTTPException(status_code=404, detail="ingredient not found")
        # Unit conversion enforcement
        event_unit = body.get("unit", ing["unit"])
        if event_unit != ing["unit"]:
            conv = conn.execute(
                """SELECT factor FROM unit_conversions
                   WHERE from_unit = %s AND to_unit = %s
                   LIMIT 1""",
                (event_unit, ing["unit"]),
            ).fetchone()
            if not conv:
                raise HTTPException(
                    status_code=422,
                    detail=f"no conversion from '{event_unit}' to '{ing['unit']}'",
                )
            qty_dec = qty_dec * conv["factor"]
            event_unit = ing["unit"]
        try:
            cost_val = Decimal(str(body["cost"])) if body.get("cost") is not None else None
        except (ValueError, ArithmeticError):
            raise HTTPException(status_code=422, detail="invalid cost value")
        if cost_val is not None and cost_val < 0:
            raise HTTPException(status_code=422, detail="cost must be non-negative")
        row = conn.execute(
            """INSERT INTO stock_events (tenant_id, type, ingredient_id, qty, unit, date, source, reference, cost)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, type, ingredient_id, qty, unit, date, source, reference, cost""",
            (tid, event_type, ingredient_id, qty_dec,
             event_unit,
             body.get("date", datetime.date.today().isoformat()),
             body.get("source", "manual"),
             body.get("reference", ""),
             cost_val),
        ).fetchone()
        # Update last_cost on ingredient if this is an entrada with cost
        if event_type == "entrada" and cost_val is not None:
            conn.execute(
                "UPDATE ingredients SET last_cost = %s WHERE id = %s",
                (cost_val, ingredient_id),
            )
        conn.commit()
    return dict(row)


# --- Products (Marmitas) ---

@router.get("/products")
async def list_products(
    limit: int = Query(default=200, le=1000),
    offset: int = 0,
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT id, code, name, category, recipe_version,
                      estimated_cost, pvp, margin, active
               FROM products WHERE tenant_id = %s ORDER BY code
               LIMIT %s OFFSET %s""",
            (tid, limit, offset),
        ).fetchall()
        if not rows:
            return []
        # Batch-fetch recipe_ingredients for all products
        prod_ids = [p["id"] for p in rows]
        recipe_rows = conn.execute(
            """SELECT ri.product_id, ri.ingredient_id, ri.qty, ri.unit, ri.wastage_percent,
                      i.name as ingredient_name, i.avg_cost
               FROM recipe_ingredients ri
               JOIN ingredients i ON i.id = ri.ingredient_id
               WHERE ri.product_id = ANY(%s)""",
            (prod_ids,),
        ).fetchall()
        recipe_map: dict[int, list[dict]] = {}
        for r in recipe_rows:
            recipe_map.setdefault(r["product_id"], []).append(dict(r))
        result = []
        for p in rows:
            result.append({
                **dict(p),
                "ingredients": recipe_map.get(p["id"], []),
            })
    return result


@router.post("/products")
async def create_product(body: dict, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    code = (body.get("code") or "").strip()
    name = (body.get("name") or "").strip()
    if not code or not name:
        raise HTTPException(status_code=422, detail="code and name required")
    try:
        pvp_val = max(Decimal(str(body.get("pvp", 0))), Decimal("0"))
    except (ValueError, ArithmeticError):
        raise HTTPException(status_code=422, detail="invalid pvp value")
    ingredients_list = body.get("ingredients", [])
    with get_conn() as conn:
        # Compute estimated cost from recipe
        estimated_cost = Decimal("0")
        for ri in ingredients_list:
            ing = conn.execute("SELECT avg_cost FROM ingredients WHERE id = %s", (ri["ingredient_id"],)).fetchone()
            if ing:
                waste_mult = 1 + Decimal(str(ri.get("wastage_percent", 0))) / 100
                estimated_cost += Decimal(str(ri["qty"])) * waste_mult * ing["avg_cost"]
        margin = ((pvp_val - estimated_cost) / pvp_val) if pvp_val > 0 else Decimal("0")
        row = conn.execute(
            """INSERT INTO products (tenant_id, code, name, category, recipe_version, estimated_cost, pvp, margin, active)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, code, name, category, recipe_version, estimated_cost, pvp, margin, active""",
            (tid, code, name, (body.get("category") or "").strip(), body.get("recipe_version", "v1"),
             estimated_cost, pvp_val, margin, body.get("active", True)),
        ).fetchone()
        # Insert recipe ingredients
        for ri in ingredients_list:
            conn.execute(
                """INSERT INTO recipe_ingredients (product_id, ingredient_id, qty, unit, wastage_percent)
                   VALUES (%s, %s, %s, %s, %s)""",
                (row["id"], ri["ingredient_id"], Decimal(str(ri["qty"])),
                 ri.get("unit", "kg"), Decimal(str(ri.get("wastage_percent", 0)))),
            )
        conn.commit()
    return {**dict(row), "ingredients": ingredients_list}


@router.patch("/products/{product_id}")
async def update_product(product_id: int, body: dict, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    fields = {k: body[k] for k in ("code", "name", "category", "pvp", "active", "recipe_version") if k in body}
    if not fields and "ingredients" not in body:
        raise HTTPException(status_code=422, detail="no fields to update")
    with get_conn() as conn:
        if fields:
            set_parts = [f"{k} = %s" for k in fields]
            params = list(fields.values()) + [product_id, tid]
            conn.execute(
                f"UPDATE products SET {', '.join(set_parts)} WHERE id = %s AND tenant_id = %s",
                params,
            )
        # Replace recipe ingredients if provided — verify tenant first
        if "ingredients" in body:
            existing_prod = conn.execute(
                "SELECT id, pvp FROM products WHERE id = %s AND tenant_id = %s", (product_id, tid)
            ).fetchone()
            if not existing_prod:
                raise HTTPException(status_code=404, detail="product not found")
            conn.execute("DELETE FROM recipe_ingredients WHERE product_id = %s", (product_id,))
            estimated_cost = Decimal("0")
            for ri in body["ingredients"]:
                conn.execute(
                    """INSERT INTO recipe_ingredients (product_id, ingredient_id, qty, unit, wastage_percent)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (product_id, ri["ingredient_id"], Decimal(str(ri["qty"])),
                     ri.get("unit", "kg"), Decimal(str(ri.get("wastage_percent", 0)))),
                )
                ing = conn.execute("SELECT avg_cost FROM ingredients WHERE id = %s AND tenant_id = %s", (ri["ingredient_id"], tid)).fetchone()
                if ing:
                    waste_mult = 1 + Decimal(str(ri.get("wastage_percent", 0))) / 100
                    estimated_cost += Decimal(str(ri["qty"])) * waste_mult * ing["avg_cost"]
            pvp = Decimal(str(body.get("pvp", 0)))
            if pvp <= 0:
                pvp = existing_prod["pvp"] if existing_prod else Decimal("0")
            margin = ((pvp - estimated_cost) / pvp) if pvp > 0 else Decimal("0")
            conn.execute(
                "UPDATE products SET estimated_cost = %s, margin = %s WHERE id = %s",
                (estimated_cost, margin, product_id),
            )
        conn.commit()
        row = conn.execute(
            "SELECT id, code, name, category, recipe_version, estimated_cost, pvp, margin, active FROM products WHERE id = %s AND tenant_id = %s",
            (product_id, tid),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="product not found")
    return dict(row)


@router.delete("/products/{product_id}")
async def delete_product(product_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        row = conn.execute("DELETE FROM products WHERE id = %s AND tenant_id = %s RETURNING id", (product_id, tid)).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="product not found")
    return {"deleted": True}


@router.get("/products/{product_id}/cost")
async def get_product_cost(product_id: int, auth: AuthInfo = Depends(require_auth)):
    """Compute live recipe cost from current ingredient avg_cost."""
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        prod = conn.execute(
            "SELECT id, pvp FROM products WHERE id = %s AND tenant_id = %s", (product_id, tid),
        ).fetchone()
        if not prod:
            raise HTTPException(status_code=404, detail="product not found")
        recipe = conn.execute(
            """SELECT ri.ingredient_id, ri.qty, ri.wastage_percent,
                      i.name, i.avg_cost, i.unit
               FROM recipe_ingredients ri
               JOIN ingredients i ON i.id = ri.ingredient_id AND i.tenant_id = %s
               WHERE ri.product_id = %s""",
            (tid, product_id),
        ).fetchall()
        total_cost = Decimal("0")
        breakdown = []
        for r in recipe:
            waste_mult = 1 + r["wastage_percent"] / 100
            line_cost = r["qty"] * waste_mult * r["avg_cost"]
            total_cost += line_cost
            breakdown.append({
                "ingredient_id": r["ingredient_id"],
                "name": r["name"],
                "qty": float(r["qty"]),
                "wastage_percent": float(r["wastage_percent"]),
                "avg_cost": float(r["avg_cost"]),
                "line_cost": float(line_cost),
            })
        pvp = prod["pvp"]
        margin = float((pvp - total_cost) / pvp) if pvp > 0 else 0
    return {"total_cost": float(total_cost), "margin": margin, "breakdown": breakdown}


@router.post("/products/{product_id}/produce")
async def produce_product(product_id: int, body: dict, auth: AuthInfo = Depends(require_auth)):
    """Execute production: creates saída stock events for each recipe ingredient × quantity."""
    tid = auth.tenant_id or auth.user_id
    qty_to_produce = body.get("qty", 1)
    if qty_to_produce <= 0:
        raise HTTPException(status_code=422, detail="qty must be positive")
    with get_conn() as conn:
        prod = conn.execute(
            "SELECT id, name, code FROM products WHERE id = %s AND tenant_id = %s",
            (product_id, tid),
        ).fetchone()
        if not prod:
            raise HTTPException(status_code=404, detail="product not found")
        recipe = conn.execute(
            "SELECT ingredient_id, qty, unit, wastage_percent FROM recipe_ingredients WHERE product_id = %s",
            (product_id,),
        ).fetchall()
        if not recipe:
            raise HTTPException(status_code=422, detail="product has no recipe")
        ing_ids = [ri["ingredient_id"] for ri in recipe]
        # Lock ingredient rows to prevent concurrent produce race condition
        conn.execute(
            "SELECT id FROM ingredients WHERE id = ANY(%s) AND tenant_id = %s FOR UPDATE",
            (ing_ids, tid),
        )
        # Verify sufficient stock (inside exclusive lock)
        stock_map = _get_batch_stock(conn, ing_ids, tid)
        for ri in recipe:
            waste_mult = 1 + ri["wastage_percent"] / 100
            needed = ri["qty"] * waste_mult * qty_to_produce
            if stock_map.get(ri["ingredient_id"], Decimal("0")) < needed:
                raise HTTPException(status_code=422, detail=f"insufficient stock for ingredient {ri['ingredient_id']}")
        events_created = []
        for ri in recipe:
            waste_mult = 1 + ri["wastage_percent"] / 100
            total_qty = ri["qty"] * waste_mult * qty_to_produce
            row = conn.execute(
                """INSERT INTO stock_events (tenant_id, type, ingredient_id, qty, unit, date, source, reference)
                   VALUES (%s, 'saída', %s, %s, %s, %s, 'produção', %s)
                   RETURNING id, type, ingredient_id, qty, unit, date, source, reference""",
                (tid, ri["ingredient_id"], total_qty, ri["unit"],
                 datetime.date.today().isoformat(), f"{prod['code']} x{qty_to_produce}"),
            ).fetchone()
            events_created.append(dict(row))
        conn.commit()
    return {"produced": qty_to_produce, "product": prod["name"], "events": events_created}


@router.get("/products/{product_id}/stock-impact")
async def get_stock_impact(product_id: int, qty: int = 1, auth: AuthInfo = Depends(require_auth)):
    """Preview what producing qty units would do to ingredient stocks."""
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        prod = conn.execute(
            "SELECT id FROM products WHERE id = %s AND tenant_id = %s", (product_id, tid),
        ).fetchone()
        if not prod:
            raise HTTPException(status_code=404, detail="product not found")
        recipe = conn.execute(
            """SELECT ri.ingredient_id, ri.qty, ri.unit, ri.wastage_percent,
                      i.name, i.min_threshold
               FROM recipe_ingredients ri
               JOIN ingredients i ON i.id = ri.ingredient_id AND i.tenant_id = %s
               WHERE ri.product_id = %s""",
            (tid, product_id),
        ).fetchall()
        impact = []
        sufficient = True
        for ri in recipe:
            current_stock = _get_current_stock(conn, ri["ingredient_id"], tid)
            waste_mult = 1 + ri["wastage_percent"] / 100
            needed = ri["qty"] * waste_mult * qty
            after = current_stock - needed
            is_ok = after >= 0
            if not is_ok:
                sufficient = False
            impact.append({
                "ingredient_id": ri["ingredient_id"],
                "name": ri["name"],
                "current_stock": float(current_stock),
                "needed": float(needed),
                "after": float(after),
                "unit": ri["unit"],
                "sufficient": is_ok,
            })
    return {"qty": qty, "sufficient": sufficient, "impact": impact}


# --- Inventory Stats & Shopping List ---

@router.get("/inventory/stats")
async def inventory_stats(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*) as count FROM ingredients WHERE tenant_id = %s", (tid,),
        ).fetchone()
        ingredients = conn.execute(
            "SELECT id, min_threshold, avg_cost FROM ingredients WHERE tenant_id = %s", (tid,),
        ).fetchall()
        rutura_count = 0
        baixo_count = 0
        stock_value = Decimal("0")
        stock_map = _get_batch_stock(conn, [i["id"] for i in ingredients], tid)
        for ing in ingredients:
            stock = stock_map.get(ing["id"], Decimal("0"))
            status = _get_ingredient_status(stock, ing["min_threshold"])
            if status == "rutura":
                rutura_count += 1
            elif status == "baixo":
                baixo_count += 1
            stock_value += stock * ing["avg_cost"]
        entradas = conn.execute(
            "SELECT COUNT(*) as count FROM stock_events WHERE tenant_id = %s AND type = 'entrada' AND date >= CURRENT_DATE - INTERVAL '30 days'",
            (tid,),
        ).fetchone()
        saidas = conn.execute(
            "SELECT COUNT(*) as count FROM stock_events WHERE tenant_id = %s AND type IN ('saída', 'desperdício') AND date >= CURRENT_DATE - INTERVAL '30 days'",
            (tid,),
        ).fetchone()
    return {
        "total_ingredients": total["count"],
        "rutura_count": rutura_count,
        "baixo_count": baixo_count,
        "stock_value": float(stock_value),
        "recent_entradas": entradas["count"],
        "recent_saidas": saidas["count"],
    }


@router.get("/inventory/shopping-list")
async def shopping_list(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        ingredients = conn.execute(
            """SELECT i.id, i.name, i.unit, i.min_threshold, i.supplier_id,
                      i.last_cost, i.avg_cost, s.name as supplier_name
               FROM ingredients i
               LEFT JOIN suppliers s ON s.id = i.supplier_id
               WHERE i.tenant_id = %s AND i.min_threshold > 0
               ORDER BY i.name""",
            (tid,),
        ).fetchall()
        items = []
        stock_map = _get_batch_stock(conn, [i["id"] for i in ingredients], tid)
        for ing in ingredients:
            stock = stock_map.get(ing["id"], Decimal("0"))
            if stock >= ing["min_threshold"]:
                continue  # No need to reorder
            suggested_qty = float(ing["min_threshold"] * 2 - stock)
            if stock <= 0:
                urgency = "urgente"
            elif stock < ing["min_threshold"]:
                urgency = "alta"
            else:
                urgency = "normal"
            items.append({
                "ingredient_id": ing["id"],
                "name": ing["name"],
                "current_stock": float(stock),
                "threshold": float(ing["min_threshold"]),
                "suggested_qty": suggested_qty,
                "unit": ing["unit"],
                "supplier_id": ing["supplier_id"],
                "supplier_name": ing.get("supplier_name"),
                "last_price": float(ing["last_cost"]),
                "avg_price": float(ing["avg_cost"]),
                "urgency": urgency,
            })
    return items


# --- Price History ---

# --- Tax Center ---

@router.get("/tax/iva-periods")
async def tax_iva_periods(auth: AuthInfo = Depends(require_auth)):
    """IVA aggregated by quarter: total invoiced, total VAT, docs count."""
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT
                TO_CHAR(date_trunc('quarter', date), 'YYYY') AS year,
                EXTRACT(QUARTER FROM date)::int               AS quarter,
                COUNT(*)                                       AS doc_count,
                SUM(total)                                     AS total_invoiced,
                SUM(vat)                                       AS total_vat,
                SUM(CASE WHEN type = 'fatura' THEN vat ELSE 0 END) AS vat_collected,
                SUM(CASE WHEN type IN ('fatura-fornecedor','recibo') THEN vat ELSE 0 END) AS vat_deductible
            FROM documents
            WHERE tenant_id = %s
              AND date IS NOT NULL
              AND status != 'arquivado'
            GROUP BY 1, 2
            ORDER BY 1 DESC, 2 DESC
            LIMIT 8
            """,
            (tid,),
        ).fetchall()
    return [
        {
            "period": f"Q{r['quarter']} {r['year']}",
            "year": r["year"],
            "quarter": r["quarter"],
            "doc_count": r["doc_count"],
            "total_invoiced": float(r["total_invoiced"] or 0),
            "total_vat": float(r["total_vat"] or 0),
            "vat_collected": float(r["vat_collected"] or 0),
            "vat_deductible": float(r["vat_deductible"] or 0),
            "vat_due": float((r["vat_collected"] or 0) - (r["vat_deductible"] or 0)),
        }
        for r in rows
    ]


@router.get("/tax/irc-estimate")
async def tax_irc_estimate(auth: AuthInfo = Depends(require_auth)):
    """IRC (corporate tax) estimate for the current year based on processed docs."""
    tid = auth.tenant_id or auth.user_id
    year = datetime.date.today().year
    with get_conn() as conn:
        totals = conn.execute(
            """
            SELECT
                SUM(CASE WHEN type = 'fatura' THEN total ELSE 0 END)                AS receitas,
                SUM(CASE WHEN type IN ('fatura-fornecedor','recibo') THEN total ELSE 0 END) AS gastos,
                COUNT(*) AS doc_count
            FROM documents
            WHERE tenant_id = %s
              AND EXTRACT(YEAR FROM date) = %s
              AND status != 'arquivado'
            """,
            (tid, year),
        ).fetchone()
    receitas = float(totals["receitas"] or 0)
    gastos = float(totals["gastos"] or 0)
    resultado = receitas - gastos
    # PT IRC: 17% up to €25k, 21% above (simplified estimate)
    if resultado <= 0:
        irc_estimate = 0.0
    elif resultado <= 25000:
        irc_estimate = resultado * 0.17
    else:
        irc_estimate = 25000 * 0.17 + (resultado - 25000) * 0.21
    return {
        "year": year,
        "receitas": receitas,
        "gastos": gastos,
        "resultado": resultado,
        "irc_estimate": round(irc_estimate, 2),
        "irc_rate_note": "17% até €25k, 21% acima (estimativa simplificada)",
        "doc_count": totals["doc_count"],
    }


@router.get("/tax/audit-flags")
async def tax_audit_flags(auth: AuthInfo = Depends(require_auth)):
    """Detect anomalies: docs with 0 VAT, round amounts, missing NIF."""
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        # Docs with zero VAT but non-zero total (suspicious)
        zero_vat = conn.execute(
            """SELECT COUNT(*) as count FROM documents
               WHERE tenant_id = %s AND vat = 0 AND total > 100 AND type = 'fatura'""",
            (tid,),
        ).fetchone()
        # Docs with suspiciously round amounts (multiple of 1000)
        round_amounts = conn.execute(
            """SELECT COUNT(*) as count FROM documents
               WHERE tenant_id = %s AND total > 0 AND MOD(total::numeric, 1000) = 0""",
            (tid,),
        ).fetchone()
        # Docs missing supplier NIF
        missing_nif = conn.execute(
            """SELECT COUNT(*) as count FROM documents
               WHERE tenant_id = %s AND (supplier_nif = '' OR supplier_nif = '000000000')""",
            (tid,),
        ).fetchone()
        # Duplicate amounts on same date
        duplicates = conn.execute(
            """SELECT COUNT(*) as count FROM (
                 SELECT date, total, COUNT(*) as n FROM documents
                 WHERE tenant_id = %s AND status != 'arquivado'
                 GROUP BY date, total HAVING COUNT(*) > 1
               ) sub""",
            (tid,),
        ).fetchone()
    flags = []
    if zero_vat["count"] > 0:
        flags.append({"type": "iva_zero", "severity": "warning",
                      "label": "IVA a zero em faturas", "count": zero_vat["count"],
                      "description": "Faturas com total > €100 mas IVA = 0"})
    if round_amounts["count"] > 0:
        flags.append({"type": "round_amount", "severity": "info",
                      "label": "Montantes redondos", "count": round_amounts["count"],
                      "description": "Documentos com valores múltiplos de €1.000"})
    if missing_nif["count"] > 0:
        flags.append({"type": "missing_nif", "severity": "error",
                      "label": "NIF em falta", "count": missing_nif["count"],
                      "description": "Documentos sem NIF do fornecedor identificado"})
    if duplicates["count"] > 0:
        flags.append({"type": "duplicate", "severity": "warning",
                      "label": "Possíveis duplicados", "count": duplicates["count"],
                      "description": "Pares de documentos com mesmo montante e data"})
    return {"flags": flags, "total_issues": len(flags)}


# --- Obligations ---

PT_OBLIGATIONS = [
    {"id": "iva_q1", "type": "IVA", "period": "T1", "deadline_month": 5, "deadline_day": 20, "description": "Declaração IVA 1º Trimestre"},
    {"id": "iva_q2", "type": "IVA", "period": "T2", "deadline_month": 8, "deadline_day": 20, "description": "Declaração IVA 2º Trimestre"},
    {"id": "iva_q3", "type": "IVA", "period": "T3", "deadline_month": 11, "deadline_day": 20, "description": "Declaração IVA 3º Trimestre"},
    {"id": "iva_q4", "type": "IVA", "period": "T4", "deadline_month": 2, "deadline_day": 20, "description": "Declaração IVA 4º Trimestre"},
    {"id": "irc_annual", "type": "IRC", "period": "Anual", "deadline_month": 7, "deadline_day": 31, "description": "Declaração Modelo 22 (IRC)"},
    {"id": "irs_cat_b", "type": "IRS", "period": "Anual", "deadline_month": 6, "deadline_day": 30, "description": "IRS Categoria B (se aplicável)"},
    {"id": "ss_q1", "type": "SS", "period": "T1", "deadline_month": 4, "deadline_day": 20, "description": "Segurança Social – Declaração Trimestral"},
    {"id": "ss_q2", "type": "SS", "period": "T2", "deadline_month": 7, "deadline_day": 20, "description": "Segurança Social – Declaração Trimestral"},
    {"id": "ss_q3", "type": "SS", "period": "T3", "deadline_month": 10, "deadline_day": 20, "description": "Segurança Social – Declaração Trimestral"},
    {"id": "ss_q4", "type": "SS", "period": "T4", "deadline_month": 1, "deadline_day": 20, "description": "Segurança Social – Declaração Trimestral"},
    {"id": "dmr_monthly", "type": "DMR", "period": "Mensal", "deadline_month": None, "deadline_day": 10, "description": "DMR – Declaração Mensal de Remunerações"},
    {"id": "saf_t", "type": "SAF-T", "period": "Mensal", "deadline_month": None, "deadline_day": 25, "description": "SAF-T – Ficheiro de auditoria tributária"},
]


@router.get("/obligations")
async def list_obligations(year: int | None = None, _auth: AuthInfo = Depends(require_auth)):
    """Return PT fiscal obligations with status relative to current date."""
    today = datetime.date.today()
    target_year = year or today.year
    result = []
    for ob in PT_OBLIGATIONS:
        if ob["deadline_month"] is None:
            # Monthly — generate for next 3 months
            for offset in range(3):
                m = (today.month + offset - 1) % 12 + 1
                y = target_year + ((today.month + offset - 1) // 12)
                deadline = datetime.date(y, m, min(ob["deadline_day"], 28))
                days_left = (deadline - today).days
                result.append({
                    **ob,
                    "id": f"{ob['id']}_{y}_{m:02d}",
                    "deadline": deadline.isoformat(),
                    "days_left": days_left,
                    "status": "overdue" if days_left < 0 else "urgent" if days_left <= 7 else "upcoming" if days_left <= 30 else "future",
                })
        else:
            dl_year = target_year if ob["deadline_month"] >= 3 else target_year + 1
            try:
                deadline = datetime.date(dl_year, ob["deadline_month"], ob["deadline_day"])
            except ValueError:
                deadline = datetime.date(dl_year, ob["deadline_month"], 28)
            days_left = (deadline - today).days
            result.append({
                **ob,
                "deadline": deadline.isoformat(),
                "days_left": days_left,
                "status": "overdue" if days_left < 0 else "urgent" if days_left <= 7 else "upcoming" if days_left <= 30 else "future",
            })
    result.sort(key=lambda x: x["deadline"])
    return result


# --- Reports ---

@router.get("/reports/pl")
async def report_pl(year: int | None = None, auth: AuthInfo = Depends(require_auth)):
    """Monthly P&L: revenues vs expenses, net result."""
    tid = auth.tenant_id or auth.user_id
    target_year = year or datetime.date.today().year
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT
                TO_CHAR(date_trunc('month', date), 'YYYY-MM') AS month,
                SUM(CASE WHEN type = 'fatura' THEN total ELSE 0 END)        AS receitas,
                SUM(CASE WHEN type = 'fatura' THEN vat ELSE 0 END)          AS iva_cobrado,
                SUM(CASE WHEN type IN ('fatura-fornecedor','recibo') THEN total ELSE 0 END) AS gastos,
                SUM(CASE WHEN type IN ('fatura-fornecedor','recibo') THEN vat ELSE 0 END)  AS iva_dedutivel,
                COUNT(*)                                                      AS doc_count
            FROM documents
            WHERE tenant_id = %s
              AND EXTRACT(YEAR FROM date) = %s
              AND date IS NOT NULL
              AND status != 'arquivado'
            GROUP BY 1
            ORDER BY 1
            """,
            (tid, target_year),
        ).fetchall()
    months_pt = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun", "Jul", "Ago", "Set", "Out", "Nov", "Dez"]
    data = []
    for r in rows:
        mm = int(r["month"].split("-")[1]) - 1
        receitas = float(r["receitas"] or 0)
        gastos = float(r["gastos"] or 0)
        data.append({
            "month": r["month"],
            "month_label": months_pt[mm],
            "receitas": receitas,
            "iva_cobrado": float(r["iva_cobrado"] or 0),
            "gastos": gastos,
            "iva_dedutivel": float(r["iva_dedutivel"] or 0),
            "resultado": receitas - gastos,
            "doc_count": r["doc_count"],
        })
    totals = {
        "receitas": sum(r["receitas"] for r in data),
        "gastos": sum(r["gastos"] for r in data),
        "resultado": sum(r["resultado"] for r in data),
        "iva_cobrado": sum(r["iva_cobrado"] for r in data),
        "iva_dedutivel": sum(r["iva_dedutivel"] for r in data),
    }
    return {"year": target_year, "months": data, "totals": totals}


@router.get("/reports/top-suppliers")
async def report_top_suppliers(limit: int = 10, auth: AuthInfo = Depends(require_auth)):
    """Top suppliers by total spend."""
    tid = auth.tenant_id or auth.user_id
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT supplier_nif,
                   COUNT(*) as doc_count,
                   SUM(total) as total_spend,
                   SUM(vat) as total_vat,
                   MAX(date) as last_date
            FROM documents
            WHERE tenant_id = %s
              AND type IN ('fatura-fornecedor', 'recibo')
              AND status != 'arquivado'
            GROUP BY supplier_nif
            ORDER BY total_spend DESC
            LIMIT %s
            """,
            (tid, limit),
        ).fetchall()
    return [
        {
            "supplier_nif": r["supplier_nif"],
            "doc_count": r["doc_count"],
            "total_spend": float(r["total_spend"] or 0),
            "total_vat": float(r["total_vat"] or 0),
            "last_date": r["last_date"].isoformat() if r["last_date"] else None,
        }
        for r in rows
    ]


# --- Price History ---

@router.post("/price-history")
async def add_price_point(body: dict, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or auth.user_id
    ingredient_id = body.get("ingredient_id")
    supplier_id = body.get("supplier_id")
    price = body.get("price")
    if not ingredient_id or not supplier_id or price is None:
        raise HTTPException(status_code=422, detail="ingredient_id, supplier_id, and price required")
    try:
        price_dec = Decimal(str(price))
    except (ValueError, ArithmeticError):
        raise HTTPException(status_code=422, detail="invalid price value")
    if price_dec < 0:
        raise HTTPException(status_code=422, detail="price must be non-negative")
    with get_conn() as conn:
        # Verify ingredient and supplier belong to tenant
        if not conn.execute("SELECT id FROM ingredients WHERE id = %s AND tenant_id = %s", (ingredient_id, tid)).fetchone():
            raise HTTPException(status_code=404, detail="ingredient not found")
        if not conn.execute("SELECT id FROM suppliers WHERE id = %s AND tenant_id = %s", (supplier_id, tid)).fetchone():
            raise HTTPException(status_code=404, detail="supplier not found")
        row = conn.execute(
            """INSERT INTO price_history (tenant_id, ingredient_id, supplier_id, price, date)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, ingredient_id, supplier_id, price, date""",
            (tid, ingredient_id, supplier_id, price_dec,
             body.get("date", datetime.date.today().isoformat())),
        ).fetchone()
        # Update ingredient avg_cost (tenant-scoped)
        avg = conn.execute(
            "SELECT AVG(price) as avg_price FROM price_history WHERE ingredient_id = %s AND tenant_id = %s",
            (ingredient_id, tid),
        ).fetchone()
        if avg and avg["avg_price"]:
            conn.execute(
                "UPDATE ingredients SET avg_cost = %s, last_cost = %s WHERE id = %s",
                (avg["avg_price"], price_dec, ingredient_id),
            )
        conn.commit()
    return dict(row)


# --- Classification Rules ---

class ClassificationRuleOut(BaseModel):
    id: int
    field: str
    operator: str
    value: str
    account: str
    label: str
    priority: int
    active: bool


class ClassificationRuleCreate(BaseModel):
    field: str
    operator: str
    value: str
    account: str
    label: str = ""
    priority: int = 0
    active: bool = True


class ClassificationRulePatch(BaseModel):
    field: Optional[str] = None
    operator: Optional[str] = None
    value: Optional[str] = None
    account: Optional[str] = None
    label: Optional[str] = None
    priority: Optional[int] = None
    active: Optional[bool] = None


VALID_FIELDS = {"supplier_nif", "description", "amount_gte", "amount_lte", "type"}
VALID_OPERATORS = {"equals", "contains", "starts_with", "gte", "lte"}


@router.get("/classification-rules", response_model=list[ClassificationRuleOut])
async def list_classification_rules(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, field, operator, value, account, label, priority, active FROM classification_rules WHERE tenant_id = %s ORDER BY priority ASC, id ASC",
            (tid,),
        ).fetchall()
    return rows


@router.post("/classification-rules", response_model=ClassificationRuleOut, status_code=201)
async def create_classification_rule(body: ClassificationRuleCreate, auth: AuthInfo = Depends(require_auth)):
    if body.field not in VALID_FIELDS:
        raise HTTPException(status_code=422, detail=f"invalid field: {body.field}")
    if body.operator not in VALID_OPERATORS:
        raise HTTPException(status_code=422, detail=f"invalid operator: {body.operator}")
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO classification_rules (tenant_id, field, operator, value, account, label, priority, active)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, field, operator, value, account, label, priority, active""",
            (tid, body.field, body.operator, body.value, body.account, body.label, body.priority, body.active),
        ).fetchone()
        conn.commit()
    return row


@router.patch("/classification-rules/{rule_id}", response_model=ClassificationRuleOut)
async def update_classification_rule(rule_id: int, patch: ClassificationRulePatch, auth: AuthInfo = Depends(require_auth)):
    updates = patch.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    if "field" in updates and updates["field"] not in VALID_FIELDS:
        raise HTTPException(status_code=422, detail=f"invalid field: {updates['field']}")
    if "operator" in updates and updates["operator"] not in VALID_OPERATORS:
        raise HTTPException(status_code=422, detail=f"invalid operator: {updates['operator']}")
    tid = auth.tenant_id or ""
    set_parts = []
    params: list = []
    for k, v in updates.items():
        set_parts.append(f"{k} = %s")
        params.append(v)
    params.extend([rule_id, tid])
    with get_conn() as conn:
        row = conn.execute(
            f"UPDATE classification_rules SET {', '.join(set_parts)} WHERE id = %s AND tenant_id = %s RETURNING id, field, operator, value, account, label, priority, active",
            params,
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="rule not found")
    return row


@router.delete("/classification-rules/{rule_id}", status_code=204)
async def delete_classification_rule(rule_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM classification_rules WHERE id = %s AND tenant_id = %s RETURNING id",
            (rule_id, tid),
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="rule not found")


# --- Activity Log ---

class ActivityEntry(BaseModel):
    id: int
    entity_type: str
    entity_id: int | None
    action: str
    detail: str
    created_at: datetime.datetime


@router.get("/activity", response_model=list[ActivityEntry])
async def list_activity(
    limit: int = Query(50, ge=1, le=200),
    auth: AuthInfo = Depends(require_auth),
):
    """Return recent audit log entries for the tenant."""
    tid = auth.tenant_id or ""
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, entity_type, entity_id, action, detail, created_at FROM audit_log WHERE tenant_id = %s ORDER BY created_at DESC LIMIT %s",
            (tid, limit),
        ).fetchall()
    return rows


# --- AI Assistant ---

_QUICK_PROMPTS = [
    {"id": "dashboard",   "label": "Resumo da conta",         "prompt": "Qual é o resumo da minha conta?",                 "category": "análise"},
    {"id": "pending",     "label": "Documentos pendentes",    "prompt": "Quantos documentos estão pendentes de revisão?",   "category": "operacional"},
    {"id": "recon",       "label": "Estado das reconciliações","prompt": "Qual é o estado das reconciliações?",              "category": "operacional"},
    {"id": "iva",         "label": "IVA do trimestre",        "prompt": "Qual é o IVA do trimestre atual?",                 "category": "fiscal"},
    {"id": "alerts",      "label": "Alertas ativos",          "prompt": "Tenho alertas de compliance ativos?",              "category": "fiscal"},
    {"id": "bank",        "label": "Saldo bancário",          "prompt": "Qual é o saldo dos movimentos bancários?",         "category": "análise"},
    {"id": "docs_month",  "label": "Documentos este mês",     "prompt": "Quantos documentos registei este mês?",            "category": "análise"},
    {"id": "assets",      "label": "Ativos registados",       "prompt": "Quantos ativos tenho registados?",                 "category": "operacional"},
]


@router.get("/assistant/prompts")
async def assistant_prompts(_auth: AuthInfo = Depends(require_auth)):
    """Return suggested quick-prompts for the assistant UI."""
    return _QUICK_PROMPTS


class ChatRequest(BaseModel):
    question: str


@router.post("/assistant/chat")
async def assistant_chat(body: ChatRequest, auth: AuthInfo = Depends(require_auth)):
    """Answer a natural-language accounting question using live DB data."""
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="question is required")
    if len(question) > 500:
        raise HTTPException(status_code=422, detail="question too long (max 500 chars)")
    tid = auth.tenant_id if auth and auth.tenant_id else None
    result = _answer_question(question, tid)
    return {
        "question": question,
        "intent": result["intent"],
        "answer": result["answer"],
    }
