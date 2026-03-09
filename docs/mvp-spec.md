# CC — Lovable-Ready MVP Product Specification

> **Blueprint for AI-generated UI/UX.**
> Based exclusively on repository-evidenced functionality.
> All section numbers correspond to the required structure.

---

## 1. Product Summary

**CC** is a single-user Portuguese accounting tool that automates the receipt, parsing, and bank reconciliation of fiscal invoices (*faturas*).

Documents arrive via **Paperless-ngx** (OCR), are parsed by **invoice2data** using a Portuguese invoice template, stored in PostgreSQL, and then matched against uploaded bank statement entries using an amount-and-date tolerance algorithm. A vanilla-JS single-page app (dark theme, Portuguese UI) provides the only user-facing interface.

**Core value proposition:** eliminate manual bookkeeping — drop a PDF, upload a bank CSV, click reconcile, done.

**Tech surface visible to the UI:**
- REST API on `http://localhost:8080`
- 9 endpoints (webhook, document upload/list/detail, bank upload/list, reconcile, reconciliation list, dashboard summary/monthly, CSV export)
- No authentication layer in front of the UI (single-admin, local deployment)

---

## 2. MVP Scope

Everything the current codebase already does, expressed as user-visible features:

| # | Feature | Entry point |
|---|---------|-------------|
| 1 | Upload PDF invoice → OCR → auto-parse → store | `POST /documents/upload` |
| 2 | View and filter invoice list | `GET /documents` |
| 3 | Upload bank statement CSV (`;`-delimited) | `POST /bank-transactions/upload` |
| 4 | View bank transaction list | `GET /bank-transactions` |
| 5 | Run automatic reconciliation (amount ±0.01 €, date ±5 days) | `POST /reconcile` |
| 6 | View reconciliation results (confidence %) | `GET /reconciliations` |
| 7 | Dashboard: 5 KPIs + donut + 12-month bar chart | `GET /dashboard/summary` + `GET /dashboard/monthly` |
| 8 | IVA (VAT) monthly summary table | `GET /dashboard/monthly` |
| 9 | Export all documents as CSV | `GET /export/csv` |
| 10 | System health indicator | `GET /health` |
| 11 | OCR progress feedback (poll until document count increases) | client-side, polls `/dashboard/summary` |
| 12 | Paperless-ngx link (external) | static URL in UI |

---

## 3. Out-of-Scope Items

Do not add or imply these features anywhere in the UI:

- User login, registration, or session management
- Multiple users or roles
- AT (Autoridade Tributária) integration or SAFT export
- Invoice creation or editing
- Direct editing of parsed invoice fields
- Supplier/client contact book
- Manual reconciliation override
- Notifications (email, SMS, push)
- Mobile-native app
- Internationalization beyond Portuguese
- Advanced analytics or forecasting
- ML-based matching
- Payment processing
- Accounts payable/receivable aging reports
- Pagination beyond 1 000 records
- Document preview / PDF viewer inside the app

---

## 4. Primary Personas

### P1 — Portuguese Small-Business Owner / Sole Trader (*Empresário em Nome Individual*)
- **Context:** running a micro-business, receives supplier invoices as PDFs, has a bank account with CSV export
- **Goal:** quickly confirm all invoices are accounted for, see monthly VAT liability, export data for accountant
- **Pain:** manual matching of invoices to bank entries is error-prone and time-consuming
- **Technical level:** comfortable with web apps, not a developer

### P2 — Freelance Accountant (*Contabilista*)
- **Context:** manages accounts for one or a handful of clients using this installation
- **Goal:** verify reconciliation quality, export CSV for AT submissions, spot anomalies (large unmatched amounts)
- **Technical level:** spreadsheet-fluent, not technical

> There is only one user account (Paperless admin). Design for a single authenticated operator.

---

## 5. Navigation Architecture

```
Sidebar (fixed, 240 px)
├── Logo mark: "CC"
├── Section label: PRINCIPAL
│   ├── Dashboard          → #dashboard
│   ├── Faturas            → #faturas
│   ├── Banco              → #banco
│   └── Reconciliar        → #reconciliar
└── Section label: RELATÓRIOS
    └── IVA                → #iva
```

**Active state:** highlighted sidebar button. One pane visible at a time (tab pattern, no routing).

**Topbar (sticky, 60 px):**
- Left: current page title (changes on tab switch)
- Right: status badge — amber pulse `"N por reconciliar"` if unmatched > 0, green `"✓ ok"` if 0

