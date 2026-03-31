import datetime
import logging
import os
import pathlib

import httpx
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.assistant import answer_question as _answer_question
from app.auth import AUTH_DISABLED, AuthInfo, optional_auth, require_auth
from app.db import get_conn
from app.limiter import EXPENSIVE_RATE, limiter

logger = logging.getLogger(__name__)

PAPERLESS_URL = os.environ.get("PAPERLESS_URL", "http://paperless:8000")
PAPERLESS_TOKEN = os.environ.get("PAPERLESS_TOKEN", "")

_MASTER_USER_IDS = {uid.strip().lower() for uid in os.environ.get("MASTER_USER_IDS", "").split(",") if uid.strip()}
_ADMIN_TOKEN = os.environ.get("ADMIN_TOKEN", "")


# ── Models ────────────────────────────────────────────────────────────

class ActivityEntry(BaseModel):
    id: int
    entity_type: str
    entity_id: int | None
    action: str
    detail: str
    created_at: datetime.datetime


class ChatRequest(BaseModel):
    question: str


# ── Helpers ───────────────────────────────────────────────────────────

def _is_admin_user(auth: AuthInfo) -> bool:
    if auth.user_id.lower() in _MASTER_USER_IDS:
        return True
    if auth.email and auth.email.lower() in _MASTER_USER_IDS:
        return True
    from app.billing import _fetch_clerk_email
    email = _fetch_clerk_email(auth.user_id)
    return bool(email and email.lower() in _MASTER_USER_IDS)


def _require_admin(auth: AuthInfo = Depends(require_auth)) -> AuthInfo:
    if not _is_admin_user(auth):
        raise HTTPException(status_code=403, detail="Admin access required")
    return auth


def _require_admin_or_token(request: Request, auth: AuthInfo | None = Depends(optional_auth)) -> AuthInfo | None:
    token = request.headers.get("x-admin-token", "")
    if _ADMIN_TOKEN and token and token == _ADMIN_TOKEN:
        return None
    if auth and _is_admin_user(auth):
        return auth
    if AUTH_DISABLED and not auth:
        dev_auth = AuthInfo(user_id="dev-user", tenant_id="dev-tenant", email="dev@tim.pt", session_id=None)
        if dev_auth.user_id.lower() in _MASTER_USER_IDS:
            return dev_auth
    raise HTTPException(status_code=403, detail="Admin access required")


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


router = APIRouter()


# --- Activity Log ---

@router.get("/activity", response_model=list[ActivityEntry])
async def list_activity(
    limit: int = Query(50, ge=1, le=200),
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, entity_type, entity_id, action, detail, created_at FROM audit_log WHERE tenant_id = %s ORDER BY created_at DESC LIMIT %s",
            (tid, limit),
        ).fetchall()
    return rows


# --- AI Assistant ---

@router.get("/assistant/prompts")
async def assistant_prompts(_auth: AuthInfo = Depends(require_auth)):
    return _QUICK_PROMPTS


@router.post("/assistant/chat")
@limiter.limit(EXPENSIVE_RATE)
async def assistant_chat(request: Request, body: ChatRequest, auth: AuthInfo = Depends(require_auth)):
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


# --- Admin ---

@router.get("/admin/tenants")
async def admin_tenants(auth: AuthInfo | None = Depends(_require_admin_or_token)):
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
    import time as _time
    health: dict = {"status": "ok", "services": {}}

    try:
        t0 = _time.monotonic()
        with get_conn() as conn:
            conn.execute("SELECT 1").fetchone()
        health["services"]["postgresql"] = {"status": "ok", "latency_ms": round((_time.monotonic() - t0) * 1000, 1)}
    except Exception as e:
        health["services"]["postgresql"] = {"status": "error", "detail": str(e)}
        health["status"] = "degraded"

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


@router.get("/admin/revenue")
async def admin_revenue(auth: AuthInfo | None = Depends(_require_admin_or_token)):
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


@router.get("/admin/endpoints")
async def admin_endpoints(
    window: int = 300,
    auth: AuthInfo | None = Depends(_require_admin_or_token),
):
    from app.monitoring import metrics
    return {
        "window_seconds": window,
        "endpoints": metrics.get_endpoint_stats(window),
        "summary": metrics.get_global_summary(window),
    }


@router.get("/admin/errors")
async def admin_errors(
    limit: int = 100,
    auth: AuthInfo | None = Depends(_require_admin_or_token),
):
    from app.monitoring import metrics
    return metrics.get_error_log(limit)


@router.get("/admin/tenant-activity")
async def admin_tenant_activity(auth: AuthInfo | None = Depends(_require_admin_or_token)):
    from app.monitoring import metrics
    return metrics.get_tenant_activity()


@router.get("/admin/churn-risk")
async def admin_churn_risk(auth: AuthInfo | None = Depends(_require_admin_or_token)):
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


# --- Monitoring Dashboard ---

@router.get("/monitoring")
async def monitoring_dashboard():
    html_path = pathlib.Path(__file__).parent / "monitoring_dashboard.html"
    if not html_path.exists():
        raise HTTPException(status_code=404, detail="dashboard not found")
    return FileResponse(str(html_path), media_type="text/html")
