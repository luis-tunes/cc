---
name: architecture
description: "Use when understanding how TIM domain flows work: document lifecycle, bank reconciliation, billing/subscription, auth flow, OCR pipeline. Use for: tracing data through the system, understanding why something is designed a certain way, before making cross-cutting changes."
---
# TIM Architecture

## Domain Flows

### Document Lifecycle

```
Upload (PDF) → parse.py:ingest_document()
  → pdftotext extraction (poppler)
  → if text too short → GPT-4 Vision OCR
  → _normalize_llm_result() → extract: NIF, total, VAT, date, type
  → validate_nif() → check digit algorithm
  → INSERT into documents (status='accepted')
  → cache_invalidate("documents:*")

Later:
  → classify.py → AI classification (SNC account code)
  → reconcile.py → match with bank transactions
```

**Key files:** `app/parse.py` (ingestion), `app/ocr.py` (vision), `app/classify.py` (classification)

### Bank Reconciliation

```
Bank CSV upload → routes.py:/api/bank-transactions/upload
  → parse CSV → INSERT bank_transactions
  → reconcile.py:reconcile_all(tenant_id)
    → SELECT unreconciled bank_transactions
    → SELECT unreconciled documents
    → suggest_matches() → fuzzy matching on amount, date, NIF
    → INSERT reconciliations (status='suggested')

User confirms/rejects → routes.py:/api/reconciliations/{id}
  → UPDATE reconciliation status
  → UPDATE document + bank_transaction status
```

**Key files:** `app/reconcile.py` (engine), `app/routes.py` (endpoints)

### Billing / Subscription

```
User signs up → Clerk webhook → billing.py:handle_clerk_webhook()
  → INSERT tenant_plans (plan='trial', expires=now+TRIAL_DAYS)

User upgrades → billing.py:create_checkout()
  → Stripe Checkout Session → redirect to Stripe
  → Stripe webhook → billing.py:handle_stripe_webhook()
    → UPDATE tenant_plans (plan='pro')

Access check → billing.py:check_plan(tenant_id)
  → if MASTER_USER_IDS match → always pro
  → else → query tenant_plans, check expiry
```

**Key files:** `app/billing.py`

### Auth Flow

```
Frontend → Clerk login → JWT (org_id + user_id + email)
  → Request header: Authorization: Bearer <token>
  → auth.py:require_auth() or optional_auth()
    → if AUTH_DISABLED → hardcoded dev-tenant/dev-user
    → else → validate JWT (RS256, Clerk JWKS)
    → AuthInfo(tenant_id=org_id or user_id, user_id, email)
  → tenant_id injected into every DB query
```

**Key files:** `app/auth.py`

## Middleware Stack (order matters)

Request flows through these in order:
1. **CORS** — validates origin
2. **Rate limiting** — slowapi, per-IP
3. **Security headers** — X-Content-Type-Options, X-Frame-Options, etc.
4. **Request tracking** — assigns X-Request-ID, logs request/response, feeds metrics
5. **Route handler** — actual business logic

## Service Architecture (Production)

```
Internet → Caddy (TLS) → app:8080 (FastAPI/uvicorn)
                            ├── PostgreSQL (shared with Paperless)
                            ├── Redis (optional cache)
                            └── Paperless-ngx (document management)
                                  └── POST_CONSUME_SCRIPT → bin/post-consume → webhook
```