**Summary bar** (below topbar, always visible):
`Documentos [N] | Total [€] | Movimentos [N] | Reconciliados [N] | Por reconciliar [N]`

---

## 6. Screen-by-Screen Requirements

### 6.1 Dashboard (`#dashboard`)

**Purpose:** single-glance operational health.

**Layout:** three stacked regions:
1. **KPI grid** — 5 equal-width cards
2. **Donut chart** — reconciliation percentage
3. **Bar chart** — 12-month VAT/total trend

**Data source:** `GET /dashboard/summary` + `GET /dashboard/monthly`

**Auto-refresh:** every 30 seconds in the background.

---

### 6.2 Faturas / Invoices (`#faturas`)

**Purpose:** upload PDFs and view parsed invoices.

**Layout:** three stacked regions:
1. **Paperless callout** — info box with external link to Paperless-ngx (`http://paperless:8000`)
2. **Upload zone** — drag-drop or click, accepts PDF only
3. **Documents table** — full-width, striped

**Actions available:**
- Upload PDF (triggers OCR pipeline)
- Export CSV (`GET /export/csv`) — download button in table header area

---

### 6.3 Banco / Bank (`#banco`)

**Purpose:** import bank statement and view transactions.

**Layout:** two stacked regions:
1. **CSV upload row** — label + file input button
2. **Bank transactions table** — full-width, striped

**Actions available:**
- Upload CSV file (`;`-delimited, columns: `date`, `description`, `amount`)

---

### 6.4 Reconciliar / Reconcile (`#reconciliar`)

**Purpose:** run matching and view results.

**Layout:** two stacked regions:
1. **Action bar** — single "Reconciliar agora" button
2. **Match grid** — two-column cards (invoice ↔ transaction)

**Actions available:**
- Run reconciliation (`POST /reconcile`)

---

### 6.5 IVA / VAT (`#iva`)

**Purpose:** monthly VAT summary for tax review.

**Layout:** two stacked regions:
1. **Monthly summary table** — month / doc count / total / VAT
2. **Bar chart** — 12-month visualization (same data as dashboard bar)

**Data source:** `GET /dashboard/monthly`

---

## 7. Component Requirements

### 7.1 Sidebar
- Fixed left, 240 px wide, full viewport height
- Logo area at top: `CC` wordmark
- Two nav sections with section labels (`PRINCIPAL`, `RELATÓRIOS`)
- Nav buttons: icon (SVG stroke, 18 px) + label text
- Active button: distinct background fill
- Footer: `"Sistema operacional"` with green status dot

### 7.2 Topbar
- Sticky, 60 px, `backdrop-filter: blur(20 px)`
- Left: page title (`h2`, changes on tab switch)
- Right: status badge pill
  - Green `"✓ ok"` when unmatched = 0
  - Amber pulsing `"N por reconciliar"` when unmatched > 0

### 7.3 Summary Bar
- Single horizontal row, always visible below topbar
- 5 items separated by vertical dividers: `Documentos`, `Total`, `Movimentos`, `Reconciliados`, `Por reconciliar`
- `Por reconciliar` value changes color: green if 0, amber if > 0
- Values update with `loadSummary()` (every 30 s)

### 7.4 KPI Cards (Dashboard)
- 5-column grid (one per KPI: DOCS, EUR, BANK, OK, PEND)
- Each card: colored left-accent bar + tag label + large value
- Accent colors by `data-dot` attribute:
  - `blue` → DOCS, EUR
  - `green` → BANK, OK
  - `red` → PEND

### 7.5 Donut Chart
- Chart.js doughnut, 76% cutout
- Two segments: reconciled (green `#3ddc97`) / pending (red `#f87171`)
- Center label: `"X% reconciliados"`
- Legend below: green pip + "Reconciliados", red pip + "Pendentes"

### 7.6 Bar Chart
- Chart.js bar, last 12 months
- Y-axis: EUR amounts
- X-axis: month labels in Portuguese (`Jan`, `Fev`, `Mar`, …)
- Fill: gradient accent-blue → transparent (`#79a4f7` per CLAUDE.md design tokens)
- Grid lines visible on dark background

### 7.7 Upload Zone (PDF)
- Dashed border rectangle, centered content
- Icon (document SVG) + title (`"Arraste faturas aqui"`) + subtitle (`"ou clique para selecionar"`)
- Accepts `.pdf` only
- On file selected/dropped: shows file list with per-file progress bar (`.fr-bar`)
- Per-file status states: uploading (`"A enviar… N%"`), success (`"✓ Enviado"`), error (red message)

