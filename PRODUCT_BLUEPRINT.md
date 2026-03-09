# CC — Product & UX Blueprint

> Evidence-based reverse-engineering of the `xzero-ai/cc` repository.
> Every claim is grounded in specific files. Assumptions are explicitly labelled.

---

## 1. Executive Product Summary

**CC** (Contabilidade) is a single-operator Portuguese accounting tool that ingests PDF invoices via
Paperless-ngx OCR, extracts structured fiscal data (supplier/client NIF, total, VAT, date, type),
imports bank-statement CSV exports, and automatically reconciles invoices against bank transactions.
The result is a real-time dashboard of billing totals, VAT liability by month, and unmatched
documents requiring manual attention.

### Core problem solved

Small Portuguese businesses or sole traders accumulate PDF invoices from suppliers. Matching those
invoices to the corresponding bank debit is manual, error-prone, and legally required (NIF-level
traceability, IVA reporting). CC automates the full pipeline: OCR → structured extraction →
reconciliation → VAT summary.

### Primary user types

| Role | Description | Evidence |
|------|-------------|----------|
| **Operator / Accountant** | Single user who uploads PDFs and CSV statements and triggers reconciliation | No auth routes exist; the app is single-tenant by design (`CLAUDE.md`: "Won't Do: Multi-tenant") |
| **System / Webhook** | Paperless-ngx post-consume script that fires the `/webhook` endpoint after OCR | `bin/post-consume`, `routes.py::paperless_webhook` |

### Major jobs-to-be-done

1. **Ingest invoices** — drag-and-drop PDF upload or Paperless direct scan → OCR → structured record
2. **Import bank movements** — upload CSV extract from bank → stored transactions
3. **Reconcile** — one-click match of documents to bank transactions by amount ± €0.01 and date ± 5 days
4. **Monitor fiscal health** — dashboard KPIs: total invoiced, movements, reconciled count, pending count
5. **Report IVA** — per-month VAT totals rendered as bar chart and table
6. **Export** — download all documents as CSV for external reporting or audit

---

## 2. Repository-Evidenced Feature Inventory

