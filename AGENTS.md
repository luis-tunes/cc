# TIM — Time is Money

Portuguese accounting SaaS. Docs in → OCR → data out → reconcile with bank.
Multi-tenant via Clerk. Stripe billing. React frontend, FastAPI backend.

## Architecture

```
User → Clerk Auth → React SPA → /api/* → FastAPI → PostgreSQL
                                  ↕                    ↕
                            Stripe Billing    Paperless-ngx (OCR)
```

## Dependencies

### Backend (Python 3.11)
| Package | Purpose | Cost |
|---------|---------|------|
| FastAPI + uvicorn | HTTP API | Free |
| psycopg[binary,pool] | PostgreSQL driver, no ORM | Free |
| invoice2data | Invoice parsing (templates) | Free |
| httpx | HTTP client (Paperless API) | Free |
| Paperless-ngx | OCR, runs as separate container | Free (self-hosted) |
| pytest | Tests | Free |
| pytest-asyncio | Async test support | Free |

### Frontend (Node 20 / React 18)
| Package | Purpose | Cost |
|---------|---------|------|
| React 18 + ReactDOM | UI framework | Free |
| Vite 7 | Build tool + dev server | Free |
| TypeScript 5.9 | Type safety | Free |
| @clerk/react | Auth (SSO, multi-tenant, Stripe-ready) | Free <10k MAU, $25/mo 10k+ |
| Tailwind CSS 3 | Utility-first styles | Free |
| Radix UI (16 primitives) | Accessible UI components (shadcn/ui) | Free |
| TanStack React Query | Data fetching + cache | Free |
| React Router DOM | Client-side routing | Free |
| Recharts | Charts & graphs | Free |
| Lucide React | Icons | Free |
| Sonner | Toast notifications | Free |
| cmdk | Command palette | Free |

### Infrastructure
| Service | Purpose | Est. Cost |
|---------|---------|-----------|
| Clerk | Auth + user management | Free dev; $25/mo prod (10k MAU) |
| Stripe | Billing + subscriptions | 1.4% + €0.25/tx |
| PostgreSQL 16 | Database | Self-hosted (free) or $15/mo managed |
| Redis 7 | Paperless cache | Self-hosted (free) |
| VPS (Hetzner/DO) | Docker host | €5–20/mo |
| Domain + DNS | tim.pt or similar | ~€10/year |
| **Total monthly** | | **~€25–60/mo** |

## How It Flows

```
doc arrives → Paperless (OCR) → post-consume script → curl webhook
→ parse (invoice2data) → PostgreSQL → React UI shows result
```

## Schema

```sql
documents:            supplier_nif, client_nif, total, vat, date, type, status
bank_transactions:    date, description, amount
reconciliations:      document_id, bank_transaction_id, match_confidence
tenant_settings:      tenant_id, key, data (JSONB)

-- Inventory / Operations
unit_families:        name, base_unit
unit_conversions:     unit_family_id FK, from_unit, to_unit, factor
suppliers:            name, nif, category, avg_delivery_days, reliability
ingredients:          name, category, unit, min_threshold, supplier_id FK, last_cost, avg_cost
stock_events:         type (entrada/saída/desperdício/ajuste), ingredient_id FK, qty, unit, date, source, reference, cost
products:             code, name, category, recipe_version, estimated_cost, pvp, margin, active
recipe_ingredients:   product_id FK, ingredient_id FK, qty, unit, wastage_percent
price_history:        ingredient_id FK, supplier_id FK, price, date
supplier_ingredients: supplier_id FK, ingredient_id FK (junction)
```

## Reconciliation

`abs(total - amount) < 0.01 && abs(dates) <= 5 days`. That's it.

## Layout

