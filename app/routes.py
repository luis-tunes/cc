import csv
import io
import os
from datetime import date
from decimal import Decimal
from typing import Optional
import httpx
from fastapi import APIRouter, Depends, HTTPException, UploadFile, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from app.auth import AuthInfo, optional_auth
from app.db import get_conn
from app.parse import ingest_document
from app.reconcile import reconcile_all

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
    date: date | None
    type: str
    filename: str | None = None
    raw_text: str | None = None
    status: str = "pendente"
    paperless_id: int | None = None
    created_at: str | None = None

class DocumentPatch(BaseModel):
    status: Optional[str] = None
    type: Optional[str] = None
    supplier_nif: Optional[str] = None
    client_nif: Optional[str] = None
    total: Optional[Decimal] = None
    vat: Optional[Decimal] = None
    date: Optional[date] = None
    filename: Optional[str] = None

class BankTransactionOut(BaseModel):
    id: int
    date: date
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

@router.post("/documents/upload")
async def upload_document(file: UploadFile, auth: AuthInfo | None = Depends(optional_auth)):
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=422, detail="only PDF files accepted")
    content = await file.read()

    tid = auth.tenant_id if auth else None
    # Save a record immediately so frontend sees it
    with get_conn() as conn:
        row = conn.execute(
            "INSERT INTO documents (supplier_nif, client_nif, total, vat, type, filename, status, tenant_id) VALUES ('','',0,0,'outro',%s,'a processar',%s) RETURNING id",
            (file.filename, tid),
        ).fetchone()
        conn.commit()
        local_id = row["id"]

    # Forward to Paperless for OCR
    headers = {"Authorization": f"Token {PAPERLESS_TOKEN}"}
    r = httpx.post(
        f"{PAPERLESS_URL}/api/documents/post_document/",
        headers=headers,
        files={"document": (file.filename, content, "application/pdf")},
        timeout=60,
    )
    if r.status_code not in (200, 202):
        # Mark as failed but keep the record
        with get_conn() as conn:
            conn.execute("UPDATE documents SET status = 'erro' WHERE id = %s", (local_id,))
            conn.commit()
        raise HTTPException(status_code=502, detail=f"paperless rejected: {r.text}")
    return {"status": "accepted", "filename": file.filename, "id": local_id}

# --- Documents ---

@router.get("/documents", response_model=list[DocumentOut])
async def list_documents(
    supplier_nif: str | None = None,
    date_from: date | None = None,
    date_to: date | None = None,
    status: str | None = None,
    search: str | None = None,
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    auth: AuthInfo | None = Depends(optional_auth),
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
            f"SELECT id, supplier_nif, client_nif, total, vat, date, type, filename, raw_text, status, paperless_id, created_at FROM documents {where} ORDER BY created_at DESC LIMIT %s OFFSET %s",
            params,
        ).fetchall()
    return rows

@router.get("/documents/{doc_id}", response_model=DocumentOut)
async def get_document(doc_id: int, auth: AuthInfo | None = Depends(optional_auth)):
    clauses = ["id = %s"]
    params: list = [doc_id]
    _tenant_clause(auth, clauses, params)
    where = "WHERE " + " AND ".join(clauses)
    with get_conn() as conn:
        row = conn.execute(
            f"SELECT id, supplier_nif, client_nif, total, vat, date, type, filename, raw_text, status, paperless_id, created_at FROM documents {where}",
            params,
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")
    return row

@router.patch("/documents/{doc_id}", response_model=DocumentOut)
async def update_document(doc_id: int, patch: DocumentPatch, auth: AuthInfo | None = Depends(optional_auth)):
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
            f"UPDATE documents SET {', '.join(set_parts)} WHERE {where} RETURNING id, supplier_nif, client_nif, total, vat, date, type, filename, raw_text, status, paperless_id, created_at",
            params,
        ).fetchone()
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="document not found")
    return row

# --- Bank Transactions ---

@router.post("/bank-transactions/upload")
async def upload_bank_csv(file: UploadFile, auth: AuthInfo | None = Depends(optional_auth)):
    content = await file.read()
    text = content.decode("utf-8-sig")
    reader = csv.DictReader(io.StringIO(text), delimiter=";")
    if not reader.fieldnames or not {"date", "description", "amount"}.issubset(set(reader.fieldnames)):
        raise HTTPException(status_code=422, detail="CSV must have columns: date, description, amount")
    tid = auth.tenant_id if auth else None
    count = 0
    with get_conn() as conn:
        for row in reader:
            tx_date = date.fromisoformat(row["date"].strip())
            description = row["description"].strip()
            amount = Decimal(row["amount"].strip().replace(",", "."))
            conn.execute(
                "INSERT INTO bank_transactions (date, description, amount, tenant_id) VALUES (%s, %s, %s, %s)",
                (tx_date, description, amount, tid),
            )
            count += 1
        conn.commit()
    return {"imported": count}

@router.get("/bank-transactions", response_model=list[BankTransactionOut])
async def list_bank_transactions(
    date_from: date | None = None,
    date_to: date | None = None,
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    auth: AuthInfo | None = Depends(optional_auth),
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
async def run_reconciliation(auth: AuthInfo | None = Depends(optional_auth)):
    tid = auth.tenant_id if auth else None
    matches = reconcile_all(tid)
    return {"matched": len(matches), "matches": matches}

@router.get("/reconciliations")
async def list_reconciliations(
    limit: int = Query(default=100, le=1000),
    offset: int = 0,
    auth: AuthInfo | None = Depends(optional_auth),
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
                      d.supplier_nif, d.total, d.date as doc_date,
                      b.description, b.amount, b.date as tx_date
               FROM reconciliations r
               JOIN documents d ON d.id = r.document_id
               JOIN bank_transactions b ON b.id = r.bank_transaction_id
               {where}
               ORDER BY r.created_at DESC LIMIT %s OFFSET %s""",
            params,
        ).fetchall()
    return rows

# --- Dashboard ---

@router.get("/dashboard/summary")
async def dashboard_summary(auth: AuthInfo | None = Depends(optional_auth)):
    tf = ""
    tp: list = []
    if auth and auth.tenant_id:
        tf = " WHERE tenant_id = %s"
        tp = [auth.tenant_id]
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
    return {
        "documents": {"count": docs["count"], "total": str(docs["total"])},
        "bank_transactions": {"count": txs["count"], "total": str(txs["total"])},
        "reconciliations": recs["count"],
        "unmatched_documents": unmatched["count"],
        "pending_review": pending["count"],
        "classified": classified["count"],
    }

@router.get("/dashboard/monthly")
async def monthly_summary(auth: AuthInfo | None = Depends(optional_auth)):
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
async def export_csv(auth: AuthInfo | None = Depends(optional_auth)):
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
