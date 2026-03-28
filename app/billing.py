"""
Stripe billing + Clerk webhooks — checkout sessions, webhooks, plan status.
Clerk handles auth; Stripe handles money. They connect via metadata.

Plans:
  pro    — 150€ + IVA/mês, documentos ilimitados, 5 utilizadores
  custom — empresa, SLA + garantia, preço personalizado (contacte-nos)
"""

import base64
import hashlib
import hmac
import json
import logging
import os
from datetime import UTC, datetime, timedelta

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import AuthInfo, optional_auth, require_auth
from app.db import get_conn

logger = logging.getLogger(__name__)

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
CLERK_WEBHOOK_SECRET = os.environ.get("CLERK_WEBHOOK_SECRET", "")
STRIPE_API = "https://api.stripe.com/v1"
APP_URL = os.environ.get("APP_URL", "http://localhost:3000")
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "info@xtim.ai")

TRIAL_DAYS = int(os.environ.get("TRIAL_DAYS", "14"))

CLERK_SECRET_KEY = os.environ.get("CLERK_SECRET_KEY", "")

# Comma-separated Clerk user IDs or emails that always get pro access
MASTER_USER_IDS = {uid.strip().lower() for uid in os.environ.get("MASTER_USER_IDS", "").split(",") if uid.strip()}

# Cache: user_id -> email (fetched from Clerk Backend API)
_clerk_email_cache: dict[str, str | None] = {}


def _fetch_clerk_email(user_id: str) -> str | None:
    """Fetch user email from Clerk Backend API (cached)."""
    if user_id in _clerk_email_cache:
        return _clerk_email_cache[user_id]
    if not CLERK_SECRET_KEY:
        return None
    try:
        r = httpx.get(
            f"https://api.clerk.com/v1/users/{user_id}",
            headers={"Authorization": f"Bearer {CLERK_SECRET_KEY}"},
            timeout=5,
        )
        if r.status_code == 200:
            data = r.json()
            addrs = data.get("email_addresses", [])
            email = addrs[0].get("email_address") if addrs else None
            _clerk_email_cache[user_id] = email
            return email
    except Exception as e:
        logger.debug("Clerk email lookup failed for %s: %s", user_id, e)
    _clerk_email_cache[user_id] = None
    return None


def _is_master(auth: AuthInfo) -> bool:
    if not MASTER_USER_IDS:
        return False
    if auth.user_id.lower() in MASTER_USER_IDS:
        return True
    if auth.email is not None and auth.email.lower() in MASTER_USER_IDS:
        return True
    # Email not in JWT — fetch from Clerk Backend API
    email = _fetch_clerk_email(auth.user_id)
    return bool(email and email.lower() in MASTER_USER_IDS)


PLANS = [
    {"id": "pro", "name": "Profissional", "price": 15000, "docs_per_month": -1, "seats": 5,
     "stripe_price_id": os.environ.get("STRIPE_PRICE_PRO", ""),
     "vat_note": "Acresce IVA à taxa legal",
     "features": ["Documentos ilimitados", "5 utilizadores", "OCR automático",
                   "Reconciliação bancária", "Inventário e fornecedores",
                   "Relatórios e centro fiscal", "Assistente IA",
                   "Insights e previsões", "Suporte por email"]},
    {"id": "custom", "name": "Empresa", "price": -1, "docs_per_month": -1, "seats": -1,
     "contact": CONTACT_EMAIL,
     "features": ["Tudo do Profissional", "Utilizadores ilimitados", "SLA com garantia", "Onboarding dedicado", "Integrações personalizadas", "Suporte prioritário"]},
]

router = APIRouter(prefix="/billing", tags=["billing"])


