import csv
import datetime
import io
import logging
import os
from decimal import Decimal

import httpx
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, Query, Request, UploadFile
from fastapi.responses import FileResponse, StreamingResponse
from pydantic import BaseModel, ConfigDict, Field

from app.assistant import answer_question as _answer_question
from app.auth import AUTH_DISABLED, AuthInfo, optional_auth, require_auth
from app.cache import cache_get, cache_invalidate, cache_set
from app.db import get_conn, log_activity

__fingerprint__ = "TIM-LT-6d2f8b4a-e153-47c9-9a7e-b5c3f1d8a620"
from app.limiter import EXPENSIVE_RATE, UPLOAD_RATE, WEBHOOK_RATE, limiter
from app.parse import (
    _MIME_FROM_EXT,
    _extract_with_vision,
    _normalize_llm_result,
    ingest_document,
    validate_nif,
)
from app.reconcile import reconcile_all, suggest_matches

logger = logging.getLogger(__name__)

PAPERLESS_URL = os.environ.get("PAPERLESS_URL", "http://paperless:8000")
PAPERLESS_TOKEN = os.environ.get("PAPERLESS_TOKEN", "")
WEBHOOK_SECRET = os.environ.get("WEBHOOK_SECRET", "")
UPLOADS_DIR = os.environ.get("UPLOADS_DIR", "/opt/tim/uploads")


# ── Request models for loose endpoints ─────────────────────────────────

class EntityProfileBody(BaseModel):
    """Entity profile — known fields validated, extras preserved."""
    model_config = ConfigDict(extra="allow")
    nif: str = ""
    name: str = ""
    trade_name: str = ""
    address: str = ""
    postal_code: str = ""
    city: str = ""
    country: str = "PT"
    phone: str = ""
    email: str = ""
    cae: str = ""
    regime: str = ""
    capital_social: str = ""
    iban: str = ""
    fiscal_start_month: int = 1


class UnitFamilyConversion(BaseModel):
    from_unit: str
    to_unit: str
    factor: float = Field(gt=0)


class UnitFamilyBody(BaseModel):
    name: str = Field(min_length=1)
    base_unit: str = Field(min_length=1)
    conversions: list[UnitFamilyConversion] = []


# ── Pydantic models for inventory/operations endpoints ─────────────────

class SupplierCreate(BaseModel):
    name: str = Field(min_length=1)
    nif: str = ""
    category: str = ""
    reliability: Decimal = Decimal("80")
    avg_delivery_days: int = Field(default=3, ge=0)
    ingredient_ids: list[int] = []

class SupplierPatch(BaseModel):
    name: str | None = None
    nif: str | None = None
    category: str | None = None
    avg_delivery_days: int | None = Field(default=None, ge=0)
    reliability: Decimal | None = None

class IngredientCreate(BaseModel):
    name: str = Field(min_length=1)
    category: str = ""
    unit: str = "kg"
    min_threshold: Decimal = Field(default=Decimal("0"), ge=0)
    last_cost: Decimal = Field(default=Decimal("0"), ge=0)
    avg_cost: Decimal = Field(default=Decimal("0"), ge=0)
    supplier_id: int | None = None

class IngredientPatch(BaseModel):
    name: str | None = None
    category: str | None = None
    unit: str | None = None
    min_threshold: Decimal | None = None
    supplier_id: int | None = None
    last_cost: Decimal | None = None
    avg_cost: Decimal | None = None

class StockEventCreate(BaseModel):
    type: str
    ingredient_id: int
    qty: Decimal = Field(gt=0)
    unit: str | None = None
    cost: Decimal | None = Field(default=None, ge=0)
    date: str | None = None
    source: str = "manual"
    reference: str = ""

class RecipeIngredientInput(BaseModel):
    ingredient_id: int
    qty: Decimal = Field(gt=0)
    unit: str = "kg"
    wastage_percent: Decimal = Decimal("0")

class ProductCreate(BaseModel):
    code: str = Field(min_length=1)
    name: str = Field(min_length=1)
    pvp: Decimal = Field(default=Decimal("0"), ge=0)
    category: str = ""
    recipe_version: str = "v1"
    active: bool = True
    ingredients: list[RecipeIngredientInput] = []

class ProductPatch(BaseModel):
    code: str | None = None
    name: str | None = None
    category: str | None = None
    pvp: Decimal | None = None
    active: bool | None = None
    recipe_version: str | None = None
    estimated_cost: Decimal | None = None
    ingredients: list[RecipeIngredientInput] | None = None

class ProduceBody(BaseModel):
    qty: int = Field(default=1, gt=0)

class PricePointCreate(BaseModel):
    ingredient_id: int
    supplier_id: int
    price: Decimal = Field(ge=0)
    date: str | None = None


def _safe_path(base: str, *parts: str) -> str:
    """Join path parts and verify the result is under base (path traversal guard)."""
    joined = os.path.join(base, *parts)
    real = os.path.realpath(joined)
    if not real.startswith(os.path.realpath(base)):
        raise HTTPException(status_code=400, detail="invalid path")
    return real


router = APIRouter()


def _auto_reconcile(tenant_id: str) -> None:
    """Background task: run reconciliation after doc/bank upload."""
    try:
        result = reconcile_all(tenant_id)
        if result:
            logger.info("auto-reconcile: tenant=%s matched=%d", tenant_id, len(result))
        cache_invalidate(f"dashboard:{tenant_id}")
    except Exception:
        logger.exception("auto-reconcile failed for tenant=%s", tenant_id)


def _auto_classify(tenant_id: str) -> None:
    """Background task: classify movements after CSV upload."""
    try:
        from app.classify_movements import classify_all_movements
        result = classify_all_movements(tenant_id)
        if result["classified"]:
            logger.info("auto-classify: tenant=%s classified=%d/%d", tenant_id, result["classified"], result["total"])
    except Exception:
        logger.exception("auto-classify failed for tenant=%s", tenant_id)

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

class BankTransactionOut(BaseModel):
    id: int
    date: datetime.date
    description: str
    amount: Decimal
    category: str | None = None
    snc_account: str | None = None
    entity_nif: str | None = None
    classification_source: str | None = None

# --- Webhook ---

class WebhookRequest(BaseModel):
    document_id: int
    secret: str = ""
    tenant_id: str = ""

