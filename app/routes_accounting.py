"""Accounting API routes — Chart of Accounts, Journal Entries, Reports."""

import datetime
import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel

from app.accounting import (
    balance_sheet,
    close_fiscal_period,
    create_account,
    create_fiscal_period,
    create_journal_entry,
    general_ledger,
    get_journal_entry,
    iva_declaration,
    list_accounts,
    list_fiscal_periods,
    list_journal_entries,
    list_journals,
    patch_account,
    profit_loss,
    seed_chart_of_accounts,
    seed_journals,
    trial_balance,
)
from app.auth import AuthInfo, require_auth
from app.db import get_conn, log_activity

logger = logging.getLogger(__name__)

router = APIRouter()


class AccountCreate(BaseModel):
    code: str
    name: str
    type: str
    parent_code: str = ""


class AccountPatch(BaseModel):
    name: str | None = None
    active: bool | None = None


class FiscalPeriodCreate(BaseModel):
    name: str
    start_date: str
    end_date: str


class JournalEntryLineIn(BaseModel):
    account_code: str
    debit: str = "0"
    credit: str = "0"
    description: str = ""


class JournalEntryCreate(BaseModel):
    journal_id: int
    entry_date: str
    lines: list[JournalEntryLineIn]
    reference: str = ""
    description: str = ""
    period_id: int | None = None


class GenerateEntryBody(BaseModel):
    journal_id: int


