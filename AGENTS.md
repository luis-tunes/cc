# TIM — Time is Money

Portuguese accounting SaaS. Docs in → OCR → data out → reconcile with bank.
Multi-tenant via Clerk. Stripe billing. React frontend, FastAPI backend.

## Architecture

```
User → Clerk Auth → React SPA → /api/* → FastAPI → PostgreSQL
                                  ↕                    ↕
                            Stripe Billing    Paperless-ngx (OCR)
```

Caddy reverse proxy in front. Redis for Paperless cache. All Docker.

## Dependencies

### Backend (Python 3.11)
| Package | Purpose |
|---------|---------|
| FastAPI + uvicorn | HTTP API |
| psycopg[binary,pool] | PostgreSQL driver, no ORM |
| invoice2data | Invoice parsing (templates) |
| httpx | HTTP client (Paperless, LLM APIs) |
| Paperless-ngx | OCR, runs as separate container |
| slowapi | Rate limiting (per-tenant + per-IP) |
| sentry-sdk[fastapi] | Error tracking (optional) |
| python-json-logger | Structured JSON logging |
| redis | Cache backend |
| Pydantic v2 | Request validation (API boundaries only) |

### Frontend (Node 20 / React 18)
| Package | Purpose |
|---------|---------|
| React 18 + Vite 7 + TypeScript 5.9 | Core stack |
| @clerk/react | Auth (SSO, multi-tenant) |
| Tailwind CSS 3 + shadcn/ui (Radix) | Styling + components |
| TanStack React Query | Data fetching + cache |
| React Router DOM | Client-side routing |
| Recharts | Charts |
| Lucide React | Icons |
| Sonner | Toast notifications |
| cmdk | Command palette |

### Infrastructure
| Service | Purpose |
|---------|---------|
| Clerk | Auth + user management |
| Stripe | Billing + subscriptions |
| PostgreSQL 16 | Database |
| Redis 7 | Paperless cache + rate limit state |
| Caddy 2 | Reverse proxy, TLS, security headers, gzip |
| Docker Compose | Orchestration (same file everywhere, only .env.production changes) |

## How It Flows

```
doc arrives → Paperless (OCR) → post-consume script → curl webhook
→ parse (invoice2data / LLM vision) → PostgreSQL → React UI shows result
→ auto-reconcile with bank transactions
```

## Schema

```sql
documents:            supplier_nif, client_nif, total, vat, date, type, status, notes
bank_transactions:    date, description, amount
reconciliations:      document_id, bank_transaction_id, match_confidence (0-1)
tenant_settings:      tenant_id, key, data (JSONB)
classification_rules: field, operator, value, account, label, priority, active
movement_rules:       pattern, category, snc_account, entity_nif, priority, active
alerts:               type, severity, title, description, action_url, read
audit_log:            entity_type, entity_id, action, details, timestamp
assets:               name, purchase_date, cost, useful_life_years, depreciation_method

-- Inventory / Operations
unit_families:        name, base_unit (UNIQUE per tenant)
unit_conversions:     unit_family_id FK, from_unit, to_unit, factor
suppliers:            name, nif, category, avg_delivery_days, reliability
ingredients:          name, category, unit, min_threshold, supplier_id FK, last_cost, avg_cost
stock_events:         type (entrada/saída/desperdício/ajuste), ingredient_id FK, qty, unit, date
products:             code, name, category, recipe_version, estimated_cost, pvp, margin, active
recipe_ingredients:   product_id FK, ingredient_id FK, qty, unit, wastage_percent
price_history:        ingredient_id FK, supplier_id FK, price, date
supplier_ingredients: supplier_id FK, ingredient_id FK (junction)
```

### DB Constraints
- `documents.total >= 0`, `documents.vat >= 0`
- `reconciliations.match_confidence BETWEEN 0 AND 1`
- `assets.useful_life_years > 0`
- `unit_families(tenant_id, name)` UNIQUE
- Indexes on `documents(tenant_id, supplier_nif)`, `documents(tenant_id, type)`

## Reconciliation

Hash-map match by amount (±0.01) within ±5 days. Confidence = 70% amount + 30% date weighting. Advisory lock per tenant to prevent concurrent runs.

## Layout