@router.post("/webhook")
@limiter.limit(WEBHOOK_RATE)
async def paperless_webhook(request: Request, payload: WebhookRequest, background_tasks: BackgroundTasks = None):  # type: ignore[assignment]
    import hmac
    if not WEBHOOK_SECRET:
        raise HTTPException(status_code=403, detail="webhook secret not configured")
    if not hmac.compare_digest(payload.secret, WEBHOOK_SECRET):
        raise HTTPException(status_code=403, detail="invalid webhook secret")
    # Resolve tenant_id: from payload, or from a pending document stub
    tid = payload.tenant_id
    if not tid:
        # Try to find a pending stub — match by most recently created, scoped to avoid cross-tenant leaks
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
            raise HTTPException(status_code=500, detail="database error saving document record") from None

        # Save file to disk for preview
        try:
            tenant_dir = _safe_path(UPLOADS_DIR, tid or "_global")
            os.makedirs(tenant_dir, exist_ok=True)
            file_path = _safe_path(tenant_dir, f"{local_id}{ext}")
            with open(file_path, "wb") as f:
                f.write(content)
        except Exception as exc:
            logger.warning("upload: failed to save file to disk: %s", exc)

        # -- Primary extraction: GPT Vision (always) --
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

        # -- Optional: forward to Paperless for archive (best-effort, non-blocking) --
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
    """Run classification rules against all unclassified documents for the tenant."""
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
    """Return classification coverage statistics for the tenant."""
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


@router.get("/documents/{doc_id}/suggest")
async def suggest_classification(doc_id: int, auth: AuthInfo = Depends(require_auth)):
    """Return a classification suggestion for a document."""
    tid = auth.tenant_id

    with get_conn() as conn:
        doc = conn.execute(
            "SELECT id, supplier_nif, client_nif, total, vat, type, raw_text, snc_account FROM documents WHERE id = %s AND tenant_id = %s",
            (doc_id, tid),
        ).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="document not found")

        # If already classified by a rule, return that
        if doc["snc_account"]:
            return {
                "account": doc["snc_account"],
                "label": next((s["label"] for s in _SNC_SUGGEST.values() if s["account"] == doc["snc_account"]), doc["snc_account"]),
                "confidence": 90,
                "source": "rule",
                "reason": "Classificado por regra automática",
            }

        # Try rule-based classification
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

        # Try LLM classification
        from app.parse import suggest_account_with_llm
        llm_suggestion = suggest_account_with_llm(doc["raw_text"] or "", doc["type"] or "outro")
        if llm_suggestion:
            return llm_suggestion

        # Check similar documents from same supplier
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

        # Fallback: suggest based on document type
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

VALID_DOC_STATUSES = {"pendente", "pendente ocr", "a processar", "extraído", "aprovado", "rejeitado", "classificado", "revisto", "arquivado"}

@router.patch("/documents/{doc_id}", response_model=DocumentOut)
async def update_document(doc_id: int, patch: DocumentPatch, auth: AuthInfo = Depends(require_auth)):
    updates = patch.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    # Validate status
    if "status" in updates and updates["status"] not in VALID_DOC_STATUSES:
        raise HTTPException(status_code=422, detail=f"invalid status: {updates['status']}")
    # Validate NIFs
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


class BulkDeletePayload(BaseModel):
    ids: list[int]


@router.post("/documents/bulk-delete", status_code=204)
@limiter.limit(EXPENSIVE_RATE)
async def bulk_delete_documents(request: Request, payload: BulkDeletePayload, auth: AuthInfo = Depends(require_auth)):
    if not payload.ids:
        return None
    if len(payload.ids) > 500:
        raise HTTPException(status_code=400, detail="max 500 documents per request")
    tid = auth.tenant_id
    with get_conn() as conn:
        # Batch delete: single query per table instead of N+1
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
    """Re-run OCR extraction on a document that has a paperless_id."""
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
    """Serve document file for preview — from local disk or Paperless."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT paperless_id, filename, tenant_id FROM documents WHERE id = %s AND tenant_id = %s", (doc_id, auth.tenant_id)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")

    filename = row["filename"] or "document"
    ext = os.path.splitext(filename.lower())[1]
    content_type = MIME_MAP.get(ext, "application/pdf")

    # Try local file first
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

    # Fallback to Paperless
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
    """Serve document thumbnail — from local file or Paperless."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT paperless_id, filename, tenant_id FROM documents WHERE id = %s AND tenant_id = %s", (doc_id, auth.tenant_id)
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")

    filename = row["filename"] or "document"
    ext = os.path.splitext(filename.lower())[1]

    # For images, serve the file itself as thumbnail
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

    # Fallback to Paperless thumbnail
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

# --- Bank Transactions ---

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
        # Load existing transactions for dedup (same date+description+amount)
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
            # Skip duplicates
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


class ManualClassification(BaseModel):
    category: str | None = None
    snc_account: str | None = None
    entity_nif: str | None = None


@router.patch("/bank-transactions/{tx_id}")
async def update_bank_transaction(tx_id: int, body: ManualClassification, auth: AuthInfo = Depends(require_auth)):
    """Manual classification override for a bank transaction."""
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
    """Classify all unclassified bank transactions using movement rules."""
    from app.classify_movements import classify_all_movements
    result = classify_all_movements(auth.tenant_id)
    cache_invalidate(f"dashboard:{auth.tenant_id}")
    return result


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


class ReconciliationPatch(BaseModel):
    status: str | None = None

VALID_RECON_STATUSES = {"pendente", "aprovado", "rejeitado", "a_rever"}

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

# --- Movement Classification ---

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
    """List bank transactions with classification and entity detection."""
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
    # Fetch rules and suppliers once for the whole batch
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
    name: str | None = None
    pattern: str | None = None
    category: str | None = None
    snc_account: str | None = None
    entity_nif: str | None = None
    priority: int | None = None
    active: bool | None = None

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
    tid = auth.tenant_id
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
    tid = auth.tenant_id
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
@limiter.limit(EXPENSIVE_RATE)
async def generate_alerts(request: Request, auth: AuthInfo = Depends(require_auth)):
    """Run the alerts engine to generate new compliance alerts."""
    from app.alerts import generate_compliance_alerts
    tid = auth.tenant_id
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
    name: str | None = None
    category: str | None = None
    acquisition_date: datetime.date | None = None
    acquisition_cost: Decimal | None = None
    useful_life_years: int | None = None
    depreciation_method: str | None = None
    status: str | None = None
    supplier: str | None = None
    invoice_ref: str | None = None
    notes: str | None = None

VALID_ASSET_CATEGORIES = {"equipamento", "mobiliário", "veículo", "imóvel", "informático", "intangível"}
VALID_DEPRECIATION_METHODS = {"linha-reta", "quotas-decrescentes", "não-definido"}
VALID_ASSET_STATUSES = {"ativo", "abatido", "vendido"}