### 7.8 OCR Banner
- Appears after PDF accepted by Paperless
- Fixed position, full-width, prominent (above content)
- Spinner + `"Paperless a processar OCR (~30s)"`
- Polls `GET /dashboard/summary` every 3 s for up to 90 s
- Auto-dismisses when document count increases; shows success toast

### 7.9 CSV Upload Row (Bank)
- `<label>` styled as button + `<input type="file">` (accept `.csv`)
- On file selected: reads content, `POST /bank-transactions/upload`
- Toast: `"N movimentos importados"` (success) or red error message

### 7.10 Match Grid (Reconciliations)
- Card per match: left column (invoice), center (arrow + confidence %), right column (bank transaction)
- Confidence expressed as percentage rounded to 2 decimals
- Empty state if no reconciliations yet

### 7.11 Buttons
| Variant | Usage |
|---------|-------|
| `.btn-primary` | "Reconciliar agora", primary actions |
| `.btn-ghost` | secondary / cancel |
| `.btn-success` | confirmation actions |
| `.btn-paperless` | external Paperless link |
| Loading state | disabled + spinning icon while async operation runs |

### 7.12 Toast Notifications
- Slide-down from topbar, auto-dismiss (~4 s)
- Green: success
- Red: error
- Info: neutral operation result

### 7.13 Paperless Callout
- Info box at top of Faturas tab
- Text: explanation that PDFs uploaded here are sent to Paperless for OCR
- Button: external link to `http://paperless:8000`
- Style: distinct from content cards (border-left accent)

---

## 8. Table/List/Detail Patterns

### 8.1 Documents Table

| Column | Type | Notes |
|--------|------|-------|
| ID | integer | monospace |
| Fornecedor NIF | string (9 digits) | monospace chip badge |
| Cliente NIF | string (9 digits) | monospace chip badge |
| Total | decimal | right-aligned, monospace, `€ N,NN` format |
| IVA | decimal | right-aligned, monospace |
| Data | date | `DD/MM/YYYY` |
| Tipo | string | tag badge (`fatura`, `transfer`, etc.) |

**Source:** `GET /documents`

**Filtering parameters (URL query):** `supplier_nif`, `date_from`, `date_to` — no filter UI in MVP scope, the endpoint supports it.

**Header action:** "Exportar CSV" button → `GET /export/csv` triggers download.

### 8.2 Bank Transactions Table

| Column | Type | Notes |
|--------|------|-------|
| ID | integer | monospace |
| Data | date | `DD/MM/YYYY` |
| Descrição | text | full-width |
| Montante | decimal | right-aligned, pos class (green) or neg class (red) |

**Source:** `GET /bank-transactions`

### 8.3 Monthly IVA Table

| Column | Type | Notes |
|--------|------|-------|
| Mês | string | `Jan 2024` |
| Faturas | integer | count |
| Total | decimal | `€ N,NN` |
| IVA | decimal | amber highlight |

**Source:** `GET /dashboard/monthly`

### 8.4 Reconciliation Match Grid

Each reconciliation is a card with:
- **Left:** invoice ID, supplier NIF chip, total, date
- **Center:** right-arrow icon + confidence percentage
- **Right:** transaction ID, description (truncated), amount, date

**Source:** `GET /reconciliations`

### 8.5 No Detail Screen

There is no document detail screen. `GET /documents/{doc_id}` exists in the API but is not surfaced in the MVP UI.

---

## 9. Form Patterns

### 9.1 PDF Upload
- Input: `<input type="file" accept=".pdf" multiple>`
- Trigger: user drops file(s) on zone or clicks to open file picker
- Submit: automatic on file selection/drop (no explicit submit button)
- Validation: only `.pdf` extension accepted; other files silently ignored
- Feedback: per-file progress bar during XHR upload

### 9.2 CSV Import (Bank)
- Input: `<input type="file" accept=".csv">`
- Trigger: user clicks styled label button
- Submit: automatic on file selection
- Server validates columns (`date`, `description`, `amount`) and delimiter (`;`)
- Feedback: toast on success or error
- Expected CSV format shown as placeholder text: `date;description;amount`

### 9.3 No Other Forms

There are no data-entry forms in the MVP. All data enters the system via:
- PDF upload → Paperless OCR → webhook → parse → DB
- CSV upload → direct DB insert