```
app/                          # Python backend (all .py files flat)
  main.py                     # FastAPI app, CORS, security headers, Sentry, rate limiting
  db.py                       # psycopg pool + schema + constraints
  routes.py                   # All API endpoints + Pydantic request models
  auth.py                     # Clerk JWT middleware (require_auth, optional_auth)
  billing.py                  # Stripe billing (plans, checkout, webhooks)
  parse.py                    # invoice2data + Paperless OCR + LLM vision extraction
  ocr.py                      # OCR abstraction layer (Paperless / Google Doc AI)
  reconcile.py                # Amount+date matching (hash-map O(n))
  classify.py                 # Document auto-classification (rules engine)
  classify_movements.py       # Bank movement classification + entity detection
  alerts.py                   # Compliance alerts (IVA deadlines, unreconciled, gaps)
  assistant.py                # AI assistant (natural language queries)
  assets.py                   # Fixed asset depreciation
  cache.py                    # Redis cache helpers
  limiter.py                  # Rate limit config (default, upload, webhook, expensive)
  pt_invoice.yml              # invoice2data template
  tests/                      # pytest (thing_test.py convention)
frontend/                     # React SPA
  src/
    App.tsx                   # Router + Clerk auth (all pages lazy-loaded)
    main.tsx                  # Entry (ClerkProvider, QueryClient, BrowserRouter)
    index.css                 # Tailwind + TIM theme + reduced-motion
    components/
      layout/                 # AppLayout, Sidebar, Topbar, PageContainer
      auth/                   # ProtectedRoute
      ui/                     # ~50 shadcn/ui primitives
      shared/                 # KpiCard, StatusBadge, EmptyState, ErrorState, LoadingSkeletons
      documents/              # DocumentList, ReviewDrawer, FiltersBar, BulkActionsBar
      movements/              # MovementLedger, ImportPanel
      reconciliation/         # MatchCard, ReconciliationCommandBar
      dashboard/              # FinancialOverview, ReconciliationHealth
      global/                 # GlobalUploadModal, QuickAddButton
      alerts/                 # TopbarAlertDropdown, AlertCenter
      inventory/              # Stock, ingredients, unit families
      products/               # Product management, recipes
      suppliers/              # Supplier CRUD
      billing/                # TrialGate, UpgradeGate
    hooks/                    # TanStack Query hooks (use-documents, use-billing, etc.)
    lib/
      api.ts                  # Typed API client (/api/*), ApiError class, auth token management
      navigation.ts           # Sidebar nav config
      *-data.ts               # TypeScript types + mock scaffolds
    pages/                    # ~25 lazy-loaded page components
  public/
    sw.js                     # Service worker (network-first API, cache-first statics)
    manifest.json             # PWA manifest
  vite.config.ts              # Proxy /api → :8080, manualChunks, es2020 target
  tailwind.config.ts          # TIM light theme
bin/                          # Scripts (source of truth for all operations)
  dev                         # docker compose up --build
  test                        # pytest + npm build + npm test
  ship                        # test → build → deploy
  deploy                      # rsync → docker compose up -d
  init-db.sh                  # PostgreSQL schema init
  post-consume                # Paperless webhook trigger
  setup-paperless-token       # Generate Paperless API token
  setup-server                # Server provisioning
  sync-env                    # Sync .env.production to remote
  clean                       # docker compose down -v + purge caches
mcp/                          # MCP server for GitHub Copilot (AI tooling layer)
  src/server.ts               # Exposes codebase as tools via stdio
.github/workflows/ci.yml      # CI: ruff + mypy + pytest + npm test → ghcr.io → deploy
Dockerfile                    # Multi-stage: Node build → Python runtime (non-root user)
docker-compose.yml            # Full stack (same file everywhere, only .env.production changes)
Caddyfile                     # Reverse proxy, gzip, HSTS, security headers
Makefile                      # Thin wrapper: dev, test, ship, deploy, lint, format, type-check, logs, db, frontend
pyproject.toml                # Tool config only (ruff, mypy, pytest)
requirements.txt              # Runtime deps (pinned)
requirements-test.txt         # Test + lint deps (-r requirements.txt + pytest + ruff + mypy)
```

## Run

```bash
make dev                     # docker compose up --build (full stack)
make test                    # pytest + vite build
make lint                    # ruff check app/
make format                  # ruff format app/
make type-check              # mypy app/
make logs                    # docker compose logs -f
make db                      # psql into database
make frontend                # npm test + npm build
make deploy HOST=user@ip     # test → rsync → docker compose up -d
make clean                   # docker compose down -v + purge caches

# Frontend dev (hot reload)
cd frontend && npm run dev   # Vite on :3000, proxies /api → :8080
```