| # | Feature | User action | Role | Key evidence | Status | UX importance |
|---|---------|-------------|------|-------------|--------|---------------|
| 1 | PDF upload via drag-and-drop | Drop PDF onto zone or click-select | Operator | `web/index.html` `#dropzone`, `app.js::handleFiles`, `routes.py::upload_document` | **Confirmed** | Core |
| 2 | Paperless webhook ingestion | Automatic on OCR completion | System | `bin/post-consume`, `routes.py::paperless_webhook`, `parse.py::ingest_document` | **Confirmed** | Core |
| 3 | Invoice parsing — template (invoice2data) | Automatic | System | `app/pt_invoice.yml`, `parse.py::parse_invoice` (uses `extract_data`) | **Confirmed** | Core |
| 4 | Invoice parsing — OCR text fallback | Automatic when template fails | System | `parse.py::ingest_document` fallback block, `_parse_amount_from_text`, `_parse_date_from_text`, `_NIF_RE` | **Confirmed** | Core |
| 5 | NIF validation (mod-11) | Automatic on ingest | System | `parse.py::validate_nif`, `parse_test.py` | **Confirmed** | Core |
| 6 | Bank CSV import | Upload CSV file | Operator | `routes.py::upload_bank_csv`, `web/index.html` Banco tab, `app.js::uploadCSV` | **Confirmed** | Core |
| 7 | Automatic reconciliation | Click "Reconciliar agora" | Operator | `reconcile.py::reconcile_all`, `routes.py::run_reconciliation`, `app.js::runReconcile` | **Confirmed** | Core |
| 8 | Dashboard KPI grid | View on load | Operator | `routes.py::dashboard_summary`, `app.js::setKpis`, `app.js::setSummaryBar` | **Confirmed** | Core |
| 9 | Reconciliation donut chart | View on dashboard | Operator | `app.js::renderDonut`, `index.html` `#donutChart` | **Confirmed** | Core |
| 10 | Monthly VAT bar chart | View IVA tab | Operator | `routes.py::monthly_summary`, `app.js::renderBar`, `app.js::loadMonthly` | **Confirmed** | Core |
| 11 | Monthly VAT table | View IVA tab | Operator | `app.js::loadMonthly` renders `<table class="iva-table">` | **Confirmed** | Core |
| 12 | Document list with filters | List view, filter by supplier_nif, date range | Operator | `routes.py::list_documents` query params, `app.js::loadDocs` (no filter UI yet) | **Partial** (API ready, no filter UI) | Core |
| 13 | Bank transaction list | List view | Operator | `routes.py::list_bank_transactions`, `app.js::loadTxs` | **Confirmed** | Core |
| 14 | Reconciliation list | View matched pairs | Operator | `routes.py::list_reconciliations` (JOIN query), `app.js::loadRecs` match-grid | **Confirmed** | Core |
| 15 | CSV export of documents | Click "Exportar CSV" | Operator | `routes.py::export_csv`, `app.js::exportCSV` | **Confirmed** | Secondary |
| 16 | XHR upload progress bar | Visual during upload | Operator | `app.js::uploadWithProgress` `xhr.upload.progress`, `.fr-bar` CSS | **Confirmed** | Core |
| 17 | OCR in-progress banner + 90 s poll | Visual feedback post-upload | Operator | `app.js::showOcrBanner`, `app.js::pollForNewDoc` 3 s interval, 90 s timeout | **Confirmed** | Core |
| 18 | Paperless-ngx link | Open Paperless in new tab | Operator | `index.html` `.paperless-hint` callout, `.btn-paperless` link to `http://localhost:8000` | **Confirmed** | Secondary |
| 19 | Health endpoint | Liveness probe | Ops | `main.py::health` returns `{"status":"ok"}` | **Confirmed** | Admin/hidden |
| 20 | Authentication / user accounts | — | — | **None** in codebase | **Not implemented** | Unknown |
| 21 | Search / full-text filter UI | — | — | No search routes, no search UI; only server-side NIF/date filter on `/documents` | **Implied** | Secondary |
| 22 | Manual document correction | — | — | No edit/PATCH route, no edit form | **Not implemented** | Secondary |
| 23 | Notifications / email alerts | — | — | No email service, no push/SSE | **Not implemented** | Secondary |
| 24 | Billing / subscriptions | — | — | None | **Not implemented** | N/A (single-tenant) |
| 25 | Admin panel | — | — | None beyond Paperless-ngx own UI | **Not implemented** | Admin |
| 26 | Audit log | — | — | `created_at` on each table; no query route | **Implied** (data exists, no UI) | Admin |
| 27 | Document detail page | — | — | `GET /documents/{doc_id}` exists; no detail UI | **Partial** (API only) | Secondary |
| 28 | 30 s auto-refresh | Periodic KPI/chart refresh | Operator | `app.js` `setInterval(() => { loadSummary(); loadMonthly(); }, 30000)` | **Confirmed** | Core |

---

## 3. Confirmed vs Partial vs Implied Functionality

### Confirmed implemented

- End-to-end PDF ingestion via two paths (Paperless webhook → `ingest_document`; direct upload → Paperless → webhook)
- `invoice2data` template-based extraction (`pt_invoice.yml`) with regex fallback on OCR text
- NIF mod-11 validation (tested in `app/tests/parse_test.py`)
- Bank CSV import with column validation (semicolon-delimited, `date;description;amount`)
- Reconciliation engine: `abs(total − amount) < 0.01 && abs(dates) <= 5 days` (tested in `app/tests/reconcile_test.py`)
- PostgreSQL schema: `documents`, `bank_transactions`, `reconciliations` tables with FK constraints
- Full single-page UI with five tabs, charts (Chart.js), empty states, toast messages
- Docker-compose stack: `db` (Postgres 16), `redis`, `paperless` (paperless-ngx 2.14), `app`
- CI pipeline: lint-free pytest on every PR (`.github/workflows/ci.yml`)
- SSH-based deploy script (`bin/deploy`)

### Partial — API exists, UI incomplete

- **Document filtering** (`supplier_nif`, `date_from`, `date_to`, `limit`, `offset` on `GET /documents`) — server-side only; no filter controls in frontend
- **Document detail** (`GET /documents/{doc_id}`) — API returns full record; no detail view in frontend
- **Pagination** (`limit`/`offset` on all list routes) — API supports it; frontend always fetches first 100

### Implied — data model supports it, no implementation

