import csv
import datetime
import io
import logging
import os
from decimal import Decimal

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel

from app.auth import AuthInfo, require_auth
from app.cache import cache_invalidate
from app.db import get_conn, log_activity
from app.limiter import EXPENSIVE_RATE, UPLOAD_RATE, WEBHOOK_RATE, limiter
from app.parse import (
    _MIME_FROM_EXT,
    _extract_with_vision,
    _normalize_llm_result,
    ingest_document,
    validate_nif,
)
from app.reconcile import reconcile_all

logger = logging.getLogger(__name__)

PAPERLESS_URL = os.environ.get("PAPERLESS_URL", "http://paperless:8000")
PAPERLESS_TOKEN = os.environ.get("PAPERLESS_TOKEN", "")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
UPLOADS_DIR = os.environ.get("UPLOADS_DIR", "/opt/tim/uploads")

ALLOWED_EXTENSIONS = {".pdf", ".jpg", ".jpeg", ".png", ".tiff", ".tif"}
MAX_UPLOAD_BYTES = 50 * 1024 * 1024  # 50 MB
MIME_MAP = {
    ".pdf": "application/pdf",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".tiff": "image/tiff",
    ".tif": "image/tiff",
}


def _safe_path(base: str, *parts: str) -> str:
    """Join path parts and verify the result is under base (path traversal guard)."""
    joined = os.path.join(base, *parts)
    real = os.path.realpath(joined)
    if not real.startswith(os.path.realpath(base)):
        raise HTTPException(status_code=400, detail="invalid path")
    return real


def _auto_reconcile(tenant_id: str) -> None:
    """Background task: run reconciliation after doc/bank upload."""
    try:
        result = reconcile_all(tenant_id)
        if result:
            logger.info("auto-reconcile: tenant=%s matched=%d", tenant_id, len(result))
        cache_invalidate(f"dashboard:{tenant_id}")
    except Exception:
        logger.exception("auto-reconcile failed for tenant=%s", tenant_id)


# ── Pydantic models ────────────────────────────────────────────────────

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
    reconciliation_status: str | None = None

class DocumentPatch(BaseModel):
    status: str | None = None
    type: str | None = None
    supplier_nif: str | None = None
    client_nif: str | None = None
    total: Decimal | None = None
    vat: Decimal | None = None
    date: datetime.date | None = None
    filename: str | None = None
    notes: str | None = None
    snc_account: str | None = None

class WebhookRequest(BaseModel):
    document_id: int
    secret: str = ""
    tenant_id: str = ""

class BulkDeletePayload(BaseModel):
    ids: list[int]


VALID_DOC_STATUSES = {"pendente", "pendente ocr", "a processar", "extraído", "aprovado", "rejeitado", "classificado", "revisto", "arquivado"}

# SNC accounts for content-based suggestion
_SNC_SUGGEST = {
    "fatura": {"account": "71", "label": "Vendas"},
    "fatura-fornecedor": {"account": "62", "label": "Fornecimentos e Serviços Externos"},
    "fatura-recibo": {"account": "62", "label": "Fornecimentos e Serviços Externos"},
    "fatura-simplificada": {"account": "62", "label": "Fornecimentos e Serviços Externos"},
    "fatura-proforma": {"account": "62", "label": "Fornecimentos e Serviços Externos"},
    "recibo": {"account": "62", "label": "Fornecimentos e Serviços Externos"},
    "nota-credito": {"account": "22", "label": "Fornecedores"},
    "nota-debito": {"account": "21", "label": "Clientes"},
    "extrato": {"account": "12", "label": "Depósitos à Ordem"},
}


router = APIRouter()


@router.post("/webhook")
@limiter.limit(WEBHOOK_RATE)
async def paperless_webhook(request: Request, payload: WebhookRequest, background_tasks: BackgroundTasks = None):  # type: ignore[assignment]
    import hmac
    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="webhook secret not configured")
    if not hmac.compare_digest(payload.secret, WEBHOOK_SECRET):
        raise HTTPException(status_code=403, detail="invalid webhook secret")
    tid = payload.tenant_id
    if not tid:
        with get_conn() as conn:
            pending = conn.execute(
                """SELECT tenant_id FROM documents
                   WHERE paperless_id IS NULL
                     AND status IN ('pendente ocr', 'a processar')
                     AND tenant_id != ''
                   ORDER BY created_at DESC LIMIT 1"""
            ).fetchone()
            if pending and pending["tenant_id"]:
                tid = pending["tenant_id"]
    if not tid:
        raise HTTPException(status_code=422, detail="tenant_id required: pass it in the payload or ensure a pending document stub exists")
    try:
        doc_id = ingest_document(payload.document_id, tenant_id=tid)
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    cache_invalidate(f"dashboard:{tid}")
    if background_tasks:
        background_tasks.add_task(_auto_reconcile, tid)
    return {"document_id": doc_id}