```
app/                          # Python backend
  main.py                     # FastAPI app + SPA fallback
  db.py                       # psycopg pool + schema
  parse.py                    # invoice2data + Paperless OCR
  reconcile.py                # Amount+date matching
  routes.py                   # All API endpoints
  pt_invoice.yml              # invoice2data template
  auth.py                     # Clerk JWT middleware (require_auth, optional_auth)
  billing.py                  # Stripe billing (plans, checkout, webhooks)
  tests/
frontend/                     # React SPA
  src/
    App.tsx                   # Router + Clerk auth
    main.tsx                  # Entry (ClerkProvider, QueryClient, BrowserRouter)
    index.css                 # Tailwind + TIM theme CSS vars
    components/
      layout/                 # AppLayout, Sidebar, Topbar, PageContainer
      auth/                   # ProtectedRoute
      ui/                     # 49 shadcn/ui primitives
      shared/                 # KpiCard, StatusBadge, EmptyState, CommandMenu...
      documents/              # DocumentList, ReviewDrawer, FiltersBar
      movements/              # MovementLedger, ImportPanel
      reconciliation/         # MatchCard, ReconciliationCommandBar
      dashboard/              # FinancialOverview, ReconciliationHealth
      global/                 # GlobalUploadModal, QuickAddButton
      alerts/                 # TopbarAlertDropdown, AlertCenter
    hooks/                    # TanStack Query hooks (use-documents, use-billing, etc.)
    lib/
      api.ts                  # FastAPI client (/api/*) + Stripe billing API
      navigation.ts           # Sidebar nav config (3 groups, 13 items)
      *-data.ts               # Mock data + TypeScript types
    pages/                    # 20 page components
  tailwind.config.ts          # TIM light theme
  vite.config.ts              # Proxy /api → :8080
bin/                          # Scripts
Dockerfile                    # Multi-stage: Node build → Python runtime
docker-compose.yml
```

## Run

```bash
make dev                     # docker compose up --build (full stack)
make test                    # pytest + vite build
make deploy HOST=user@ip     # test → rsync → docker compose up -d
make clean                   # docker compose down -v + purge caches

# Frontend dev (hot reload)
cd frontend && npm run dev   # Vite on :3000, proxies /api → :8080
```

## Environment Variables

```bash
# .env (backend — see .env.example)
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
CONTACT_EMAIL=info@tim.pt     # Contacto plano Empresa
PARTNER_STRIPE_ACCOUNT=acct_... # Partner connected account (50/50 split)
REVENUE_SPLIT_PERCENT=50       # Platform keeps 50%, partner gets 50%

# frontend/.env
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
invoice2data templates in app/ for structured extraction. Fallback: regex on OCR text.

## Rules

- Decimal for money. Never float.
- NIF: 9 digits, mod 11. Validate on input.
- VAT: 23%, 13%, 6%.
- UTC storage. Europe/Lisbon display.
- Type hints on function signatures.
- Pydantic for API request/response only.
- Errors raise. Don't return None.
- SQL strings in the module that uses them. No query builder.
- Test with pytest. thing_test.py, not test_thing.py.
- One function, one job. Extract on third repeat.
- bin/ scripts are the source of truth. Makefile calls bin/. CI calls make.
- UI text in Portuguese. Code, comments, commits in English.
- Same docker-compose.yml everywhere. Only .env changes.
- .env.example in repo. .env is local, never committed.

## UI Theme

- **Light mode only**. Clean, professional light theme.
- Colors: primary gold `hsl(40 75% 48%)`, success teal, danger red, info blue.
- Sidebar: collapsible, 3 nav groups (Principal, Negócio, Definições), active indicator with gold bar.
- Inter font. Smooth scrollbars. WCAG AA contrast.
- shadcn/ui components (Radix-based). No custom CSS except theme vars.
- Min font size: `text-xs` (12px). Never use `text-[10px]` or `text-[11px]`.
- Body text: `text-sm` (14px). Section headings: `text-base` (16px). Page titles: `text-2xl`.
- Buttons: minimum `h-9 text-sm`. KPI values: `text-2xl`+.

## AI Rules

- Don't explain. Don't comment obvious things.
- Don't create files when editing one works.
- Don't guess. Ask.
- Don't add dependencies without asking.
- Paperless at `http://paperless:8000/api/`. Webhook via PAPERLESS_POST_CONSUME_SCRIPT.
- invoice2data templates in `app/` (yml files next to parse.py).
- Frontend changes: React/TypeScript in `frontend/src/`.
- API routes go under `/api` prefix in routes.py.