@router.get("/assets", response_model=list[AssetOut])
async def list_assets(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
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
    tid = auth.tenant_id
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
    tid = auth.tenant_id
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
    tid = auth.tenant_id
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
        log_activity(conn, tid, "asset", row["id"], "created", body.name)
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
    tid = auth.tenant_id
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
        if row:
            log_activity(conn, tid, "asset", asset_id, "updated", str(list(updates.keys())))
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="asset not found")
    return row

@router.delete("/assets/{asset_id}", status_code=204)
async def delete_asset(asset_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM assets WHERE id = %s AND tenant_id = %s RETURNING id",
            (asset_id, tid),
        ).fetchone()
        if row:
            log_activity(conn, tid, "asset", asset_id, "deleted")
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="asset not found")


# --- CSV Export (generic) ---

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

@router.get("/export/assets/csv")
@limiter.limit(EXPENSIVE_RATE)
async def export_assets_csv(request: Request, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
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
    tid = auth.tenant_id
    cache_key = f"dashboard:{tid}"
    cached = cache_get(cache_key)
    if cached is not None:
        return cached
    tf = " WHERE tenant_id = %s"
    tp: list = [tid]
    with get_conn() as conn:
        docs = conn.execute(f"SELECT COUNT(*) as count, COALESCE(SUM(total),0) as total FROM documents{tf}", tp).fetchone()
        txs = conn.execute(f"SELECT COUNT(*) as count, COALESCE(SUM(amount),0) as total FROM bank_transactions{tf}", tp).fetchone()
        recs = conn.execute(f"SELECT COUNT(*) as count FROM reconciliations{tf}", tp).fetchone()
        unmatched = conn.execute(
            "SELECT COUNT(*) as count FROM documents WHERE tenant_id = %s AND id NOT IN (SELECT document_id FROM reconciliations)",
            (tid,),
        ).fetchone()
        pending = conn.execute("SELECT COUNT(*) as count FROM documents WHERE tenant_id = %s AND status IN ('pendente','pendente ocr','a processar')", (tid,)).fetchone()
        classified = conn.execute("SELECT COUNT(*) as count FROM documents WHERE tenant_id = %s AND status IN ('classificado','revisto')", (tid,)).fetchone()
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
    tid = auth.tenant_id
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT to_char(date, 'YYYY-MM') as month,
                      COUNT(*) as doc_count,
                      COALESCE(SUM(total),0) as total,
                      COALESCE(SUM(vat),0) as vat
               FROM documents WHERE tenant_id = %s GROUP BY month ORDER BY month DESC LIMIT 12""",
            (tid,),
        ).fetchall()
    return [{"month": r["month"], "doc_count": r["doc_count"],
             "total": str(r["total"]), "vat": str(r["vat"])} for r in rows]

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
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute(
            "SELECT data FROM tenant_settings WHERE tenant_id = %s AND key = 'entity_profile'",
            (tid,),
        ).fetchone()
    if row:
        return row["data"]
    return {}


@router.put("/entity")
async def put_entity(request_body: EntityProfileBody, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    import json as _json
    data_json = _json.dumps(request_body.model_dump())
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO tenant_settings (tenant_id, key, data) VALUES (%s, 'entity_profile', %s)
               ON CONFLICT (tenant_id, key) DO UPDATE SET data = %s, updated_at = now()""",
            (tid, data_json, data_json),
        )
        log_activity(conn, tid, "entity", None, "updated", "entity_profile")
        conn.commit()
    return request_body.model_dump()


# ═══════════════════════════════════════════════════════════════════════
# ── Inventory / Operations ────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

# --- Unit Families ---