- **Audit history** — `created_at TIMESTAMPTZ DEFAULT now()` on all three tables; no query surface
- **Unreconciliation / manual override** — reconciliation `UNIQUE(document_id, bank_transaction_id)` implies idempotency but no delete/override route
- **Search** — NIFs stored as VARCHAR; full-text search not set up

### Not implemented (mentioned in `CLAUDE.md` "Won't Do")

- Authentication, multi-tenant, AT integration, SAFT export, ML models, email/push notifications, complex billing

---

## 4. Core Entities and Data Model Implications

### `documents`

```
id            SERIAL PK
supplier_nif  VARCHAR(9)   — validated NIF of invoice issuer
client_nif    VARCHAR(9)   — validated NIF of invoice recipient
total         NUMERIC(12,2)
vat           NUMERIC(12,2)
date          DATE
type          VARCHAR(32)  — e.g. "invoice", "transfer" (from invoice2data or fallback)
paperless_id  INTEGER UNIQUE — foreign reference to Paperless document
created_at    TIMESTAMPTZ
```

**UI object**: A "Fatura" card/row. Key visible fields: supplier NIF chip, client NIF chip, total (green mono), VAT (amber mono), date, type badge.
Linked to Paperless for PDF viewing (`paperless_id`).

### `bank_transactions`

```
id          SERIAL PK
date        DATE
description TEXT
amount      NUMERIC(12,2)  — negative = debit, positive = credit
created_at  TIMESTAMPTZ
```

**UI object**: A "Movimento" row. Amount colored by sign (`amtCls` in `app.js`): red for negative, green for positive.

### `reconciliations`

```
id                  SERIAL PK
document_id         INTEGER FK → documents
bank_transaction_id INTEGER FK → bank_transactions
match_confidence    NUMERIC(5,4)  — 1 − amount_diff; always near 1.0
created_at          TIMESTAMPTZ
UNIQUE(document_id, bank_transaction_id)
```

**UI object**: A "Match card" — two-column layout showing invoice side and transaction side connected by an arrow and a percentage confidence badge. Rendered by `app.js::loadRecs`.

### Relationships

```
documents 1──0..1 reconciliations ──0..1 bank_transactions
```

A document can appear in at most one reconciliation (FK + UNIQUE constraint).
A bank transaction can appear in at most one reconciliation.
An unmatched document is detected by `WHERE id NOT IN (SELECT document_id FROM reconciliations)`.

---

## 5. Reconstructed User Flows

### Flow 1 — Upload & Ingest PDF (direct upload path)

| Step | Actor | Action / System response |
|------|-------|--------------------------|
| 1 | Operator | Drags PDF onto `#dropzone` (or clicks → file picker) |
| 2 | Frontend | `handleFiles` filters `.pdf`, renders file row with progress bar |
| 3 | Frontend | XHR `POST /documents/upload` with `multipart/form-data` |
| 4 | Backend | `upload_document` validates `.pdf` extension, proxies to Paperless `POST /api/documents/post_document/` |
| 5 | Paperless | Queues OCR job (~30 s), returns 200/202 |
| 6 | Backend | Returns `{"status":"accepted","filename":"..."}` |
| 7 | Frontend | Marks file row "Enviado ✓", shows `.ocr-banner` spinner |
| 8 | Frontend | `pollForNewDoc` polls `GET /dashboard/summary` every 3 s for 90 s |
| 9 | Paperless | On OCR complete, runs `bin/post-consume` which calls `POST /webhook {"document_id": N}` |
| 10 | Backend | `ingest_document(N)`: fetches PDF from Paperless, runs `invoice2data`, falls back to OCR text, validates NIFs, upserts into `documents` |
| 11 | Frontend | Poll sees `documents.count` increase → clears banner, shows "✓ Documento importado", refreshes docs table + KPIs |

**Success**: Document row appears in Faturas table.
**Error states**: PDF rejected (non-PDF extension → 422), Paperless unreachable (502), NIF extraction fails → stored as "000000000" (not an error, just degraded data quality), OCR timeout → poll expires after 90 s and banner disappears silently.

---

### Flow 2 — Upload & Ingest PDF (Paperless-native scan path)