## Environment Variables

```bash
# .env.production (backend — see .env.example)
DATABASE_URL=postgresql://cc:cc@db:5432/cc
PAPERLESS_URL=http://paperless:8000
PAPERLESS_TOKEN=...
CLERK_SECRET_KEY=sk_test_...
CLERK_PEM_PUBLIC_KEY=...       # RSA PEM from Clerk dashboard
AUTH_DISABLED=0                # set to 1 for dev only (skips JWT validation)
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PRICE_PRO=price_...     # Stripe price ID for 150€ + IVA/mês
APP_URL=http://localhost:3000  # Stripe redirect URL
CONTACT_EMAIL=info@tim.pt
CORS_ORIGINS=http://localhost:3000   # comma-separated
SENTRY_DSN=...                       # optional
SENTRY_TRACES_SAMPLE_RATE=0.1       # optional

# frontend/.env.production
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...
```

## Won't Do (For Now)

AT integration. SAFT. ML. Complex billing. ORM.

## Target User

Business owner (not accountant). All UI text in simple Portuguese.
Explain accounting concepts via HelpTooltip. Minimize information density.
Mobile-first responsive design is essential.

## OCR Strategy

Paperless-ngx uses Tesseract via ocrmypdf (PAPERLESS_OCR_LANGUAGE: por+eng).
Abstraction layer in app/ocr.py allows swapping engine (e.g., Google Document AI) via env var.
invoice2data templates in app/ for structured extraction. Fallback: LLM vision → regex on OCR text.

## Rules

- Decimal for money. Never float.
- NIF: 9 digits, mod 11. Validate on input.
- VAT: 23%, 13%, 6%.
- UTC storage. Europe/Lisbon display.
- Type hints on function signatures. mypy must pass.
- Pydantic for API request/response only.
- Errors raise. Don't return None.
- SQL strings in the module that uses them. No query builder.
- Test with pytest. thing_test.py, not test_thing.py. 373 backend + 132 frontend tests.
- One function, one job. Extract on third repeat.
- bin/ scripts are the source of truth. Makefile calls bin/. CI calls make.
- UI text in Portuguese. Code, comments, commits in English.
- Same docker-compose.yml everywhere. Only .env.production changes.
- .env.example in repo. .env.production is local, never committed.
- Rate limit expensive endpoints (10/min). Auth endpoints not rate-limited.
- Batch DB queries. Never N+1. Fetch rules/suppliers once, pass to functions.

## UI Theme

- **Light mode only**. Clean, professional light theme.
- Colors: primary gold `hsl(40 75% 48%)`, success teal, danger red, info blue.
- Sidebar: collapsible, 3 nav groups (Principal, Negócio, Definições), active indicator with gold bar.
- Inter font. Smooth scrollbars. WCAG AA contrast. prefers-reduced-motion respected.
- shadcn/ui components (Radix-based). No custom CSS except theme vars.
- Min font size: `text-xs` (12px). Never use `text-[10px]` or `text-[11px]`.
- Body text: `text-sm` (14px). Section headings: `text-base` (16px). Page titles: `text-2xl`.
- Buttons: minimum `h-9 text-sm`. KPI values: `text-2xl`+.

## Security

- Non-root Docker user (appuser). HEALTHCHECK on /health.
- CORS configurable via CORS_ORIGINS env var.
- Security headers: X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy.
- Caddy: HSTS, gzip, hide Server header.
- Redis authentication (requirepass).
- Docker memory limits (app: 1G, redis: 256M, caddy: 128M).
- Rate limiting: default 100/min, uploads 20/min, webhooks 30/min, expensive ops 10/min.

## AI Rules

- Don't explain. Don't comment obvious things.
- Don't create files when editing one works.
- Don't guess. Ask.
- Don't add dependencies without asking.
- Paperless at `http://paperless:8000/api/`. Webhook via PAPERLESS_POST_CONSUME_SCRIPT.
- invoice2data templates in `app/` (yml files next to parse.py).
- Frontend changes: React/TypeScript in `frontend/src/`.
- API routes go under `/api` prefix in routes.py.