@router.get("/unit-families")
async def list_unit_families(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
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
async def create_unit_family(body: UnitFamilyBody, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    name = body.name
    base_unit = body.base_unit
    conversions = [c.model_dump() for c in body.conversions]
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
        log_activity(conn, tid, "unit_family", fam_id, "created", name)
        conn.commit()
    return {**dict(row), "conversions": conversions}


# --- Suppliers ---

@router.get("/suppliers")
async def list_suppliers(
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id
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
async def create_supplier(body: SupplierCreate, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name required")
    nif = body.nif.strip()
    if nif and (not nif.isdigit() or len(nif) != 9):
        raise HTTPException(status_code=422, detail="NIF must be exactly 9 digits")
    if nif and not validate_nif(nif):
        raise HTTPException(status_code=422, detail="NIF inválido (checksum mod-11 falhou)")
    reliability = min(max(body.reliability, Decimal("0")), Decimal("100"))
    avg_days = max(body.avg_delivery_days, 0)
    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO suppliers (tenant_id, name, nif, category, avg_delivery_days, reliability)
               VALUES (%s, %s, %s, %s, %s, %s)
               RETURNING id, name, nif, category, avg_delivery_days, reliability""",
            (tid, name, nif, body.category.strip(),
             avg_days, reliability),
        ).fetchone()
        # Link ingredients if provided
        for ing_id in body.ingredient_ids:
            conn.execute(
                "INSERT INTO supplier_ingredients (supplier_id, ingredient_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (row["id"], ing_id),
            )
        log_activity(conn, tid, "supplier", row["id"], "created", name)
        conn.commit()
    return {**dict(row), "ingredient_ids": [i for i in body.ingredient_ids], "price_history": []}


@router.patch("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: int, body: SupplierPatch, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    if "nif" in updates:
        nif = (updates["nif"] or "").strip()
        if nif and (not nif.isdigit() or len(nif) != 9):
            raise HTTPException(status_code=422, detail="NIF must be exactly 9 digits")
        if nif and not validate_nif(nif):
            raise HTTPException(status_code=422, detail="NIF inválido (checksum mod-11 falhou)")
        updates["nif"] = nif
    if "name" in updates:
        name = (updates["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="name required")
        updates["name"] = name
    if "reliability" in updates and updates["reliability"] is not None:
        updates["reliability"] = min(max(updates["reliability"], Decimal("0")), Decimal("100"))
    set_parts = [f"{k} = %s" for k in updates]
    params = list(updates.values()) + [supplier_id, tid]
    with get_conn() as conn:
        row = conn.execute(
            f"UPDATE suppliers SET {', '.join(set_parts)} WHERE id = %s AND tenant_id = %s RETURNING id, name, nif, category, avg_delivery_days, reliability",
            params,
        ).fetchone()
        if row:
            log_activity(conn, tid, "supplier", supplier_id, "updated", str(list(updates.keys())))
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="supplier not found")
    return dict(row)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute("DELETE FROM suppliers WHERE id = %s AND tenant_id = %s RETURNING id", (supplier_id, tid)).fetchone()
        if row:
            log_activity(conn, tid, "supplier", supplier_id, "deleted")
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="supplier not found")
    return {"deleted": True}


# --- Ingredients ---

def _get_current_stock(conn, ingredient_id: int, tenant_id: str) -> Decimal:
    """Compute current stock from stock_events ledger."""
    row = conn.execute(
        """SELECT COALESCE(SUM(
            CASE
                WHEN type = 'entrada' THEN qty
                WHEN type IN ('saída', 'desperdício') THEN -qty
                WHEN type = 'ajuste' THEN qty
                ELSE 0
            END
        ), 0) AS stock
        FROM stock_events WHERE ingredient_id = %s AND tenant_id = %s""",
        (ingredient_id, tenant_id),
    ).fetchone()
    return row["stock"] if row else Decimal("0")


def _get_ingredient_status(stock: Decimal, min_threshold: Decimal) -> str:
    if stock <= 0:
        return "rutura"
    if min_threshold > 0 and stock < min_threshold:
        return "baixo"
    if min_threshold > 0 and stock > min_threshold * 3:
        return "excesso"
    return "normal"


def _get_batch_stock(conn, ingredient_ids: list[int], tenant_id: str) -> dict[int, Decimal]:
    """Compute current stock for multiple ingredients in one query. Returns {ingredient_id: stock}."""
    if not ingredient_ids:
        return {}
    rows = conn.execute(
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
        (ingredient_ids, tenant_id),
    ).fetchall()
    result = {row["ingredient_id"]: row["stock"] for row in rows}
    for iid in ingredient_ids:
        result.setdefault(iid, Decimal("0"))
    return result


@router.get("/ingredients")
async def list_ingredients(
    category: str | None = None,
    status_filter: str | None = None,
    limit: int = Query(default=200, le=1000),
    offset: int = Query(default=0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id
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
async def create_ingredient(body: IngredientCreate, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name required")
    min_threshold = max(body.min_threshold, Decimal("0"))
    last_cost = max(body.last_cost, Decimal("0"))
    avg_cost = max(body.avg_cost, Decimal("0"))
    supplier_id = body.supplier_id
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
            (tid, name, body.category.strip(), body.unit,
             min_threshold, supplier_id, last_cost, avg_cost),
        ).fetchone()
        # Link to supplier if provided
        if supplier_id:
            conn.execute(
                "INSERT INTO supplier_ingredients (supplier_id, ingredient_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (supplier_id, row["id"]),
            )
        log_activity(conn, tid, "ingredient", row["id"], "created", name)
        conn.commit()
    return {**dict(row), "stock": 0, "status": "normal"}


@router.patch("/ingredients/{ingredient_id}")
async def update_ingredient(ingredient_id: int, body: IngredientPatch, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    fields = body.model_dump(exclude_unset=True)
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
        if row:
            log_activity(conn, tid, "ingredient", ingredient_id, "updated", str(list(fields.keys())))
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="ingredient not found")
    return dict(row)


@router.delete("/ingredients/{ingredient_id}")
async def delete_ingredient(ingredient_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute("DELETE FROM ingredients WHERE id = %s AND tenant_id = %s RETURNING id", (ingredient_id, tid)).fetchone()
        if row:
            log_activity(conn, tid, "ingredient", ingredient_id, "deleted")
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
    offset: int = Query(default=0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id
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
@limiter.limit(EXPENSIVE_RATE)
async def create_stock_event(request: Request, body: StockEventCreate, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    event_type = body.type
    if event_type not in ("entrada", "saída", "desperdício", "ajuste"):
        raise HTTPException(status_code=422, detail="type must be entrada/saída/desperdício/ajuste")
    qty_dec = body.qty
    with get_conn() as conn:
        # Verify ingredient exists and belongs to tenant
        ing = conn.execute(
            "SELECT id, unit FROM ingredients WHERE id = %s AND tenant_id = %s",
            (body.ingredient_id, tid),
        ).fetchone()
        if not ing:
            raise HTTPException(status_code=404, detail="ingredient not found")
        # Unit conversion enforcement
        event_unit = body.unit or ing["unit"]
        if event_unit != ing["unit"]:
            conv = conn.execute(
                """SELECT uc.factor FROM unit_conversions uc
                   JOIN unit_families uf ON uf.id = uc.unit_family_id
                   WHERE uc.from_unit = %s AND uc.to_unit = %s AND uf.tenant_id = %s
                   LIMIT 1""",
                (event_unit, ing["unit"], tid),
            ).fetchone()
            if not conv:
                raise HTTPException(
                    status_code=422,
                    detail=f"no conversion from '{event_unit}' to '{ing['unit']}'",
                )
            qty_dec = qty_dec * conv["factor"]
            event_unit = ing["unit"]
        cost_val = body.cost
        row = conn.execute(
            """INSERT INTO stock_events (tenant_id, type, ingredient_id, qty, unit, date, source, reference, cost)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, type, ingredient_id, qty, unit, date, source, reference, cost""",
            (tid, event_type, body.ingredient_id, qty_dec,
             event_unit,
             body.date or datetime.date.today().isoformat(),
             body.source,
             body.reference,
             cost_val),
        ).fetchone()
        # Update last_cost on ingredient if this is an entrada with cost
        if event_type == "entrada" and cost_val is not None:
            conn.execute(
                "UPDATE ingredients SET last_cost = %s WHERE id = %s",
                (cost_val, body.ingredient_id),
            )
        log_activity(conn, tid, "stock_event", row["id"], "created", f"{event_type} {qty_dec}")
        conn.commit()
    return dict(row)


# --- Products (Marmitas) ---

@router.get("/products")
async def list_products(
    limit: int = Query(default=200, le=1000),
    offset: int = Query(default=0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id
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
async def create_product(body: ProductCreate, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    code = body.code.strip()
    name = body.name.strip()
    if not code or not name:
        raise HTTPException(status_code=422, detail="code and name required")
    pvp_val = max(body.pvp, Decimal("0"))
    ingredients_list = body.ingredients
    with get_conn() as conn:
        # Compute estimated cost from recipe
        estimated_cost = Decimal("0")
        for ri in ingredients_list:
            ing = conn.execute("SELECT avg_cost FROM ingredients WHERE id = %s AND tenant_id = %s", (ri.ingredient_id, tid)).fetchone()
            if not ing:
                raise HTTPException(status_code=400, detail=f"ingredient {ri.ingredient_id} not found")
            waste_mult = 1 + ri.wastage_percent / 100
            estimated_cost += ri.qty * waste_mult * ing["avg_cost"]
        margin = ((pvp_val - estimated_cost) / pvp_val) if pvp_val > 0 else Decimal("0")
        row = conn.execute(
            """INSERT INTO products (tenant_id, code, name, category, recipe_version, estimated_cost, pvp, margin, active)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, code, name, category, recipe_version, estimated_cost, pvp, margin, active""",
            (tid, code, name, body.category.strip(), body.recipe_version,
             estimated_cost, pvp_val, margin, body.active),
        ).fetchone()
        # Insert recipe ingredients
        for ri in ingredients_list:
            conn.execute(
                """INSERT INTO recipe_ingredients (product_id, ingredient_id, qty, unit, wastage_percent)
                   VALUES (%s, %s, %s, %s, %s)""",
                (row["id"], ri.ingredient_id, ri.qty,
                 ri.unit, ri.wastage_percent),
            )
        log_activity(conn, tid, "product", row["id"], "created", name)
        conn.commit()
    return {**dict(row), "ingredients": [ri.model_dump() for ri in ingredients_list]}


@router.patch("/products/{product_id}")
async def update_product(product_id: int, body: ProductPatch, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    updates = body.model_dump(exclude_unset=True)
    ingredients_input = updates.pop("ingredients", None)
    fields = {k: v for k, v in updates.items()}
    if not fields and ingredients_input is None:
        raise HTTPException(status_code=422, detail="no fields to update")
    with get_conn() as conn:
        if "estimated_cost" in fields:
            pvp = Decimal(str(fields.get("pvp", 0)))
            if pvp <= 0:
                existing = conn.execute("SELECT pvp FROM products WHERE id = %s AND tenant_id = %s", (product_id, tid)).fetchone()
                pvp = existing["pvp"] if existing else Decimal("0")
            fields["margin"] = ((pvp - fields["estimated_cost"]) / pvp) if pvp > 0 else Decimal("0")
        if fields:
            set_parts = [f"{k} = %s" for k in fields]
            params = list(fields.values()) + [product_id, tid]
            conn.execute(
                f"UPDATE products SET {', '.join(set_parts)} WHERE id = %s AND tenant_id = %s",
                params,
            )
        # Replace recipe ingredients if provided — verify tenant first
        if ingredients_input is not None:
            existing_prod = conn.execute(
                "SELECT id, pvp FROM products WHERE id = %s AND tenant_id = %s", (product_id, tid)
            ).fetchone()
            if not existing_prod:
                raise HTTPException(status_code=404, detail="product not found")
            conn.execute("DELETE FROM recipe_ingredients WHERE product_id = %s", (product_id,))
            estimated_cost = Decimal("0")
            for ri in ingredients_input:
                ing = conn.execute("SELECT avg_cost FROM ingredients WHERE id = %s AND tenant_id = %s", (ri["ingredient_id"], tid)).fetchone()
                if not ing:
                    raise HTTPException(status_code=400, detail=f"ingredient {ri['ingredient_id']} not found")
                conn.execute(
                    """INSERT INTO recipe_ingredients (product_id, ingredient_id, qty, unit, wastage_percent)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (product_id, ri["ingredient_id"], Decimal(str(ri["qty"])),
                     ri.get("unit", "kg"), Decimal(str(ri.get("wastage_percent", 0)))),
                )
                waste_mult = 1 + Decimal(str(ri.get("wastage_percent", 0))) / 100
                estimated_cost += Decimal(str(ri["qty"])) * waste_mult * ing["avg_cost"]
            # Only overwrite estimated_cost when a non-empty recipe is provided.
            if ingredients_input:
                pvp = Decimal(str(updates.get("pvp", 0)))
                if pvp <= 0:
                    pvp = existing_prod["pvp"] if existing_prod else Decimal("0")
                margin = ((pvp - estimated_cost) / pvp) if pvp > 0 else Decimal("0")
                conn.execute(
                    "UPDATE products SET estimated_cost = %s, margin = %s WHERE id = %s",
                    (estimated_cost, margin, product_id),
                )
        log_activity(conn, tid, "product", product_id, "updated", str(list(updates.keys())))
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
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute("DELETE FROM products WHERE id = %s AND tenant_id = %s RETURNING id", (product_id, tid)).fetchone()
        if row:
            log_activity(conn, tid, "product", product_id, "deleted")
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="product not found")
    return {"deleted": True}


@router.get("/products/{product_id}/cost")
async def get_product_cost(product_id: int, auth: AuthInfo = Depends(require_auth)):
    """Compute live recipe cost from current ingredient avg_cost."""
    tid = auth.tenant_id
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
@limiter.limit(EXPENSIVE_RATE)
async def produce_product(request: Request, product_id: int, body: ProduceBody, auth: AuthInfo = Depends(require_auth)):
    """Execute production: creates saída stock events for each recipe ingredient × quantity."""
    tid = auth.tenant_id
    qty_to_produce = body.qty
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
        log_activity(conn, tid, "product", product_id, "produced", f"x{qty_to_produce}")
        conn.commit()
    return {"produced": qty_to_produce, "product": prod["name"], "events": events_created}


@router.get("/products/{product_id}/stock-impact")
async def get_stock_impact(product_id: int, qty: int = 1, auth: AuthInfo = Depends(require_auth)):
    """Preview what producing qty units would do to ingredient stocks."""
    tid = auth.tenant_id
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
    tid = auth.tenant_id
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
    tid = auth.tenant_id
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
    tid = auth.tenant_id
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
            "total_invoiced": round(float(r["total_invoiced"] or 0), 2),
            "total_vat": round(float(r["total_vat"] or 0), 2),
            "vat_collected": round(float(r["vat_collected"] or 0), 2),
            "vat_deductible": round(float(r["vat_deductible"] or 0), 2),
            "vat_due": round(float((r["vat_collected"] or 0) - (r["vat_deductible"] or 0)), 2),
        }
        for r in rows
    ]