| Step | Actor | Action |
|------|-------|--------|
| 1 | Operator | Uploads/scans document directly in Paperless-ngx UI |
| 2 | Paperless | OCR completes, runs `PAPERLESS_POST_CONSUME_SCRIPT` = `bin/post-consume` |
| 3 | Script | `curl -X POST http://app:8080/webhook -d '{"document_id": $DOCUMENT_ID}'` |
| 4 | Backend | Same as steps 10–11 above |

**Evidence**: `docker-compose.yml` `PAPERLESS_POST_CONSUME_SCRIPT: /opt/bin/post-consume`, `bin/post-consume` script.

---

### Flow 3 — Import Bank Statement

| Step | Actor | Action |
|------|-------|--------|
| 1 | Operator | Navigates to "Banco" tab → chooses CSV file (`.csv`) |
| 2 | Operator | Clicks "Importar movimentos" |
| 3 | Frontend | `uploadCSV` → `POST /bank-transactions/upload` multipart |
| 4 | Backend | `upload_bank_csv`: decodes UTF-8-BOM, validates columns (`date`, `description`, `amount`), inserts all rows |
| 5 | Frontend | Shows "✓ N movimentos importados", refreshes bank table and summary |

**Error states**: Missing columns → 422 "CSV must have columns: date, description, amount", malformed amount → Python `ValueError` → 500 (unhandled, UX blind spot).

---

### Flow 4 — Reconcile

| Step | Actor | Action |
|------|-------|--------|
| 1 | Operator | Navigates to "Reconciliar" tab, clicks "Reconciliar agora" |
| 2 | Frontend | Disables button, shows spinner icon |
| 3 | Backend | `reconcile_all`: queries unmatched docs and unmatched txs, nested loop, matches if `amount_diff < 0.01` AND `date_diff <= 5 days` |
| 4 | Backend | Inserts matches with `ON CONFLICT DO NOTHING`, returns `{"matched": N, "matches": [...]}` |
| 5 | Frontend | Shows toast, reloads reconciliation list, refreshes summary/donut |

**Success**: Matched pairs appear as two-column cards with confidence %.
**Edge cases**: No new matches → "Sem novas correspondências" info toast. Already-reconciled pairs skip (UNIQUE constraint).

---

### Flow 5 — Monitor Dashboard

| Step | Actor | Action |
|------|-------|--------|
| 1 | Operator | Opens app (default tab: Dashboard) |
| 2 | Frontend | `loadSummary` → `GET /dashboard/summary`; `loadMonthly` → `GET /dashboard/monthly` |
| 3 | Frontend | Renders 5 KPI cards, summary bar, donut chart (reconciled vs pending), bar chart (VAT by month) |
| 4 | Auto | Every 30 s: `loadSummary()` + `loadMonthly()` refresh all charts |

---

### Flow 6 — Export CSV

| Step | Actor | Action |
|------|-------|--------|
| 1 | Operator | Clicks "Exportar CSV" in Faturas tab |
| 2 | Frontend | `window.location.href = '/export/csv'` |
| 3 | Backend | Streams CSV with headers `ID;NIF Fornecedor;NIF Cliente;Total;IVA;Data;Tipo` |
| 4 | Browser | Downloads `documentos.csv` |

---

## 6. Screen Map and UI Requirements

| Screen / Tab | Purpose | Key components | Backend endpoints | Critical states |
|---|---|---|---|---|
| **Dashboard** (default) | Fiscal health at a glance | 5 KPI cards, summary bar, donut chart, bar chart | `GET /dashboard/summary`, `GET /dashboard/monthly` | Loading (dashes), empty (0 docs), all-reconciled (green badge), unmatched > 0 (red badge + PEND KPI red) |
| **Faturas** | Invoice management | Paperless callout, drag-drop zone, file list with progress bars, OCR banner, documents table | `POST /documents/upload`, `GET /documents` | Empty state ("Arrasta PDFs para começar"), OCR in-progress spinner, parse error (silent – stored as 000000000), table with data |
| **Banco** | Bank statement management | CSV instructions, file picker, import button, transactions table | `POST /bank-transactions/upload`, `GET /bank-transactions` | Empty state ("Sem movimentos"), import success toast, import error toast, table with data |
| **Reconciliar** | Reconciliation run and results | Action button, result toast, match-grid cards | `POST /reconcile`, `GET /reconciliations` | Empty state, running (button disabled + spinner), matches found, no new matches info |
| **IVA** | VAT reporting | Bar chart, monthly table (Mês / Docs / Total / IVA) | `GET /dashboard/monthly` | Empty state ("Sem dados de IVA"), data table |

