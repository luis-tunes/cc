"""
Stripe billing — checkout sessions, webhooks, plan status.
Clerk handles auth; Stripe handles money. They connect via metadata.

Plans:
  pro    — 150€ + IVA/mês, documentos ilimitados, 5 utilizadores
  custom — empresa, SLA + garantia, preço personalizado (contacte-nos)
"""

import hashlib
import hmac
import json
import os
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import AuthInfo, optional_auth, require_auth
from app.db import get_conn

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_API = "https://api.stripe.com/v1"
APP_URL = os.environ.get("APP_URL", "http://localhost:3000")
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "info@xtim.ai")

TRIAL_DAYS = int(os.environ.get("TRIAL_DAYS", "14"))

PLANS = [
    {"id": "pro", "name": "Profissional", "price": 15000, "docs_per_month": -1, "seats": 5,
     "stripe_price_id": os.environ.get("STRIPE_PRICE_PRO", ""),
     "vat_note": "Acresce IVA à taxa legal",
     "features": ["Documentos ilimitados", "5 utilizadores", "OCR automático", "Reconciliação bancária", "Exportação CSV", "Suporte por email"]},
    {"id": "custom", "name": "Empresa", "price": -1, "docs_per_month": -1, "seats": -1,
     "contact": CONTACT_EMAIL,
     "features": ["Tudo do Profissional", "Utilizadores ilimitados", "SLA com garantia", "Onboarding dedicado", "Integrações personalizadas", "Suporte prioritário"]},
]

router = APIRouter(prefix="/billing", tags=["billing"])


def init_billing_db():
    """Create the tenant_plans table if it doesn't exist."""
    with get_conn() as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS tenant_plans (
                tenant_id       TEXT PRIMARY KEY,
                plan            TEXT NOT NULL DEFAULT 'free',
                status          TEXT NOT NULL DEFAULT 'trialing',
                trial_start     TIMESTAMPTZ,
                trial_end       TIMESTAMPTZ,
                stripe_customer TEXT,
                updated_at      TIMESTAMPTZ DEFAULT now()
            );
        """)
        conn.commit()


def _get_or_create_tenant_plan(tenant_id: str) -> dict:
    """Get tenant plan from DB, or create a trial entry."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT tenant_id, plan, status, trial_start, trial_end, stripe_customer FROM tenant_plans WHERE tenant_id = %s",
            (tenant_id,),
        ).fetchone()
        if row:
            return dict(row)
        # Create new trial
        now = datetime.now(UTC)
        trial_end = now + timedelta(days=TRIAL_DAYS)
        conn.execute(
            "INSERT INTO tenant_plans (tenant_id, plan, status, trial_start, trial_end) VALUES (%s, 'free', 'trialing', %s, %s)",
            (tenant_id, now, trial_end),
        )
        conn.commit()
        return {
            "tenant_id": tenant_id,
            "plan": "free",
            "status": "trialing",
            "trial_start": now,
            "trial_end": trial_end,
            "stripe_customer": None,
        }


def _compute_trial_status(info: dict) -> dict:
    """Add computed fields like trial_days_left and check expiration."""
    result = {
        "plan": info["plan"],
        "status": info["status"],
        "stripe_customer": info.get("stripe_customer", ""),
    }

    if info["plan"] in ("pro", "custom"):
        result["status"] = "active"
        return result

    trial_end = info.get("trial_end")
    if trial_end:
        now = datetime.now(UTC)
        if hasattr(trial_end, 'tzinfo') and trial_end.tzinfo is None:
            trial_end = trial_end.replace(tzinfo=UTC)
        days_left = max(0, (trial_end - now).days)
        result["trial_days_left"] = days_left
        result["trial_end"] = trial_end.isoformat() if trial_end else None
        if days_left <= 0 and info["plan"] != "pro":
            result["status"] = "trial_expired"
            # Update DB if needed
            if info["status"] != "trial_expired":
                with get_conn() as conn:
                    conn.execute(
                        "UPDATE tenant_plans SET status = 'trial_expired', updated_at = now() WHERE tenant_id = %s",
                        (info["tenant_id"],),
                    )
                    conn.commit()
    return result


def _stripe(method: str, path: str, data: dict | None = None) -> dict:
    """Call Stripe API. Raises on failure."""
    if not STRIPE_SECRET_KEY:
        raise HTTPException(status_code=503, detail="Stripe not configured")
    r = httpx.request(
        method,
        f"{STRIPE_API}{path}",
        data=data,
        auth=(STRIPE_SECRET_KEY, ""),
        timeout=15,
    )
    if r.status_code >= 400:
        raise HTTPException(status_code=r.status_code, detail=r.json().get("error", {}).get("message", r.text))
    return r.json()  # type: ignore[no-any-return]