No manual invoice creation. No manual transaction creation. No NIF input form.

---

## 10. Processing/Status UX Patterns

### 10.1 PDF → OCR Pipeline

| Stage | UX signal |
|-------|-----------|
| File accepted by frontend | Progress bar fills to 100% per file |
| File sent to API (`POST /documents/upload`) | XHR `progress` event drives `.fr-bar` |
| API responds 202 | `"✓ Enviado"` per file |
| OCR banner appears | Full-width fixed banner with spinner + message |
| Polling `GET /dashboard/summary` every 3 s | No visible loader; banner stays |
| Doc count increases (max wait: 90 s) | Banner dismissed, success toast, tables reload |
| Timeout (90 s) | Banner dismissed, neutral message |

### 10.2 Reconciliation

| Stage | UX signal |
|-------|-----------|
| User clicks "Reconciliar agora" | Button disabled + spinning icon + label `"A reconciliar…"` |
| `POST /reconcile` responds | Button re-enabled |
| N matches found | Green toast `"N reconciliações encontradas"` |
| 0 matches | Info toast `"Nenhuma reconciliação encontrada"` |
| Error | Red toast with message |

### 10.3 CSV Import

| Stage | UX signal |
|-------|-----------|
| File selected | Immediate `POST /bank-transactions/upload` |
| Success | Green toast `"N movimentos importados"` |
| Error (wrong format, missing columns) | Red toast with error detail |

### 10.4 Background Refresh

- `GET /dashboard/summary` + `GET /dashboard/monthly` called every 30 s
- No visible loading state during background refresh (silent)
- Topbar badge and summary bar update in place

---

## 11. Empty / Loading / Error / Success States

### 11.1 Empty States

Each table/grid has an empty state with:
- Centered SVG icon (stroke, 48 px) specific to content type
- Primary message in Portuguese
- Optional sub-message

| Screen | Icon | Message |
|--------|------|---------|
| Faturas | document icon | `"Nenhuma fatura importada"` |
| Banco | bank/chart icon | `"Nenhum movimento importado"` |
| Reconciliar | shuffle/arrows icon | `"Sem reconciliações"` |
| IVA | chart bars icon | `"Sem dados de IVA"` |

### 11.2 Loading States

- Initial page load: tables render empty, then populate after first API call
- No skeleton loaders in MVP (vanilla JS, no component library)
- Dashboard KPIs show `"—"` until first `loadSummary()` returns
- Chart canvases remain blank until data arrives

### 11.3 Error States

- All API errors display a red toast with the server error message or a generic fallback
- Network errors: red toast `"Erro de rede — tente novamente"`
- No inline error states within tables (errors are transient toasts)

### 11.4 Success States

- Upload success: `"✓ Enviado"` per-file label in upload zone
- CSV import success: green toast with count
- Reconciliation success: green toast with count + tables reload
- OCR complete: toast + silent table reload

---

## 12. Sample Dashboard Structure

```
┌─────────────────────────────────────────────────────────────────┐
│ Topbar: "Dashboard"                      [✓ ok / N por recon.] │
├─────────────────────────────────────────────────────────────────┤
│ Summary bar: Documentos 42 | Total €18.320,00 | Movimentos 67 | Reconciliados 38 | Por reconciliar 4 │
├─────────────────────────────────────────────────────────────────┤
│ KPI Grid (5 cards)                                              │
│ ┌──────┐ ┌──────────┐ ┌──────┐ ┌──────┐ ┌──────┐             │
│ │ DOCS │ │   EUR    │ │ BANK │ │  OK  │ │ PEND │             │
│ │  42  │ │ €18.320  │ │  67  │ │  38  │ │   4  │             │
│ └──────┘ └──────────┘ └──────┘ └──────┘ └──────┘             │
├────────────────────────┬────────────────────────────────────────┤
│  Donut chart           │  Bar chart (12 months VAT/total)       │
│  90% reconciliados     │  Jan Fev Mar Abr Mai Jun … Dez        │
│  [●green ●red legend]  │  Gold bars with gradient               │
└────────────────────────┴────────────────────────────────────────┘
```

---

## 13. UX Rules for Trust, Clarity, and Operational Efficiency