def init_billing_db():
    """Create the tenant_plans and webhook_events tables if they don't exist."""
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
        conn.execute("""
            CREATE TABLE IF NOT EXISTS webhook_events (
                event_id    TEXT PRIMARY KEY,
                source      VARCHAR(16) NOT NULL,
                processed_at TIMESTAMPTZ DEFAULT now()
            );
            CREATE INDEX IF NOT EXISTS idx_webhook_events_processed
                ON webhook_events(processed_at);
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
    if _is_master(auth):
        return {"plan": "pro", "status": "active", "is_master": True}
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


@router.post("/portal")
async def create_portal(auth: AuthInfo = Depends(require_auth)):
    """Create a Stripe Customer Portal session for managing subscription."""
    tid = auth.tenant_id or auth.user_id
    info = _get_or_create_tenant_plan(tid)
    customer_id = info.get("stripe_customer")
    if not customer_id:
        raise HTTPException(status_code=400, detail="Sem subscrição Stripe ativa")
    session = _stripe("POST", "/billing_portal/sessions", {
        "customer": customer_id,
        "return_url": f"{APP_URL}/definicoes",
    })
    return {"portal_url": session["url"]}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events (idempotent via event_id dedup)."""
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
    event_id = event.get("id", "")
    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    # Idempotency: skip already-processed events
    if event_id and _is_event_processed(event_id):
        logger.info("Stripe webhook: skipping duplicate event %s", event_id)
        return {"received": True, "duplicate": True}

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

    elif event_type == "customer.subscription.updated":
        customer = data.get("customer", "")
        sub_status = data.get("status", "")  # active, past_due, unpaid, canceled
        if customer:
            plan_status = "active"
            if sub_status in ("past_due", "unpaid"):
                plan_status = "past_due"
            elif sub_status == "canceled":
                plan_status = "cancelled"
            with get_conn() as conn:
                conn.execute(
                    "UPDATE tenant_plans SET status = %s, updated_at = now() WHERE stripe_customer = %s AND plan = 'pro'",
                    (plan_status, customer),
                )
                conn.commit()

    elif event_type == "invoice.payment_failed":
        customer = data.get("customer", "")
        if customer:
            with get_conn() as conn:
                conn.execute(
                    "UPDATE tenant_plans SET status = 'past_due', updated_at = now() WHERE stripe_customer = %s AND plan = 'pro'",
                    (customer,),
                )
                conn.commit()
            logger.warning("Payment failed for customer %s", customer)

    elif event_type == "invoice.paid":
        customer = data.get("customer", "")
        if customer:
            with get_conn() as conn:
                conn.execute(
                    "UPDATE tenant_plans SET status = 'active', updated_at = now() WHERE stripe_customer = %s AND plan = 'pro'",
                    (customer,),
                )
                conn.commit()

    # Mark event as processed
    if event_id:
        _mark_event_processed(event_id, "stripe")

    return {"received": True}


@router.post("/clerk-webhook")
async def clerk_webhook(request: Request):
    """Handle Clerk webhook events (user.created → auto-provision tenant)."""
    body = await request.body()

    if not CLERK_WEBHOOK_SECRET:
        raise HTTPException(status_code=503, detail="Clerk webhook not configured")

    # Verify Svix signature
    svix_id = request.headers.get("svix-id", "")
    svix_timestamp = request.headers.get("svix-timestamp", "")
    svix_signature = request.headers.get("svix-signature", "")
    if not svix_id or not svix_timestamp or not svix_signature:
        raise HTTPException(status_code=400, detail="Missing Svix headers")
    try:
        _verify_svix_signature(body, svix_id, svix_timestamp, svix_signature)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid signature") from None

    event = json.loads(body)
    event_type = event.get("type", "")
    data = event.get("data", {})

    # Idempotency
    if svix_id and _is_event_processed(svix_id):
        logger.info("Clerk webhook: skipping duplicate event %s", svix_id)
        return {"received": True, "duplicate": True}

    if event_type == "user.created":
        user_id = data.get("id", "")
        email = (data.get("email_addresses") or [{}])[0].get("email_address", "")
        if user_id:
            _provision_tenant(user_id, email)
            logger.info("Clerk user.created: provisioned tenant for user=%s email=%s", user_id, email)

    # Mark processed
    if svix_id:
        _mark_event_processed(svix_id, "clerk")

    return {"received": True}


WEBHOOK_TOLERANCE_SECONDS = 300  # 5 minutes


def _is_event_processed(event_id: str) -> bool:
    """Check if a webhook event was already processed (idempotency)."""
    with get_conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM webhook_events WHERE event_id = %s", (event_id,)
        ).fetchone()
    return row is not None