@router.post("/accounting/seed")
def api_seed_accounting(auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        accts = seed_chart_of_accounts(auth.tenant_id, conn)
        jnls = seed_journals(auth.tenant_id, conn)
        log_activity(conn, auth.tenant_id, "accounting", None, "seed", f"accounts={accts}, journals={jnls}")
        conn.commit()
    return {"accounts_seeded": accts, "journals_seeded": jnls}


@router.get("/accounts")
def api_list_accounts(
    type: str | None = None,
    active_only: bool = True,
    auth: AuthInfo = Depends(require_auth),
):
    with get_conn() as conn:
        rows = list_accounts(auth.tenant_id, conn, account_type=type, active_only=active_only)
    return [dict(r) for r in rows]


@router.post("/accounts")
def api_create_account(body: AccountCreate, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        try:
            acct = create_account(auth.tenant_id, conn, body.code, body.name, body.type, body.parent_code)
        except Exception as exc:
            if "unique" in str(exc).lower() or "duplicate" in str(exc).lower():
                raise HTTPException(status_code=409, detail="Account code already exists") from None
            raise
        log_activity(conn, auth.tenant_id, "account", acct["id"], "create", body.code)
        conn.commit()
    return acct


@router.patch("/accounts/{account_id}")
def api_patch_account(account_id: int, body: AccountPatch, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        try:
            acct = patch_account(auth.tenant_id, conn, account_id, name=body.name, active=body.active)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from None
        log_activity(conn, auth.tenant_id, "account", account_id, "update", "")
        conn.commit()
    return acct


@router.get("/fiscal-periods")
def api_list_fiscal_periods(auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        rows = list_fiscal_periods(auth.tenant_id, conn)
    return [dict(r) for r in rows]


@router.post("/fiscal-periods")
def api_create_fiscal_period(body: FiscalPeriodCreate, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        period = create_fiscal_period(auth.tenant_id, conn, body.name, body.start_date, body.end_date)
        log_activity(conn, auth.tenant_id, "fiscal_period", period["id"], "create", body.name)
        conn.commit()
    return period


@router.post("/fiscal-periods/{period_id}/close")
def api_close_fiscal_period(period_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        try:
            period = close_fiscal_period(auth.tenant_id, conn, period_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        log_activity(conn, auth.tenant_id, "fiscal_period", period_id, "close", "")
        conn.commit()
    return period


@router.get("/accounting-journals")
def api_list_journals(auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        rows = list_journals(auth.tenant_id, conn)
    return [dict(r) for r in rows]


@router.get("/journal-entries")
def api_list_journal_entries(
    journal_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    with get_conn() as conn:
        rows = list_journal_entries(auth.tenant_id, conn, journal_id=journal_id, date_from=date_from, date_to=date_to, limit=limit, offset=offset)
    return [dict(r) for r in rows]


@router.get("/journal-entries/{entry_id}")
def api_get_journal_entry(entry_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        try:
            entry = get_journal_entry(auth.tenant_id, conn, entry_id)
        except ValueError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from None
    return entry


@router.post("/journal-entries")
def api_create_journal_entry(body: JournalEntryCreate, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        try:
            entry = create_journal_entry(
                auth.tenant_id, conn,
                journal_id=body.journal_id,
                entry_date=body.entry_date,
                lines=[ln.model_dump() for ln in body.lines],
                reference=body.reference,
                description=body.description,
                period_id=body.period_id,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        log_activity(conn, auth.tenant_id, "journal_entry", entry["id"], "create", body.reference)
        conn.commit()
    return entry


@router.post("/documents/{doc_id}/generate-entry")
def api_generate_entry_from_document(doc_id: int, body: GenerateEntryBody, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        doc = conn.execute(
            "SELECT id, total, vat, date, type, supplier_nif FROM documents WHERE id = %s AND tenant_id = %s",
            (doc_id, auth.tenant_id),
        ).fetchone()
        if not doc:
            raise HTTPException(status_code=404, detail="Document not found")

        total = Decimal(str(doc["total"] or 0))
        vat = Decimal(str(doc["vat"] or 0))
        base = total - vat
        entry_date = str(doc["date"]) if doc["date"] else datetime.date.today().isoformat()

        lines = []
        if vat > 0:
            lines.append({"account_code": "2412", "debit": str(vat), "credit": "0", "description": "IVA dedutivel"})
        if base > 0:
            lines.append({"account_code": "62", "debit": str(base), "credit": "0", "description": doc["type"]})
        if total > 0:
            lines.append({"account_code": "221", "debit": "0", "credit": str(total), "description": f"Fornecedor NIF {doc.get('supplier_nif', '')}"})

        if not lines:
            raise HTTPException(status_code=400, detail="Cannot generate entry: document has no amounts")

        try:
            entry = create_journal_entry(
                auth.tenant_id, conn,
                journal_id=body.journal_id, entry_date=entry_date, lines=lines,
                reference=f"DOC-{doc_id}", description=f"Documento #{doc_id}",
                source_type="document", source_id=doc_id,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        log_activity(conn, auth.tenant_id, "journal_entry", entry["id"], "generate", f"from document {doc_id}")
        conn.commit()
    return entry


@router.post("/bank-transactions/{tx_id}/generate-entry")
def api_generate_entry_from_bank_tx(tx_id: int, body: GenerateEntryBody, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        tx = conn.execute(
            "SELECT id, amount, date, description, category, snc_account FROM bank_transactions WHERE id = %s AND tenant_id = %s",
            (tx_id, auth.tenant_id),
        ).fetchone()
        if not tx:
            raise HTTPException(status_code=404, detail="Bank transaction not found")

        amount = Decimal(str(tx["amount"]))
        entry_date = str(tx["date"])
        snc = tx.get("snc_account") or "62"

        lines = []
        if amount > 0:
            lines.append({"account_code": "12", "debit": str(amount), "credit": "0", "description": "Recebimento"})
            lines.append({"account_code": snc, "debit": "0", "credit": str(amount), "description": tx["description"]})
        elif amount < 0:
            abs_amount = abs(amount)
            lines.append({"account_code": snc, "debit": str(abs_amount), "credit": "0", "description": tx["description"]})
            lines.append({"account_code": "12", "debit": "0", "credit": str(abs_amount), "description": "Pagamento"})
        else:
            raise HTTPException(status_code=400, detail="Cannot generate entry: zero amount")

        try:
            entry = create_journal_entry(
                auth.tenant_id, conn,
                journal_id=body.journal_id, entry_date=entry_date, lines=lines,
                reference=f"TX-{tx_id}", description=tx["description"],
                source_type="bank_transaction", source_id=tx_id,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from None
        log_activity(conn, auth.tenant_id, "journal_entry", entry["id"], "generate", f"from transaction {tx_id}")
        conn.commit()
    return entry


@router.get("/reports/trial-balance")
def api_trial_balance(date_from: str | None = None, date_to: str | None = None, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        return trial_balance(auth.tenant_id, conn, date_from=date_from, date_to=date_to)


@router.get("/reports/general-ledger/{account_code}")
def api_general_ledger(account_code: str, date_from: str | None = None, date_to: str | None = None, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        return general_ledger(auth.tenant_id, conn, account_code, date_from=date_from, date_to=date_to)


@router.get("/reports/balance-sheet")
def api_balance_sheet(as_of: str | None = None, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        return balance_sheet(auth.tenant_id, conn, as_of=as_of)


@router.get("/reports/profit-loss")
def api_profit_loss(year: int | None = None, date_from: str | None = None, date_to: str | None = None, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        return profit_loss(auth.tenant_id, conn, year=year, date_from=date_from, date_to=date_to)


@router.get("/reports/iva-declaration")
def api_iva_declaration(year: int = Query(...), quarter: int | None = None, month: int | None = None, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        return iva_declaration(auth.tenant_id, conn, year=year, quarter=quarter, month=month)