@router.get("/tax/irc-estimate")
async def tax_irc_estimate(auth: AuthInfo = Depends(require_auth)):
    """IRC (corporate tax) estimate for the current year based on processed docs."""
    tid = auth.tenant_id
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
    receitas = round(float(totals["receitas"] or 0), 2)
    gastos = round(float(totals["gastos"] or 0), 2)
    resultado = round(receitas - gastos, 2)
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
    tid = auth.tenant_id
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

PT_OBLIGATIONS: list[dict[str, object]] = [
    {"id": "iva_q1", "type": "IVA", "period": "T1", "deadline_month": 5, "deadline_day": 20, "description": "Declaração IVA 1º Trimestre"},
    {"id": "iva_q2", "type": "IVA", "period": "T2", "deadline_month": 8, "deadline_day": 20, "description": "Declaração IVA 2º Trimestre"},
    {"id": "iva_q3", "type": "IVA", "period": "T3", "deadline_month": 11, "deadline_day": 20, "description": "Declaração IVA 3º Trimestre"},
    {"id": "iva_q4", "type": "IVA", "period": "T4", "deadline_month": 2, "deadline_day": 20, "description": "Declaração IVA 4º Trimestre"},
    {"id": "irc_annual", "type": "IRC", "period": "Anual", "deadline_month": 5, "deadline_day": 31, "description": "Declaração Modelo 22 (IRC)"},
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
        dl_month = ob["deadline_month"]
        dl_day = int(ob["deadline_day"])  # type: ignore[call-overload]
        ob_id = str(ob["id"])
        if dl_month is None:
            # Monthly — generate for next 3 months
            for offset in range(3):
                m = (today.month + offset - 1) % 12 + 1
                y = target_year + ((today.month + offset - 1) // 12)
                deadline = datetime.date(y, m, min(dl_day, 28))
                days_left = (deadline - today).days
                result.append({
                    **ob,
                    "id": f"{ob_id}_{y}_{m:02d}",
                    "deadline": deadline.isoformat(),
                    "days_left": days_left,
                    "status": "overdue" if days_left < 0 else "urgent" if days_left <= 7 else "upcoming" if days_left <= 30 else "future",
                })
        else:
            dl_month_int = int(dl_month)  # type: ignore[call-overload]
            dl_year = target_year if dl_month_int >= 3 else target_year + 1
            try:
                deadline = datetime.date(dl_year, dl_month_int, dl_day)
            except ValueError:
                deadline = datetime.date(dl_year, dl_month_int, 28)
            days_left = (deadline - today).days
            result.append({
                **ob,
                "deadline": deadline.isoformat(),
                "days_left": days_left,
                "status": "overdue" if days_left < 0 else "urgent" if days_left <= 7 else "upcoming" if days_left <= 30 else "future",
            })
    result.sort(key=lambda x: str(x.get("deadline", "")))
    return result


# --- Reports ---

@router.get("/reports/pl")
async def report_pl(year: int | None = None, auth: AuthInfo = Depends(require_auth)):
    """Monthly P&L: revenues vs expenses, net result."""
    tid = auth.tenant_id
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
        receitas = round(float(r["receitas"] or 0), 2)
        gastos = round(float(r["gastos"] or 0), 2)
        data.append({
            "month": r["month"],
            "month_label": months_pt[mm],
            "receitas": receitas,
            "iva_cobrado": round(float(r["iva_cobrado"] or 0), 2),
            "gastos": gastos,
            "iva_dedutivel": round(float(r["iva_dedutivel"] or 0), 2),
            "resultado": round(receitas - gastos, 2),
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
    tid = auth.tenant_id
    with get_conn() as conn:
        rows = conn.execute(
            """
            SELECT d.supplier_nif,
                   s.name AS supplier_name,
                   COUNT(*) as doc_count,
                   SUM(d.total) as total_spend,
                   SUM(d.vat) as total_vat,
                   MAX(d.date) as last_date
            FROM documents d
            LEFT JOIN suppliers s ON s.nif = d.supplier_nif AND s.tenant_id = d.tenant_id
            WHERE d.tenant_id = %s
              AND d.type IN ('fatura-fornecedor', 'recibo')
              AND d.status != 'arquivado'
            GROUP BY d.supplier_nif, s.name
            ORDER BY total_spend DESC
            LIMIT %s
            """,
            (tid, limit),
        ).fetchall()
    return [
        {
            "supplier_nif": r["supplier_nif"],
            "supplier_name": r["supplier_name"] or r["supplier_nif"],
            "doc_count": r["doc_count"],
            "total_spend": round(float(r["total_spend"] or 0), 2),
            "total_vat": round(float(r["total_vat"] or 0), 2),
            "last_date": r["last_date"].isoformat() if r["last_date"] else None,
        }
        for r in rows
    ]


# --- Price History ---

@router.post("/price-history")
@limiter.limit(EXPENSIVE_RATE)
async def add_price_point(request: Request, body: PricePointCreate, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    price_dec = body.price
    with get_conn() as conn:
        # Verify ingredient and supplier belong to tenant
        if not conn.execute("SELECT id FROM ingredients WHERE id = %s AND tenant_id = %s", (body.ingredient_id, tid)).fetchone():
            raise HTTPException(status_code=404, detail="ingredient not found")
        if not conn.execute("SELECT id FROM suppliers WHERE id = %s AND tenant_id = %s", (body.supplier_id, tid)).fetchone():
            raise HTTPException(status_code=404, detail="supplier not found")
        row = conn.execute(
            """INSERT INTO price_history (tenant_id, ingredient_id, supplier_id, price, date)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, ingredient_id, supplier_id, price, date""",
            (tid, body.ingredient_id, body.supplier_id, price_dec,
             body.date or datetime.date.today().isoformat()),
        ).fetchone()
        # Update ingredient avg_cost (tenant-scoped)
        avg = conn.execute(
            "SELECT AVG(price) as avg_price FROM price_history WHERE ingredient_id = %s AND tenant_id = %s",
            (body.ingredient_id, tid),
        ).fetchone()
        if avg and avg["avg_price"]:
            conn.execute(
                "UPDATE ingredients SET avg_cost = %s, last_cost = %s WHERE id = %s",
                (avg["avg_price"], price_dec, body.ingredient_id),
            )
        log_activity(conn, tid, "price_history", row["id"], "created", f"ing={body.ingredient_id} sup={body.supplier_id}")
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
    field: str | None = None
    operator: str | None = None
    value: str | None = None
    account: str | None = None
    label: str | None = None
    priority: int | None = None
    active: bool | None = None


VALID_FIELDS = {"supplier_nif", "description", "amount_gte", "amount_lte", "type"}
VALID_OPERATORS = {"equals", "not_equals", "contains", "not_contains", "starts_with", "regex", "gte", "lte"}


@router.get("/classification-rules", response_model=list[ClassificationRuleOut])
async def list_classification_rules(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
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
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO classification_rules (tenant_id, field, operator, value, account, label, priority, active)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, field, operator, value, account, label, priority, active""",
            (tid, body.field, body.operator, body.value, body.account, body.label, body.priority, body.active),
        ).fetchone()
        log_activity(conn, tid, "classification_rule", row["id"], "created", f"{body.field} {body.operator}")
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
    tid = auth.tenant_id
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
        if row:
            log_activity(conn, tid, "classification_rule", rule_id, "updated", str(list(updates.keys())))
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="rule not found")
    return row


@router.delete("/classification-rules/{rule_id}", status_code=204)
async def delete_classification_rule(rule_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute(
            "DELETE FROM classification_rules WHERE id = %s AND tenant_id = %s RETURNING id",
            (rule_id, tid),
        ).fetchone()
        if row:
            log_activity(conn, tid, "classification_rule", rule_id, "deleted")
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
    tid = auth.tenant_id
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
@limiter.limit(EXPENSIVE_RATE)
async def assistant_chat(request: Request, body: ChatRequest, auth: AuthInfo = Depends(require_auth)):
    """Answer a natural-language accounting question using live DB data."""
    question = body.question.strip()
    if not question:
        raise HTTPException(status_code=422, detail="question is required")
    if len(question) > 500:
        raise HTTPException(status_code=422, detail="question too long (max 500 chars)")
    tid = auth.tenant_id
    result = _answer_question(question, tid)
    return {
        "question": question,
        "intent": result["intent"],
        "answer": result["answer"],
    }


# ── Admin / Monitoring ─────────────────────────────────────────────────
# Restricted to MASTER_USER_IDS (set in env) OR ADMIN_TOKEN header.

_MASTER_USER_IDS = {uid.strip().lower() for uid in os.environ.get("MASTER_USER_IDS", "").split(",") if uid.strip()}
_ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")


def _is_admin_user(auth: AuthInfo) -> bool:
    """Check if user is in MASTER_USER_IDS (by user_id, JWT email, or Clerk API email)."""
    if auth.user_id.lower() in _MASTER_USER_IDS:
        return True
    if auth.email and auth.email.lower() in _MASTER_USER_IDS:
        return True
    from app.billing import _fetch_clerk_email
    email = _fetch_clerk_email(auth.user_id)
    return bool(email and email.lower() in _MASTER_USER_IDS)


def _require_admin(auth: AuthInfo = Depends(require_auth)) -> AuthInfo:
    """Only allow MASTER_USER_IDS to access admin endpoints."""
    if not _is_admin_user(auth):
        raise HTTPException(status_code=403, detail="Admin access required")
    return auth


def _require_admin_or_token(request: Request, auth: AuthInfo | None = Depends(optional_auth)) -> AuthInfo | None:
    """Allow MASTER_USER_IDS (via Clerk JWT) or X-Admin-Token header."""
    # Check token first (standalone dashboard)
    token = request.headers.get("x-admin-token", "")
    if _ADMIN_TOKEN and token and token == _ADMIN_TOKEN:
        return None  # token auth — no AuthInfo needed
    # Fall back to Clerk auth
    if auth and _is_admin_user(auth):
        return auth
    # Dev/test mode: AUTH_DISABLED gives dev-user which should be in MASTER_USER_IDS
    if AUTH_DISABLED and not auth:
        dev_auth = AuthInfo(user_id="dev-user", tenant_id="dev-tenant", email="dev@tim.pt", session_id=None)
        if dev_auth.user_id.lower() in _MASTER_USER_IDS:
            return dev_auth
    raise HTTPException(status_code=403, detail="Admin access required")


@router.get("/admin/tenants")
async def admin_tenants(auth: AuthInfo | None = Depends(_require_admin_or_token)):
    """List all tenants with billing status, doc counts, last activity."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT
                tp.tenant_id,
                tp.plan,
                tp.status,
                tp.trial_start,
                tp.trial_end,
                tp.stripe_customer,
                tp.updated_at,
                COALESCE(d.doc_count, 0)  AS doc_count,
                COALESCE(d.doc_total, 0)  AS doc_total,
                COALESCE(bt.tx_count, 0)  AS tx_count,
                COALESCE(r.recon_count, 0) AS recon_count,
                al.last_activity
            FROM tenant_plans tp
            LEFT JOIN LATERAL (
                SELECT count(*) AS doc_count, COALESCE(sum(total), 0) AS doc_total
                FROM documents WHERE tenant_id = tp.tenant_id
            ) d ON true
            LEFT JOIN LATERAL (
                SELECT count(*) AS tx_count
                FROM bank_transactions WHERE tenant_id = tp.tenant_id
            ) bt ON true
            LEFT JOIN LATERAL (
                SELECT count(*) AS recon_count
                FROM reconciliations WHERE tenant_id = tp.tenant_id
            ) r ON true
            LEFT JOIN LATERAL (
                SELECT max(created_at) AS last_activity
                FROM audit_log WHERE tenant_id = tp.tenant_id
            ) al ON true
            ORDER BY al.last_activity DESC NULLS LAST
        """).fetchall()
        return [dict(row) for row in rows]


@router.get("/admin/system-health")
async def admin_system_health(auth: AuthInfo | None = Depends(_require_admin_or_token)):
    """Check health of DB, Redis, and Paperless."""
    import time as _time
    health: dict = {"status": "ok", "services": {}}

    # PostgreSQL
    try:
        t0 = _time.monotonic()
        with get_conn() as conn:
            conn.execute("SELECT 1").fetchone()
        health["services"]["postgresql"] = {"status": "ok", "latency_ms": round((_time.monotonic() - t0) * 1000, 1)}
    except Exception as e:
        health["services"]["postgresql"] = {"status": "error", "detail": str(e)}
        health["status"] = "degraded"

    # Redis
    try:
        t0 = _time.monotonic()
        from app.cache import _get_redis
        r = _get_redis()
        if r:
            r.ping()
            health["services"]["redis"] = {"status": "ok", "latency_ms": round((_time.monotonic() - t0) * 1000, 1)}
        else:
            health["services"]["redis"] = {"status": "unavailable", "detail": "not connected"}
    except Exception as e:
        health["services"]["redis"] = {"status": "error", "detail": str(e)}

    # Paperless
    try:
        t0 = _time.monotonic()
        async with httpx.AsyncClient(timeout=5) as client:
            resp = await client.get(
                f"{PAPERLESS_URL}/api/",
                headers={"Authorization": f"Token {PAPERLESS_TOKEN}"} if PAPERLESS_TOKEN else {},
            )
        health["services"]["paperless"] = {
            "status": "ok" if resp.status_code < 400 else "error",
            "status_code": resp.status_code,
            "latency_ms": round((_time.monotonic() - t0) * 1000, 1),
        }
    except Exception as e:
        health["services"]["paperless"] = {"status": "error", "detail": str(e)}

    if any(s.get("status") == "error" for s in health["services"].values()):
        health["status"] = "degraded"

    return health


@router.get("/admin/metrics")
async def admin_metrics(auth: AuthInfo | None = Depends(_require_admin_or_token)):
    """System-wide metrics for admin dashboard."""
    with get_conn() as conn:
        row = conn.execute("""
            SELECT
                (SELECT count(*) FROM tenant_plans) AS total_tenants,
                (SELECT count(*) FROM tenant_plans WHERE plan = 'pro' AND status = 'active') AS pro_tenants,
                (SELECT count(*) FROM tenant_plans WHERE status = 'trialing') AS trialing_tenants,
                (SELECT count(*) FROM tenant_plans WHERE status = 'trial_expired') AS expired_tenants,
                (SELECT count(*) FROM tenant_plans WHERE status = 'cancelled') AS cancelled_tenants,
                (SELECT count(*) FROM tenant_plans WHERE status = 'past_due') AS past_due_tenants,
                (SELECT count(*) FROM documents) AS total_documents,
                (SELECT count(*) FROM bank_transactions) AS total_transactions,
                (SELECT count(*) FROM reconciliations) AS total_reconciliations,
                (SELECT count(*) FROM documents WHERE created_at >= now() - interval '30 days') AS docs_last_30d,
                (SELECT count(*) FROM documents WHERE created_at >= now() - interval '7 days') AS docs_last_7d,
                (SELECT count(*) FROM bank_transactions WHERE created_at >= now() - interval '30 days') AS txs_last_30d,
                (SELECT COALESCE(sum(total), 0) FROM documents) AS total_document_value,
                (SELECT count(*) FROM alerts WHERE read = false) AS unread_alerts_global
        """).fetchone()
        return dict(row)


# ── Admin: revenue metrics ─────────────────────────────────────────────

@router.get("/admin/revenue")
async def admin_revenue(auth: AuthInfo | None = Depends(_require_admin_or_token)):
    """Revenue metrics: MRR, trial conversion, churn indicators."""
    with get_conn() as conn:
        plans = conn.execute(
            "SELECT plan, status, trial_start, trial_end, stripe_customer FROM tenant_plans"
        ).fetchall()

    pro_active = [p for p in plans if p["plan"] == "pro" and p["status"] == "active"]
    trialing = [p for p in plans if p["status"] == "trialing"]
    expired = [p for p in plans if p["status"] == "trial_expired"]
    cancelled = [p for p in plans if p["status"] == "cancelled"]
    past_due = [p for p in plans if p["status"] == "past_due"]

    mrr = len(pro_active) * 150
    arr = mrr * 12

    converted = len([p for p in pro_active if p.get("trial_start")])
    total_ever_trialed = converted + len(expired) + len(cancelled)
    trial_conversion = round(converted / total_ever_trialed, 4) if total_ever_trialed else 0

    return {
        "mrr_eur": mrr,
        "arr_eur": arr,
        "pro_active": len(pro_active),
        "trialing": len(trialing),
        "trial_expired": len(expired),
        "cancelled": len(cancelled),
        "past_due": len(past_due),
        "at_risk_arr_eur": len(past_due) * 150 * 12,
        "trial_conversion_rate": trial_conversion,
        "total_tenants": len(plans),
    }


# ── Admin: endpoint performance ────────────────────────────────────────

@router.get("/admin/endpoints")
async def admin_endpoints(
    window: int = 300,
    auth: AuthInfo | None = Depends(_require_admin_or_token),
):
    """Per-endpoint latency and error rates from in-memory metrics."""
    from app.monitoring import metrics
    return {
        "window_seconds": window,
        "endpoints": metrics.get_endpoint_stats(window),
        "summary": metrics.get_global_summary(window),
    }


# ── Admin: error log ──────────────────────────────────────────────────

@router.get("/admin/errors")
async def admin_errors(
    limit: int = 100,
    auth: AuthInfo | None = Depends(_require_admin_or_token),
):
    """Recent 5xx errors from in-memory ring buffer."""
    from app.monitoring import metrics
    return metrics.get_error_log(limit)


# ── Admin: tenant activity (live) ─────────────────────────────────────

@router.get("/admin/tenant-activity")
async def admin_tenant_activity(auth: AuthInfo | None = Depends(_require_admin_or_token)):
    """Per-tenant request counts and last-seen timestamps from current process."""
    from app.monitoring import metrics
    return metrics.get_tenant_activity()


# ── Admin: churn risk ─────────────────────────────────────────────────

@router.get("/admin/churn-risk")
async def admin_churn_risk(auth: AuthInfo | None = Depends(_require_admin_or_token)):
    """Tenants at risk of churning — inactive >7d, past_due, trial expiring soon."""
    now = datetime.datetime.now(datetime.UTC)
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT
                tp.tenant_id, tp.plan, tp.status, tp.trial_end, tp.stripe_customer,
                (SELECT max(created_at) FROM audit_log WHERE tenant_id = tp.tenant_id) AS last_activity,
                (SELECT count(*) FROM documents WHERE tenant_id = tp.tenant_id) AS doc_count
            FROM tenant_plans tp
            WHERE tp.status IN ('active', 'trialing', 'past_due')
            ORDER BY last_activity ASC NULLS FIRST
        """).fetchall()

    at_risk = []
    for r in rows:
        reasons: list[str] = []
        row = dict(r)

        if row["status"] == "past_due":
            reasons.append("payment_failed")

        last = row.get("last_activity")
        if last and (now - last).days > 7:
            reasons.append(f"inactive_{(now - last).days}d")
        elif not last:
            reasons.append("never_active")

        if row["status"] == "trialing" and row.get("trial_end"):
            days_left = (row["trial_end"] - now).days
            if days_left <= 3:
                reasons.append(f"trial_expires_{days_left}d")

        if row["doc_count"] == 0:
            reasons.append("zero_documents")

        if reasons:
            row["risk_reasons"] = reasons
            row["risk_score"] = len(reasons)
            at_risk.append(row)

    at_risk.sort(key=lambda x: x["risk_score"], reverse=True)
    return at_risk


# ── Standalone Monitoring Dashboard ───────────────────────────────────

@router.get("/monitoring")
async def monitoring_dashboard():
    """Serve standalone monitoring dashboard HTML (auth via token inside)."""
    import pathlib
    html_path = pathlib.Path(__file__).parent / "monitoring_dashboard.html"
    if not html_path.exists():
        raise HTTPException(status_code=404, detail="dashboard not found")
    return FileResponse(str(html_path), media_type="text/html")
