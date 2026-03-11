"""
Stripe billing — checkout sessions, webhooks, plan status.
Clerk handles auth; Stripe handles money. They connect via metadata.

Revenue split: 50/50 via Stripe Connect destination charges.
Partner (sales) gets 50% directly to their connected account.
Platform (builder) keeps 50% as the application fee.

Plans:
  pro    — 150€/mo, unlimited docs, 5 seats
  custom — enterprise, SLA + warranty, custom pricing (contact us)
"""

import os
import hmac
import hashlib
from typing import Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, Request

from app.auth import AuthInfo, optional_auth, require_auth

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
STRIPE_API = "https://api.stripe.com/v1"
APP_URL = os.environ.get("APP_URL", "http://localhost:3000")
CONTACT_EMAIL = os.environ.get("CONTACT_EMAIL", "info@tim.pt")

# Stripe Connect — 50/50 revenue split
# Partner's connected account ID (acct_...) from Stripe Connect onboarding
PARTNER_STRIPE_ACCOUNT = os.environ.get("PARTNER_STRIPE_ACCOUNT", "")
REVENUE_SPLIT_PERCENT = int(os.environ.get("REVENUE_SPLIT_PERCENT", "50"))

PLANS = [
    {"id": "pro", "name": "Profissional", "price": 15000, "docs_per_month": -1, "seats": 5,
     "stripe_price_id": os.environ.get("STRIPE_PRICE_PRO", ""),
     "features": ["Documentos ilimitados", "5 utilizadores", "OCR automático", "Reconciliação bancária", "Exportação CSV", "Suporte por email"]},
    {"id": "custom", "name": "Empresa", "price": -1, "docs_per_month": -1, "seats": -1,
     "contact": CONTACT_EMAIL,
     "features": ["Tudo do Profissional", "Utilizadores ilimitados", "SLA com garantia", "Onboarding dedicado", "Integrações personalizadas", "Suporte prioritário"]},
]

router = APIRouter(prefix="/billing", tags=["billing"])

# In-memory plan cache (production would use DB)
_tenant_plans: dict[str, dict] = {}


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
    return r.json()


@router.get("/plans")
async def list_plans():
    """Return available billing plans."""
    return [{"id": p["id"], "name": p["name"], "price": p["price"],
             "docs_per_month": p["docs_per_month"], "seats": p["seats"],
             "features": p.get("features", []),
             "contact": p.get("contact", "")}
            for p in PLANS]


@router.get("/status")
async def billing_status(auth: AuthInfo | None = Depends(optional_auth)):
    """Return current billing status for tenant."""
    tid = auth.tenant_id if auth else "dev-tenant"
    info = _tenant_plans.get(tid, {"plan": "free", "status": "active"})
    return info


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
        "cancel_url": f"{APP_URL}/definicoes?billing=cancel",
        "client_reference_id": auth.tenant_id or auth.user_id,
        "metadata[tenant_id]": auth.tenant_id or "",
        "metadata[user_id]": auth.user_id,
    }

    # Stripe Connect: 50/50 split — partner gets subscription revenue,
    # platform keeps application_fee_percent as its share.
    if PARTNER_STRIPE_ACCOUNT:
        checkout_data["subscription_data[application_fee_percent]"] = str(REVENUE_SPLIT_PERCENT)
        checkout_data["subscription_data[transfer_data][destination]"] = PARTNER_STRIPE_ACCOUNT

    session = _stripe("POST", "/checkout/sessions", checkout_data)
    return {"checkout_url": session["url"]}


@router.post("/webhook")
async def stripe_webhook(request: Request):
    """Handle Stripe webhook events."""
    body = await request.body()
    sig = request.headers.get("stripe-signature", "")

    # Verify signature if secret is configured
    if STRIPE_WEBHOOK_SECRET and sig:
        # Simple signature check (production should use stripe library)
        try:
            _verify_stripe_signature(body, sig)
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid signature")

    import json
    event = json.loads(body)
    event_type = event.get("type", "")
    data = event.get("data", {}).get("object", {})

    if event_type == "checkout.session.completed":
        tid = data.get("metadata", {}).get("tenant_id", "")
        if tid:
            _tenant_plans[tid] = {"plan": "pro", "status": "active",
                                   "stripe_customer": data.get("customer", "")}

    elif event_type == "customer.subscription.deleted":
        # Downgrade to free
        customer = data.get("customer", "")
        for tid, info in _tenant_plans.items():
            if info.get("stripe_customer") == customer:
                _tenant_plans[tid] = {"plan": "free", "status": "active"}
                break

    return {"received": True}


def _verify_stripe_signature(payload: bytes, sig_header: str) -> None:
    """Basic Stripe webhook signature verification."""
    parts = dict(p.split("=", 1) for p in sig_header.split(",") if "=" in p)
    timestamp = parts.get("t", "")
    v1 = parts.get("v1", "")
    if not timestamp or not v1:
        raise ValueError("Missing signature components")
    signed = f"{timestamp}.".encode() + payload
    expected = hmac.new(STRIPE_WEBHOOK_SECRET.encode(), signed, hashlib.sha256).hexdigest()
    if not hmac.compare_digest(expected, v1):
        raise ValueError("Signature mismatch")