def _mark_event_processed(event_id: str, source: str) -> None:
    """Record a webhook event as processed."""
    with get_conn() as conn:
        conn.execute(
            "INSERT INTO webhook_events (event_id, source) VALUES (%s, %s) ON CONFLICT DO NOTHING",
            (event_id, source),
        )
        conn.commit()


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


def _verify_svix_signature(payload: bytes, msg_id: str, timestamp: str, signatures: str) -> None:
    """Svix webhook signature verification (used by Clerk webhooks)."""
    try:
        ts = int(timestamp)
    except ValueError:
        raise ValueError("Invalid timestamp") from None
    now = int(datetime.now(UTC).timestamp())
    if abs(now - ts) > WEBHOOK_TOLERANCE_SECONDS:
        raise ValueError("Webhook timestamp too old (possible replay)")

    # Clerk/Svix secret is "whsec_<base64>" — decode the key
    secret = CLERK_WEBHOOK_SECRET
    if secret.startswith("whsec_"):
        secret = secret[6:]
    key = base64.b64decode(secret)

    to_sign = f"{msg_id}.{timestamp}.".encode() + payload
    computed = base64.b64encode(
        hmac.new(key, to_sign, hashlib.sha256).digest()
    ).decode()

    # signatures header can have multiple: "v1,<sig1> v1,<sig2>"
    for sig_part in signatures.split(" "):
        parts = sig_part.split(",", 1)
        if len(parts) == 2 and parts[0] == "v1":
            if hmac.compare_digest(computed, parts[1]):
                return
    raise ValueError("Signature mismatch")


def _provision_tenant(user_id: str, email: str) -> None:
    """Create tenant plan + seed default classification/movement rules for a new user."""
    tid = user_id  # tenant_id = user_id when no org
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT 1 FROM tenant_plans WHERE tenant_id = %s", (tid,)
        ).fetchone()
        if existing:
            return  # already provisioned

        now = datetime.now(UTC)
        trial_end = now + timedelta(days=TRIAL_DAYS)
        conn.execute(
            "INSERT INTO tenant_plans (tenant_id, plan, status, trial_start, trial_end) VALUES (%s, 'free', 'trialing', %s, %s)",
            (tid, now, trial_end),
        )

        # Seed common Portuguese movement rules
        default_rules = [
            ("EDP", "edp", "utilities", "62211", None, 10),
            ("Vodafone/NOS", "vodafone|nos comunicacoes", "comms", "62212", None, 20),
            ("Combustível", "galp|bp|repsol|cepsa", "fuel", "62214", None, 30),
            ("Refeições", "uber eats|glovo|bolt food", "meals", "62217", None, 40),
            ("Portagens", "via verde", "tolls", "62219", None, 50),
        ]
        for name, pattern, category, snc, nif, priority in default_rules:
            conn.execute(
                """INSERT INTO movement_rules (tenant_id, name, pattern, category, snc_account, entity_nif, priority, active)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)""",
                (tid, name, pattern, category, snc, nif, priority, True),
            )

        conn.commit()
    logger.info("Provisioned tenant %s (email=%s) with trial + default rules", tid, email)


def require_pro(auth: AuthInfo = Depends(require_auth)) -> AuthInfo:
    """Billing enforcement — reject requests from expired/free tenants on pro-only endpoints."""
    if auth.user_id in MASTER_USER_IDS:
        return auth
    tid = auth.tenant_id or auth.user_id
    info = _get_or_create_tenant_plan(tid)
    computed = _compute_trial_status(info)
    if computed["status"] in ("active", "trialing"):
        return auth
    raise HTTPException(status_code=402, detail="Subscrição necessária para aceder a esta funcionalidade")