### Trust
- **Money always in decimal format:** `€ 1.234,56` (Portuguese locale, comma decimal separator)
- **NIFs always in monospace chip badges:** visually distinct from regular text, never truncated
- **Confidence displayed as percentage:** `"98,00%"` not `"0.98"` — human-readable
- **Timestamps in Europe/Lisbon display** (even though stored UTC)
- **Status badge always visible:** user never has to navigate to know reconciliation state
- **Summary bar always visible:** document and transaction counts are always on screen

### Clarity
- **Portuguese UI copy** — no mixed-language labels visible to users
- **Color is never the only differentiator** — icons + color for status
- **Amounts right-aligned** with consistent column width — easy vertical scanning
- **Type badges for document type** — not raw strings
- **Per-file progress bars** during upload — user knows each file's individual status
- **OCR banner replaces ambiguity** — "processing" is explicit, not silent

### Operational Efficiency
- **Drag-drop upload** — no file picker required (but click-to-select also works)
- **Auto-refresh every 30 s** — no manual page reload needed
- **One-click reconciliation** — single button, no configuration
- **One-click CSV export** — immediate download
- **Lazy tab loading** — tables only load when their tab is opened
- **Toast notifications auto-dismiss** — no modal confirmations needed for non-destructive actions

---

## 14. Design Constraints Inferred from the Backend

| Constraint | Source | UI implication |
|------------|--------|----------------|
| NIF is exactly 9 digits, mod-11 validated | `parse.py:validate_nif()` | Display as fixed-width badge; never allow editing |
| Invalid NIFs stored as `"000000000"` | `parse.py:ingest_document()` | Show `"000000000"` as-is; no special warning in MVP |
| VAT rates are 23%, 13%, or 6% | `CLAUDE.md` | No rate picker; display parsed value only |
| Money stored as `NUMERIC(12,2)` | `db.py` | Display exactly 2 decimal places always |
| Reconciliation tolerance: ±€0.01, ±5 days | `reconcile.py` constants | No configuration UI; tolerances are fixed |
| Confidence score is `1 − amount_diff` | `reconcile.py:reconcile_all()` | Display as `"N,NN%"`, color-code: ≥99% green, 95–99% amber, <95% red |
| CSV delimiter is semicolon (`;`) | `routes.py:upload_bank_transactions()` | State explicitly in upload hint text |
| CSV columns must be `date`, `description`, `amount` | `routes.py` | State in upload hint text |
| Date stored as `DATE` (no time) | schema | Display as `DD/MM/YYYY` only |
| OCR is asynchronous via Paperless (≈30 s) | architecture | Never imply synchronous; always show OCR banner |
| API rate limits: 1 000 records max | `routes.py` (limit=1000) | No infinite scroll needed; show count in table header |
| No pagination endpoint | `routes.py` | Single-page table load (up to 1 000 rows) |
| Document type is parsed string, not enum | `parse.py` | Display as-is; no filter/sort by type in MVP |
| Paperless runs on port 8000 (internal) | `docker-compose.yml` | Link as `http://paperless:8000` or configurable via env |

---

## 15. Do Not Invent These Features

The following must **not** appear in any generated screen, component, or interaction, because they have no backing in the repository:

- **Login screen, password fields, or session tokens** — there is no authentication layer in the app
- **User profile or settings page** — no user model exists
- **Invoice creation form** — documents only enter via OCR pipeline
- **Manual field editing on parsed invoices** — parsed data is immutable in DB after ingestion
- **Manual reconciliation override or drag-to-match UI** — reconciliation is algorithmic only
- **Supplier or client management screens** — no contact/entity table exists
- **Approval workflows** — no state machine on documents
- **Notification preferences or email configuration** — no notification system exists
- **Date pickers or filter UI on document/transaction lists** — API supports it but no filter UI is built
- **Role-based access control or multi-user indicators** — single user only
- **Document preview or PDF viewer** — no PDF rendering endpoint
- **AT / SAFT export buttons** — no such endpoint exists
- **Multi-currency support** — all amounts are EUR
- **Search bar** — no full-text search endpoint exists
- **Dark/light theme toggle** — dark theme is fixed
- **Chart type switcher** — chart types are fixed (donut + bar)
- **Reconciliation confidence threshold configuration** — hardcoded in backend
- **Webhook URL configuration UI** — internal Docker networking only
- **Audit log or change history** — no audit table in schema
- **Bulk delete or archive actions** — no DELETE endpoints exist
- **Pagination controls** — API returns up to 1 000 records in one call, no page parameter
- **Mobile-specific navigation patterns** (bottom tab bar, hamburger) — desktop-first SPA only