### Global chrome elements

- **Sidebar** (fixed 240 px): Logo, 4 main nav buttons + IVA, section labels, status dot "Sistema operacional"
- **Topbar** (sticky, blur backdrop): Page title (changes per tab), status pill (✓ ok / N por reconciliar)
- **Summary bar** (below topbar): 5 inline stats — documents, faturado €, movimentos, reconciliados, por reconciliar

---

## 7. Wireframe Logic by Key Screen

### 7.1 Dashboard

```
┌──────────────────────────────────────────────────────────────────┐
│ Sidebar │ Topbar: "Dashboard"                  ● ✓ ok           │
│         ├──────────────────────────────────────────────────────  │
│  [nav]  │  Summary bar: 24 docs | € 48,200 | 31 mov | 20 rec | 4 pend │
│         ├──────────────────────────────────────────────────────  │
│         │  KPI grid (5 cards, responsive row):                  │
│         │  [DOCS 24] [EUR €48k] [BANK 31] [OK 20] [PEND 4]     │
│         │                                                        │
│         │  Charts row (2 panels, side by side):                 │
│         │  ┌─────────────────────┐  ┌────────────────────────┐  │
│         │  │  Donut: 83% rec     │  │  Bar: IVA por mês      │  │
│         │  │  ● Reconciliados    │  │  ████░░░▌ (gold bars)  │  │
│         │  │  ● Pendentes        │  │  Jan Feb Mar Apr…      │  │
│         │  └─────────────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**Layout notes**: 5 KPI cards in a CSS grid, auto-fill at ~160 px min. Charts side-by-side in flex row. Dark surface (`--s1`). KPI accent bars via `data-dot` + `::after` pseudo.

**Critical states**:
- `PEND > 0` → PEND card gets `data-dot="red"`, topbar pill becomes `pill-warn` with count
- `PEND == 0` → pill shows "✓ ok", PEND card is green

---

### 7.2 Faturas Tab

```
┌──────────────────────────────────────────────────────────────────┐
│  [Paperless callout]  Paperless-ngx — OCR automático  [Abrir →] │
├──────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────┐ │
│  │  ↑  Arrasta PDFs aqui ou clica para selecionar             │ │
│  │     Paperless faz OCR (~30s) · extrai NIF, total e IVA     │ │
│  └─────────────────────────────────────────────────────────────┘ │
│  file-row: [icon] filename.pdf ██████████░ 78%  → Enviado ✓     │
│  [OCR banner: ⟳ filename.pdf enviado — Paperless a processar]   │
├──────────────────────────────────────────────────────────────────┤
│  Card: Documentos extraídos   [Actualizar]  [Exportar CSV]      │
│  ┌────┬──────────┬──────────┬──────────┬───────┬─────┬───────┐  │
│  │ ID │Fornecedor│  Cliente │  Total   │  IVA  │Data │ Tipo  │  │
│  ├────┼──────────┼──────────┼──────────┼───────┼─────┼───────┤  │
│  │ #3 │[chip NIF]│[chip NIF]│€ 2.021,74│€ 46.. │2026-│[tag]  │  │
│  └────┴──────────┴──────────┴──────────┴───────┴─────┴───────┘  │
└──────────────────────────────────────────────────────────────────┘
```

**CTA priority**: Dropzone is the primary CTA (large, centered, prominent). "Exportar CSV" is secondary. "Actualizar" is tertiary.
**Empty state**: SVG icon + title "Sem documentos" + sub "Arrasta PDFs para começar".
**Upload states**: pending → progress % → "Enviado ✓" → OCR banner → poll → toast success or banner expires.

---

### 7.3 Reconciliar Tab

```
┌──────────────────────────────────────────────────────────────────┐
│  Cruza automaticamente faturas com movimentos bancários          │
│  [▶ Reconciliar agora]   ← primary green CTA                    │
│  [toast: ✓ 4 correspondências encontradas]                       │
├──────────────────────────────────────────────────────────────────┤
│  Match card (repeating):                                         │
│  ┌──────────────────┬──────┬────────────────────────────────┐   │
│  │ Fatura #12       │  ⇄   │ Movimento #7                   │   │
│  │ [NIF chip]       │ 100% │ € 340,00                       │   │
│  │ € 340,00         │      │ PAGAMENTO FATURA XYZ           │   │
│  │ 2026-02-28       │      │ 2026-02-27                     │   │
│  └──────────────────┴──────┴────────────────────────────────┘   │
└──────────────────────────────────────────────────────────────────┘
```

**UX notes**: Button disabled + spinner while running. Confidence % visually reinforces trust. Arrow (⇄) connects the two entities. Color-coded amounts (green positive, red negative).

---

### 7.4 Navigation model

```
Sidebar (always visible, fixed):
  Principal
    [▣] Dashboard     — loads on init
    [≡] Faturas       — upload + list
    [$] Banco         — CSV import + list
    [⇄] Reconciliar   — action + results
  Relatórios
    [▬] IVA           — chart + table
