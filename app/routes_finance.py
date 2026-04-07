import csv
import datetime
import io
import json as _json
import logging
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, ConfigDict

from app.auth import AuthInfo, require_auth
from app.cache import cache_get, cache_set
from app.db import get_conn, log_activity
from app.limiter import EXPENSIVE_RATE, limiter

logger = logging.getLogger(__name__)


# ── Models ────────────────────────────────────────────────────────────

class EntityProfileBody(BaseModel):
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


class AlertOut(BaseModel):
    id: int
    type: str
    severity: str
    title: str
    description: str
    action_url: str | None = None
    read: bool
    created_at: datetime.datetime | None = None


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


VALID_ASSET_CATEGORIES = {"equipamento", "mobiliário", "veículo", "imóvel", "informático", "intangível"}
VALID_DEPRECIATION_METHODS = {"linha-reta", "quotas-decrescentes", "não-definido"}
VALID_ASSET_STATUSES = {"ativo", "abatido", "vendido"}
VALID_FIELDS = {"supplier_nif", "description", "amount_gte", "amount_lte", "type"}
VALID_OPERATORS = {"equals", "not_equals", "contains", "not_contains", "starts_with", "regex", "gte", "lte"}

ENTITY_FIELDS = [
    "legal_name", "nif", "cae", "cae_description", "entity_category",
    "accounting_regime", "vat_regime", "reporting_frequency", "employees",
    "turnover_range", "balance_sheet_range", "accountant_name",
    "accountant_email", "accountant_nif", "fiscal_rep_name", "fiscal_rep_nif",
    "address", "postal_code", "city",
]

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


router = APIRouter()


# --- Alerts ---

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
    from app.alerts import generate_compliance_alerts
    tid = auth.tenant_id
    count = generate_compliance_alerts(tid)
    return {"generated": count}


# --- Assets ---

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


# --- CSV Exports ---

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


# --- Onboarding Status ---

@router.get("/users/me/onboarding")
async def get_onboarding(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute(
            "SELECT data FROM tenant_settings WHERE tenant_id = %s AND key = 'onboarding'",
            (tid,),
        ).fetchone()
    if row:
        return row["data"]
    return {"onboarding_completed": False}


@router.put("/users/me/onboarding")
async def put_onboarding(request: Request, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    body = await request.json()
    data_json = _json.dumps(body)
    with get_conn() as conn:
        conn.execute(
            """INSERT INTO tenant_settings (tenant_id, key, data) VALUES (%s, 'onboarding', %s)
               ON CONFLICT (tenant_id, key) DO UPDATE SET data = %s, updated_at = now()""",
            (tid, data_json, data_json),
        )
        conn.commit()
    return body


# --- Tax Center ---

@router.get("/tax/iva-periods")
async def tax_iva_periods(auth: AuthInfo = Depends(require_auth)):
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
    tid = auth.tenant_id
    with get_conn() as conn:
        zero_vat = conn.execute(
            """SELECT COUNT(*) as count FROM documents
               WHERE tenant_id = %s AND vat = 0 AND total > 100 AND type = 'fatura'""",
            (tid,),
        ).fetchone()
        round_amounts = conn.execute(
            """SELECT COUNT(*) as count FROM documents
               WHERE tenant_id = %s AND total > 0 AND MOD(total::numeric, 1000) = 0""",
            (tid,),
        ).fetchone()
        missing_nif = conn.execute(
            """SELECT COUNT(*) as count FROM documents
               WHERE tenant_id = %s AND (supplier_nif = '' OR supplier_nif = '000000000')""",
            (tid,),
        ).fetchone()
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

@router.get("/obligations")
async def list_obligations(year: int | None = None, _auth: AuthInfo = Depends(require_auth)):
    today = datetime.date.today()
    target_year = year or today.year
    result = []
    for ob in PT_OBLIGATIONS:
        dl_month = ob["deadline_month"]
        dl_day = int(ob["deadline_day"])  # type: ignore[call-overload]
        ob_id = str(ob["id"])
        if dl_month is None:
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


# --- Classification Rules ---

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