@router.post("/documents/upload")
@limiter.limit(UPLOAD_RATE)
async def upload_document(request: Request, file: UploadFile, background_tasks: BackgroundTasks, auth: AuthInfo = Depends(require_auth)):
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
        if len(content) > MAX_UPLOAD_BYTES:
            raise HTTPException(status_code=413, detail=f"file too large (max {MAX_UPLOAD_BYTES // (1024*1024)} MB)")
        logger.info("upload: file=%s size=%d ext=%s", file.filename, len(content), ext)
        mime = MIME_MAP.get(ext, "application/octet-stream")
        tid = auth.tenant_id

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
            raise HTTPException(status_code=500, detail="database error saving document record") from None

        try:
            tenant_dir = _safe_path(UPLOADS_DIR, tid or "_global")
            os.makedirs(tenant_dir, exist_ok=True)
            file_path = _safe_path(tenant_dir, f"{local_id}{ext}")
            with open(file_path, "wb") as f:
                f.write(content)
        except Exception as exc:
            logger.warning("upload: failed to save file to disk: %s", exc)

        mime_for_vision = _MIME_FROM_EXT.get(ext, "application/pdf")
        vision_result = _extract_with_vision(content, mime_for_vision)
        extracted = False
        if vision_result and vision_result.get("total", 0) > 0:
            raw_text = ""
            normalized = _normalize_llm_result(vision_result, raw_text)
            status = "extraído" if normalized["total"] > 0 else "pendente"
            with get_conn() as conn:
                conn.execute(
                    """UPDATE documents
                       SET supplier_nif=%s, client_nif=%s, total=%s, vat=%s, date=%s,
                           type=%s, raw_text=%s, status=%s, notes=%s, classification_source='vision'
                       WHERE id = %s""",
                    (normalized["supplier_nif"], normalized["client_nif"],
                     normalized["total"], normalized["vat"], normalized["doc_date"],
                     normalized["doc_type"], raw_text, status,
                     normalized["extra_json"], local_id),
                )
                conn.commit()
            extracted = True
            logger.info("upload: GPT Vision extraction succeeded for file=%s id=%d", file.filename, local_id)
        else:
            logger.warning("upload: GPT Vision failed for file=%s, document saved as pendente", file.filename)
            with get_conn() as conn:
                conn.execute("UPDATE documents SET status = 'pendente' WHERE id = %s", (local_id,))
                conn.commit()

        if PAPERLESS_TOKEN:
            headers = {"Authorization": f"Token {PAPERLESS_TOKEN}"}
            try:
                transport = httpx.HTTPTransport(retries=1)
                with httpx.Client(transport=transport) as client:
                    r = client.post(
                        f"{PAPERLESS_URL}/api/documents/post_document/",
                        headers=headers,
                        files={"document": (file.filename, content, mime)},
                        timeout=30,
                    )
                if r.status_code in (200, 202):
                    logger.info("upload: archived in Paperless file=%s", file.filename)
                else:
                    logger.warning("upload: paperless archive failed file=%s status=%d", file.filename, r.status_code)
            except Exception as exc:
                logger.warning("upload: paperless archive unreachable for file=%s: %s", file.filename, exc)

        cache_invalidate(f"dashboard:{tid}")
        background_tasks.add_task(_auto_reconcile, tid)
        status_msg = "accepted" if extracted else "accepted_pending"
        logger.info("upload: %s file=%s id=%d vision=%s", status_msg, file.filename, local_id, extracted)
        return {"status": status_msg, "filename": file.filename, "id": local_id}

    except HTTPException:
        raise
    except Exception:
        logger.exception("upload: unexpected error for file=%s", getattr(file, 'filename', '?'))
        raise HTTPException(status_code=500, detail="internal error during upload") from None