```

No modal navigation. No nested routes. Tab switching is purely DOM show/hide with fadeUp animation.

---

## 8. MVP Boundary

### MVP-ready (strong enough to ship)

| Capability | Strength |
|-----------|----------|
| PDF ingestion pipeline (dual path) | Fully implemented end-to-end with error handling |
| Bank CSV import | Fully implemented with column validation |
| Reconciliation engine | Fully implemented with tolerance logic; idempotent |
| Dashboard KPIs + charts | Fully implemented; Chart.js; auto-refresh every 30 s |
| Monthly VAT report | Fully implemented as chart + table |
| Document list + CSV export | Fully implemented |
| Upload progress + OCR poll | Fully implemented with 90 s timeout |
| Docker-compose single-command deploy | Fully implemented |
| CI with pytest | Fully implemented; runs on every PR |

### Needed for usable MVP — missing or weak

| Gap | Impact | Recommendation |
|-----|--------|----------------|
| No filter/search UI on document list | As document count grows, list becomes unusable | Add supplier NIF search input + date range pickers above table |
| No document detail view | Operator cannot inspect individual parsed fields or open the PDF | Add click-through to a detail panel/modal that shows all fields + Paperless link |
| Malformed CSV amounts cause unhandled 500 | Operator gets no actionable error | Catch `ValueError`/`InvalidOperation` in `upload_bank_csv` and return 422 |
| OCR poll silent timeout | Operator doesn't know why the banner disappeared | Show a "Tempo de processamento excedido" message after 90 s |
| "000000000" placeholder NIFs not surfaced | Operator cannot tell which documents have bad NIF data | Add visual indicator (e.g. amber warning chip) on NIF "000000000" in table |
| No manual document edit | Operator cannot fix NIF/total extracted incorrectly | Add `PATCH /documents/{id}` + edit form (out-of-scope per `CLAUDE.md` — but UX risk) |
| Paperless link hardcoded to `localhost:8000` | Breaks in production behind a domain | Expose `PAPERLESS_URL` to frontend via config endpoint or build-time env injection |

### Must NOT be included in MVP (repository does not support)

- User registration, login, auth tokens — no implementation, no schema
- Multi-tenancy, workspaces, organizations — explicitly excluded in `CLAUDE.md`
- AT (Autoridade Tributária) integration or SAFT export — excluded
- Email/push notifications — no email service in stack
- ML/AI classification beyond invoice2data regex templates — excluded
- Billing / subscription management — excluded
- Full-text search beyond NIF filter — no FTS index

---

## 9. Gaps, Risks, and Unknowns

### Missing implementation details

| # | Gap | File evidence | Risk |
|---|-----|---------------|------|
| 1 | `Decimal(row["amount"].strip().replace(",","."))` in CSV import will raise on thousands-separator formats (e.g. "1.234,56") | `routes.py:87` | Data integrity — amounts silently wrong or 500 |
| 2 | `POST /reconcile` is O(n²) with no index | `reconcile.py::reconcile_all` nested loop | Performance at scale (> ~10k rows) |
| 3 | Connection pool min_size=2; long-running OCR + webhook surge could exhaust pool | `db.py::get_pool` | Availability under load |
| 4 | `paperless_id UNIQUE` prevents re-ingestion but the `ON CONFLICT DO UPDATE` re-runs on every webhook call | `db.py` schema + `parse.py::ingest_document` | Idempotent but wasteful; not a correctness risk |
| 5 | `validate_nif("999999990") == True` — the test passes but 999999990 is not a real Portuguese NIF prefix | `parse_test.py::test_valid_nif` | Test validity, not production risk |
| 6 | No `PAPERLESS_TOKEN` validation — empty token is silently used | `routes.py`, `parse.py` | Paperless calls will fail with 401 if token not set; error surfaces as 502/5xx to operator |

### Weakly evidenced assumptions

- `invoice_type` field defaults to "invoice" from the template (`pt_invoice.yml: invoice_type: static: invoice`) and "transfer" from the OCR fallback (`parse.py:91`) — the UI shows these as `<span class="tag">` without further classification logic
- `match_confidence` is computed as `1 − amount_diff` which is always in `[0.99, 1.00)` for matched documents; the percentage shown in UI will always be 99–100% — misleading if the operator expects it to reflect holistic confidence

### UX-critical states potentially unsupported

| State | Missing support |
|-------|----------------|
| NIF extracted as "000000000" | No visual warning in UI — chip just shows "000000000" |
| Document already reconciled | No visual indicator in Faturas list |
| Paperless offline | `502` from `upload_document`; toast not shown (only `console.error`) |
| Bank transaction is a credit (positive amount) vs debit (negative) | Reconciliation uses `abs(tx["amount"])` — correct mathematically, but UI coloring may confuse |
| More than 100 documents | Pagination not exposed in UI; only first 100 shown |

### Risks for designing frontend ahead of backend truth

1. The Paperless URL is hardcoded to `http://localhost:8000` in `index.html` — a design system that uses the Paperless link must handle configurable URLs
2. There is no concept of "document status" (processing / failed / ready) beyond polling the doc count — a richer status model would require backend changes
3. No soft-delete or archive — removing a document requires direct DB access