@router.get("/plans")
async def list_plans():
    """Return available billing plans."""
    return [{"id": p["id"], "name": p["name"], "price": p["price"],
             "docs_per_month": p["docs_per_month"], "seats": p["seats"],
             "features": p.get("features", []),
             "contact": p.get("contact", ""),
             "vat_note": p.get("vat_note", "")}
            for p in PLANS]


@router.get("/status")
async def billing_status(auth: AuthInfo | None = Depends(optional_auth)):
    """Return current billing status for tenant, including trial info."""
    if not auth:
        return {"plan": "free", "status": "trialing", "trial_days_left": 14}
    tid = auth.tenant_id or auth.user_id
    info = _get_or_create_tenant_plan(tid)
    return _compute_trial_status(info)


@router.post("/checkout")
async def create_checkout(plan_id: str, auth: AuthInfo = Depends(require_auth)):
    """Create a Stripe Checkout Session for upgrading."""
    plan = next((p for p in PLANS if p["id"] == plan_id), None)
    if not plan:
        raise HTTPException(status_code=400, detail="Invalid plan")
    if plan["id"] == "custom":
        raise HTTPException(status_code=400, detail=f"Plano Empresa: contacte {CONTACT_EMAIL}")
    price_id = plan.get("stripe_price_id", "")
    if not price_id:
        raise HTTPException(status_code=503, detail="Stripe price not configured for this plan")

    checkout_data: dict = {
        "mode": "subscription",
        "line_items[0][price]": price_id,
        "line_items[0][quantity]": "1",
        "success_url": f"{APP_URL}/definicoes?billing=success",
        "cancel_url": f"{APP_URL}/planos?billing=cancel",
        "client_reference_id": auth.tenant_id or auth.user_id,
        "metadata[tenant_id]": auth.tenant_id or "",
        "metadata[user_id]": auth.user_id,
    }

    session = _stripe("POST", "/checkout/sessions", checkout_data)
    return {"checkout_url": session["url"]}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    body = await request.body()
    sig = request.headers.get("stripe-signature", "")

    if not STRIPE_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Stripe webhook not configured")
    if not sig:
        raise HTTPException(status_code=400, detail="Missing stripe-signature header")
    try:
        _verify_stripe_signature(body, sig)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid signature") from None

    event = json.loads(body)
    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        tid = data.get("metadata", {}).get("tenant_id", "")
        if tid:
            with get_conn() as conn:
                conn.execute(
                    """INSERT INTO tenant_plans (tenant_id, plan, status, stripe_customer, updated_at)
                       VALUES (%s, 'pro', 'active', %s, now())
                       ON CONFLICT (tenant_id) DO UPDATE SET plan = 'pro', status = 'active', stripe_customer = %s, updated_at = now()""",
                    (tid, data.get("customer", ""), data.get("customer", "")),
                )
                conn.commit()

    elif event_type == "customer.subscription.deleted":
        customer = data.get("customer", "")
        if customer:
            with get_conn() as conn:
                conn.execute(
                    "UPDATE tenant_plans SET plan = 'free', status = 'cancelled', updated_at = now() WHERE stripe_customer = %s",
                    (customer,),
                )
                conn.commit()

    return {"received": True}


WEBHOOK_TOLERANCE_SECONDS = 300  # 5 minutes


def _verify_stripe_signature(payload: bytes, sig_header: str) -> None:
    """Stripe webhook signature verification with replay protection."""
    parts = dict(p.split("=", 1) for p in sig_header.split(",") if "=" in p)
    timestamp = parts.get("t", "")
    v1 = parts.get("v1", "")
    if not timestamp or not v1:
        raise ValueError("Missing signature components")
    try:
        ts = int(timestamp)
    except ValueError:
        raise ValueError("Invalid timestamp") from None
    now = int(datetime.now(UTC).timestamp())
    if abs(now - ts) > WEBHOOK_TOLERANCE_SECONDS:
        raise ValueError("Webhook timestamp too old (possible replay)")
    signed = f"{timestamp}.".encode() + payload
    expected = hmac.new(STRIPE_WEBHOOK_SECRET.encode(), signed, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, v1):
        raise ValueError("Signature mismatch")