@router.get("/debug/upload-check")
async def upload_preflight():
    """Test DB and Paperless connectivity. Only works when AUTH_DISABLED=1."""
    if not os.environ.get("AUTH_DISABLED", "0") == "1":
        raise HTTPException(status_code=404)
    results: dict = {}
    try:
        with get_conn() as conn:
            conn.execute("SELECT 1")
        results["db"] = "ok"
    except Exception as e:
        results["db"] = f"error: {e}"
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


@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(
    supplier_nif: str | None = None,
    date_from: datetime.date | None = None,
    date_to: datetime.date | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    clauses: list[str] = ["d.tenant_id = %s"]
    params: list = [auth.tenant_id]
    if supplier_nif:
        clauses.append("d.supplier_nif = %s")
        params.append(supplier_nif)
    if date_from:
        clauses.append("d.date >= %s")
        params.append(date_from)
    if date_to:
        clauses.append("d.date <= %s")
        params.append(date_to)
    if status:
        clauses.append("d.status = %s")
        params.append(status)
    if search:
        escaped = search.replace("%", "\\%").replace("_", "\\_")
        clauses.append("(d.supplier_nif ILIKE %s OR d.client_nif ILIKE %s OR d.filename ILIKE %s)")
        q = f"%{escaped}%"
        params.extend([q, q, q])
    where = "WHERE " + " AND ".join(clauses)
    params.extend([limit, offset])
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT d.id, d.supplier_nif, d.client_nif, d.total, d.vat, d.date, d.type,
                       d.filename, d.raw_text, d.status, d.paperless_id, d.created_at,
                       d.notes, d.snc_account, d.classification_source,
                       r.status AS reconciliation_status
                FROM documents d
                LEFT JOIN LATERAL (
                    SELECT status FROM reconciliations
                    WHERE document_id = d.id
                    ORDER BY created_at DESC LIMIT 1
                ) r ON TRUE
                {where} ORDER BY d.created_at DESC LIMIT %s OFFSET %s""",
            params,
        ).fetchall()
    return rows


@router.post("/documents/auto-classify")
@limiter.limit(EXPENSIVE_RATE)
async def auto_classify_documents(request: Request, auth: AuthInfo = Depends(require_auth)):
    from app.classify import classify_document, fetch_rules
    tid = auth.tenant_id
    with get_conn() as conn:
        docs = conn.execute(
            """SELECT id, supplier_nif, client_nif, total, vat, date, type, filename, raw_text, status
               FROM documents
               WHERE tenant_id = %s AND (snc_account IS NULL OR snc_account = '')
               AND status != 'arquivado'""",
            (tid,),
        ).fetchall()

    rules = fetch_rules(tid)
    classified = 0
    skipped = 0
    with get_conn() as conn:
        for doc in docs:
            result = classify_document(dict(doc), tid, _rules=rules)
            if result:
                conn.execute(
                    "UPDATE documents SET snc_account = %s, classification_source = %s WHERE id = %s AND tenant_id = %s",
                    (result["account"], result["source"], doc["id"], tid),
                )
                log_activity(conn, tid, "document", doc["id"], "auto_classified",
                             f"Conta {result['account']} via regra")
                classified += 1
            else:
                skipped += 1
        conn.commit()

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
    tid = auth.tenant_id
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


@router.get("/documents/{doc_id}/suggest")
async def suggest_classification(doc_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id

    with get_conn() as conn:
        doc = conn.execute(
            "SELECT id, supplier_nif, client_nif, total, vat, type, raw_text, snc_account FROM documents WHERE id = %s AND tenant_id = %s",
            (doc_id, tid),
        ).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="document not found")

        if doc["snc_account"]:
            return {
                "account": doc["snc_account"],
                "label": next((s["label"] for s in _SNC_SUGGEST.values() if s["account"] == doc["snc_account"]), doc["snc_account"]),
                "confidence": 90,
                "source": "rule",
                "reason": "Classificado por regra automática",
            }

        from app.classify import classify_document as _classify
        doc_data = {
            "supplier_nif": doc["supplier_nif"],
            "client_nif": doc["client_nif"],
            "total": doc["total"],
            "type": doc["type"],
            "raw_text": doc["raw_text"],
        }
        result = _classify(doc_data, tid)
        if result:
            return {
                "account": result["account"],
                "label": result["label"] or result["account"],
                "confidence": 85,
                "source": "rule",
                "reason": "Baseado em regras de classificação",
            }

        from app.parse import suggest_account_with_llm
        llm_suggestion = suggest_account_with_llm(doc["raw_text"] or "", doc["type"] or "outro")
        if llm_suggestion:
            return llm_suggestion

        if doc["supplier_nif"] and doc["supplier_nif"] != "000000000":
            similar = conn.execute(
                """SELECT snc_account, COUNT(*) as cnt
                   FROM documents
                   WHERE tenant_id = %s AND supplier_nif = %s
                     AND snc_account IS NOT NULL AND snc_account != ''
                   GROUP BY snc_account ORDER BY cnt DESC LIMIT 1""",
                (tid, doc["supplier_nif"]),
            ).fetchone()
            if similar:
                return {
                    "account": similar["snc_account"],
                    "label": next((s["label"] for s in _SNC_SUGGEST.values() if s["account"] == similar["snc_account"]), similar["snc_account"]),
                    "confidence": 75,
                    "source": "similar",
                    "reason": f"Baseado em {similar['cnt']} documento(s) do mesmo fornecedor",
                }

        doc_type = doc["type"] or "outro"
        suggestion = _SNC_SUGGEST.get(doc_type)
        if suggestion:
            return {
                "account": suggestion["account"],
                "label": suggestion["label"],
                "confidence": 50,
                "source": "type",
                "reason": f"Baseado no tipo de documento ({doc_type})",
            }

        return {
            "account": "62",
            "label": "Fornecimentos e Serviços Externos",
            "confidence": 30,
            "source": "default",
            "reason": "Classificação por omissão — reveja manualmente",
        }


@router.get("/documents/{doc_id}", response_model=DocumentOut)
async def get_document(doc_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        row = conn.execute(
            """SELECT id, supplier_nif, client_nif, total, vat, date, type, filename, raw_text,
                       status, paperless_id, created_at, notes, snc_account, classification_source,
                       (SELECT r.status FROM reconciliations r
                        WHERE r.document_id = id
                        ORDER BY r.created_at DESC LIMIT 1) AS reconciliation_status
                FROM documents WHERE id = %s AND tenant_id = %s""",
            (doc_id, auth.tenant_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")
    return row


@router.patch("/documents/{doc_id}", response_model=DocumentOut)
async def update_document(doc_id: int, patch: DocumentPatch, auth: AuthInfo = Depends(require_auth)):
    updates = patch.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    if "status" in updates and updates["status"] not in VALID_DOC_STATUSES:
        raise HTTPException(status_code=422, detail=f"invalid status: {updates['status']}")
    for nif_field in ("supplier_nif", "client_nif"):
        nif_val = updates.get(nif_field)
        if nif_val and nif_val != "000000000" and nif_val != "" and not validate_nif(nif_val):
            raise HTTPException(status_code=422, detail=f"invalid {nif_field}: {nif_val}")
    set_parts = []
    params: list = []
    for k, v in updates.items():
        set_parts.append(f"{k} = %s")
        params.append(v)
    params.append(doc_id)
    params.append(auth.tenant_id)
    with get_conn() as conn:
        row = conn.execute(
            f"""UPDATE documents SET {', '.join(set_parts)} WHERE id = %s AND tenant_id = %s
                RETURNING id, supplier_nif, client_nif, total, vat, date, type, filename,
                          raw_text, status, paperless_id, created_at, notes, snc_account,
                          classification_source,
                          (SELECT r.status FROM reconciliations r
                           WHERE r.document_id = id
                           ORDER BY r.created_at DESC LIMIT 1) AS reconciliation_status""",
            params,
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")
    return row


@router.delete("/documents/{doc_id}", status_code=204)
async def delete_document(doc_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        row = conn.execute("SELECT id, paperless_id FROM documents WHERE id = %s AND tenant_id = %s", (doc_id, auth.tenant_id)).fetchone()
        if not row:
            raise HTTPException(status_code=404, detail="document not found")
        conn.execute("DELETE FROM reconciliations WHERE document_id = %s AND tenant_id = %s", (doc_id, auth.tenant_id))
        conn.execute("DELETE FROM documents WHERE id = %s AND tenant_id = %s", (doc_id, auth.tenant_id))
        log_activity(conn, auth.tenant_id, "document", doc_id, "deleted")
        conn.commit()
    return None


@router.post("/documents/bulk-delete", status_code=204)
@limiter.limit(EXPENSIVE_RATE)
async def bulk_delete_documents(request: Request, payload: BulkDeletePayload, auth: AuthInfo = Depends(require_auth)):
    if not payload.ids:
        return None
    if len(payload.ids) > 500:
        raise HTTPException(status_code=400, detail="max 500 documents per request")
    tid = auth.tenant_id
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM documents WHERE id = ANY(%s) AND tenant_id = %s",
            (payload.ids, tid),
        ).fetchall()
        existing_ids = [r["id"] for r in existing]
        if existing_ids:
            conn.execute("DELETE FROM reconciliations WHERE document_id = ANY(%s) AND tenant_id = %s", (existing_ids, tid))
            conn.execute("DELETE FROM documents WHERE id = ANY(%s) AND tenant_id = %s", (existing_ids, tid))
            for doc_id in existing_ids:
                log_activity(conn, tid, "document", doc_id, "deleted")
        conn.commit()
    return None


@router.post("/documents/{doc_id}/reprocess")
async def reprocess_document(doc_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT id, paperless_id, tenant_id FROM documents WHERE id = %s AND tenant_id = %s", (doc_id, auth.tenant_id)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")
    if not row["paperless_id"]:
        raise HTTPException(status_code=422, detail="document has no OCR source to reprocess")

    with get_conn() as conn:
        conn.execute(
            "UPDATE documents SET status = 'a processar' WHERE id = %s",
            (doc_id,),
        )
        conn.commit()

    try:
        new_id = ingest_document(row["paperless_id"], row["tenant_id"])
    except Exception as e:
        logger.exception("reprocess failed for doc %d", doc_id)
        raise HTTPException(status_code=500, detail=f"reprocess failed: {e}") from None
    return {"document_id": new_id}


@router.get("/documents/{doc_id}/preview")
async def document_preview(doc_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT paperless_id, filename, tenant_id FROM documents WHERE id = %s AND tenant_id = %s", (doc_id, auth.tenant_id)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")

    filename = row["filename"] or "document"
    ext = os.path.splitext(filename.lower())[1]
    content_type = MIME_MAP.get(ext, "application/pdf")

    tenant_dir = _safe_path(UPLOADS_DIR, row["tenant_id"] or "_global")
    local_path = _safe_path(tenant_dir, f"{doc_id}{ext}")
    if os.path.exists(local_path):
        from urllib.parse import quote
        return FileResponse(
            local_path,
            media_type=content_type,
            filename=filename,
            headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(filename, safe='')}"},
        )

    paperless_id = row["paperless_id"]
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
        raise HTTPException(status_code=502, detail="OCR service unavailable") from None

    from urllib.parse import quote
    return StreamingResponse(
        io.BytesIO(r.content),
        media_type=content_type,
        headers={"Content-Disposition": f"inline; filename*=UTF-8''{quote(filename, safe='')}"},
    )


@router.get("/documents/{doc_id}/thumbnail")
async def document_thumbnail(doc_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT paperless_id, filename, tenant_id FROM documents WHERE id = %s AND tenant_id = %s", (doc_id, auth.tenant_id)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")

    filename = row["filename"] or "document"
    ext = os.path.splitext(filename.lower())[1]

    if ext in (".jpg", ".jpeg", ".png", ".tiff", ".tif"):
        tenant_dir = _safe_path(UPLOADS_DIR, row["tenant_id"] or "_global")
        local_path = _safe_path(tenant_dir, f"{doc_id}{ext}")
        if os.path.exists(local_path):
            content_type = MIME_MAP.get(ext, "image/jpeg")
            return FileResponse(
                local_path,
                media_type=content_type,
                headers={"Cache-Control": "public, max-age=3600"},
            )

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
        raise HTTPException(status_code=502, detail="OCR service unavailable") from None

    return StreamingResponse(
        io.BytesIO(r.content),
        media_type="image/webp",
        headers={"Cache-Control": "public, max-age=3600"},
    )


@router.get("/export/csv")
@limiter.limit(EXPENSIVE_RATE)
async def export_csv(request: Request, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=";")
    with get_conn() as conn:
        docs = conn.execute(
            "SELECT id, supplier_nif, client_nif, total, vat, date, type FROM documents WHERE tenant_id = %s ORDER BY date DESC",
            (tid,),
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