---

## 10. LOVABLE UI/UX MVP HANDOFF

### 1. Product one-liner

> **CC** is a single-operator Portuguese accounting tool that turns PDF invoices and bank CSV exports into a reconciled ledger with real-time VAT reporting — built on Paperless-ngx OCR, FastAPI, and PostgreSQL.

---

### 2. Core user roles

| Role | Description |
|------|-------------|
| **Operator** | The sole user. Uploads PDFs, imports bank CSVs, triggers reconciliation, reads reports, exports. |
| **System** | Paperless post-consume webhook. No human interaction. |

No auth, no roles, no team features.

---

### 3. Top confirmed capabilities

1. PDF drag-and-drop upload → Paperless OCR → structured document record
2. Paperless-native scan auto-ingestion via post-consume webhook
3. Bank statement CSV import (semicolon-delimited, three columns)
4. One-click automatic reconciliation with tolerance matching
5. Dashboard KPI grid + reconciliation donut + monthly VAT bar chart
6. Monthly VAT table (per-month: doc count, total billed, VAT)
7. Document list with supplier/client NIF, total, VAT, date, type
8. Bank transaction list with sign-colored amounts
9. Reconciliation list as matched-pair cards with confidence %
10. CSV export of all documents for external reporting

---

### 4. MVP modules

| Module | Tab | Backend routes |
|--------|-----|----------------|
| **Dashboard** | Dashboard | `GET /dashboard/summary`, `GET /dashboard/monthly` |
| **Faturas** | Faturas | `POST /documents/upload`, `POST /webhook`, `GET /documents`, `GET /export/csv` |
| **Banco** | Banco | `POST /bank-transactions/upload`, `GET /bank-transactions` |
| **Reconciliar** | Reconciliar | `POST /reconcile`, `GET /reconciliations` |
| **IVA** | IVA | `GET /dashboard/monthly` |

---

### 5. Primary navigation structure

```
Sidebar (fixed, 240 px)
├── Principal
│   ├── Dashboard    [rect-grid icon]
│   ├── Faturas      [file icon]
│   ├── Banco        [currency icon]
│   └── Reconciliar  [shuffle icon]
└── Relatórios
    └── IVA          [bar-chart icon]
```

Global chrome: sticky topbar (page title + status pill), summary bar (5 inline stats).

---

### 6. Core screens required

| Screen | Primary components |
|--------|--------------------|
| **Dashboard** | KPI grid (5 cards), donut chart, VAT bar chart, summary bar, topbar status pill |
| **Faturas** | Paperless callout, drag-drop zone, file progress list, OCR banner, documents table, Refresh + Export CSV buttons |
| **Banco** | CSV format instructions, file picker, Import button, bank transactions table |
| **Reconciliar** | "Reconciliar agora" CTA, result toast, match-pair cards |
| **IVA** | VAT bar chart, monthly table |

---

### 7. Top end-to-end user flows

1. **Upload PDF → Document appears** (drag-drop → XHR progress → OCR poll → doc in table)
2. **Import bank CSV → Movements appear** (file picker → upload → toast → table)
3. **Reconcile → Matches visualised** (button click → spinner → toast → match cards)
4. **Monitor fiscal health** (open app → dashboard loads → auto-refreshes every 30 s)
5. **Export for accountant** (Exportar CSV → browser download)

---

### 8. Key tables / cards / forms / components

| Component | Used in | Notes |
|-----------|---------|-------|
| KPI card (`data-dot` accent bar) | Dashboard | 5 instances; dot colour: blue/green/red/neutral |
| Donut chart (Chart.js) | Dashboard | Reconciled vs pending; centre label shows % |
| Bar chart (Chart.js) | Dashboard, IVA | Gold gradient bars; VAT by month |
| Summary bar | All tabs (global) | 5 inline stats with pipe dividers |
| Drag-drop upload zone | Faturas | Click or drag; PDF only; multi-file |
| File progress row | Faturas | XHR progress bar + status label per file |
| OCR banner | Faturas | Spinner + filename; auto-dismissed on doc count change or 90 s |
| Documents table | Faturas | NIF chips, mono amounts, type badge |
| Bank transactions table | Banco | Sign-colored amounts |
| Match-grid card | Reconciliar | Two-column (invoice / transaction) + confidence % |
| Monthly IVA table | IVA | Mês / Docs / Total / IVA |
| Toast messages | All tabs | ok (green) / err (red) / info (blue) variants |
| Empty states | All list views | SVG icon + title + subtitle per entity type |
| Paperless callout | Faturas | External link; hardcoded `localhost:8000` |

---

### 9. Critical empty / loading / error / success states

| State | Where | Trigger | Current treatment |
|-------|-------|---------|-------------------|
| Empty documents | Faturas table | No docs in DB | Empty state component with upload CTA |
| Empty bank movements | Banco table | No txs imported | Empty state with CSV import CTA |
| Empty reconciliations | Reconciliar | No matches run yet | Empty state with reconcile CTA |
| Empty IVA | IVA tab | No documents | Empty state |
| Loading (initial) | All tabs | Before API responds | Dashes `—` in KPI/summary bar |
| Upload progress | Faturas | XHR in flight | Progress bar width % |
| OCR in progress | Faturas | After upload accepted | Animated spinner banner |
| OCR timeout (90 s) | Faturas | Poll expires | Banner disappears silently ⚠ — **UX gap** |
| CSV import success | Banco | After `/bank-transactions/upload` | Green toast with count |
| CSV import error | Banco | Column mismatch | Red toast (unhandled ValueError → 500 ⚠) |
| Reconcile success | Reconciliar | `matched > 0` | Green toast with count |
| Reconcile no-match | Reconciliar | `matched == 0` | Info (blue) toast |
| Paperless offline | Faturas upload | 502 from proxy | ⚠ `console.error` only — no user-facing toast |
| ✓ ok badge | Topbar | `unmatched == 0` | Green pill |
| N por reconciliar | Topbar | `unmatched > 0` | Amber/red pill with count |

---

### 10. Features that must NOT be invented in the MVP unless later confirmed

> These have **zero evidence** in the repository and would add unwarranted complexity.

- User login / registration / password reset
- Multi-tenant workspaces or organisation management
- Role-based permissions (admin / viewer / editor)
- AT / SAFT / eFatura integration
- Email, Slack, or push notification delivery
- AI/ML document classification beyond invoice2data regex
- Subscription plans or billing management
- Full-text document search or Elasticsearch integration
- Document versioning or edit history
- Scheduled / cron-based auto-reconciliation
- Cloud storage integration (S3, GCS)
- Native mobile app — the web UI does have responsive breakpoints (`web/style.css` at 960 px and 520 px), but a dedicated mobile app is not implemented
