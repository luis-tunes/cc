# CC — MVP UI/UX Design Contract

> Source of truth: `PRODUCT_BLUEPRINT.md` + repository code (`app/routes.py`, `web/`).
> Every item below is grounded in implemented or clearly partial backend functionality.
> Treat this as a Lovable frontend contract. Do not add features not listed here.

---

## 1. Product Definition

- **One-line:** Web app that ingests Portuguese invoices, imports bank statements, and reconciles them automatically.
- **Core user:** Portuguese sole trader or micro-business owner — one person, no team.
- **Primary jobs-to-be-done:**
  1. Upload PDF invoices → OCR extracts NIF, total, VAT, date.
  2. Import bank statement CSV → structured movement list.
  3. Run reconciliation → match invoices to bank movements by amount (±€0.01) and date (±5 days).
  4. Review dashboard KPIs, reconciliation rate, monthly VAT chart.
  5. Export document list as CSV.
- **MVP operating model:** Single-user, single-container stack. No auth. Paperless-ngx does OCR asynchronously; UI polls until doc count increases. Bank import is synchronous.

---

## 2. Confirmed MVP Modules

| Module | User goal | Confirmed actions | Backend endpoints | Must-have UI | MVP priority |
|---|---|---|---|---|---|
| Dashboard | Instant status overview | View KPIs, charts | `GET /dashboard/summary`, `GET /dashboard/monthly` | 5 KPI cards, donut chart, bar chart, summary bar | P0 |
| Faturas | Ingest invoices, review extracted data | Upload PDF, refresh list, export CSV, open Paperless | `POST /documents/upload`, `GET /documents`, `GET /export/csv` | Dropzone, progress bar, OCR banner, documents table, export button | P0 |
| Banco | Import bank movements | Upload CSV, view list | `POST /bank-transactions/upload`, `GET /bank-transactions` | CSV upload control, bank transactions table | P0 |
| Reconciliar | Match invoices to movements | Run reconciliation, view matches | `POST /reconcile`, `GET /reconciliations` | Run button, match cards | P0 |
| IVA | Monthly VAT report | View monthly breakdown | `GET /dashboard/monthly` | Monthly table (month, docs, total, VAT) | P1 |

---

## 3. Screen Contract

### Dashboard

- **Purpose:** Instant overview of the accounting state.
- **Primary actions:** None (read-only). Auto-refreshes every 30s.
- **Data shown:**
  - 5 KPI cards: Documentos (count), Total Faturado (€), Movimentos (count), Reconciliados (count), Por Reconciliar (count).
  - Donut chart: Reconciliados vs Pendentes (% in center).
  - Bar chart: IVA mensal — last 12 months (€ per bar).
  - Summary bar: same 5 values as KPIs, persistent across all tabs.
  - Topbar badge: "✓ ok" (green) or "{N} por reconciliar" (amber) based on unmatched count.
- **Required components:** KPI card, donut chart, bar chart, summary bar, topbar badge.
- **Empty states:** KPI cards show "—"; donut renders 0%/100% split; bar chart renders nothing (no bars).
- **Loading states:** KPI cards show "—" until `/dashboard/summary` resolves.
- **Success states:** All values populated from API.
- **Error states:** Console error only; values remain "—". No modal or inline error shown.
- **Unsupported actions:** No edit, no filter, no date picker on dashboard.

---

### Faturas

- **Purpose:** Upload PDF invoices and inspect extracted structured data.
- **Primary actions:**
  1. Drag-and-drop or click to upload one or more PDFs.
  2. Refresh document list.
  3. Export all documents as CSV (`GET /export/csv` → file download).
  4. Open Paperless-ngx in a new tab.
- **Data shown:**
  - Paperless callout at top.
  - Upload dropzone with subtitle explaining OCR delay (~30s).
  - File list with per-file progress bar, status label, and OCR banner.
  - Documents table: ID, Fornecedor (NIF chip), Cliente (NIF chip), Total (€), IVA (€), Data, Tipo.
- **Required components:** Paperless hint callout, dropzone, file row with progress bar, OCR banner, documents table, refresh button, export button.
- **Empty states:** Table shows empty state illustration with "Sem documentos — Arrasta PDFs para começar."
- **Loading states:**
  - Per-file: progress bar fills to 100%; status label shows "A enviar…" then "Enviado ✓".
  - OCR: spinner banner "Paperless a processar OCR … (~30s)" persists until doc count increases or 90s timeout.
- **Success states:**
  - File row: bar turns done colour, status "Enviado ✓".
  - OCR complete: banner replaced by toast "✓ Documento importado com sucesso." (disappears after 5s); table reloads.
- **Error states:**
  - Upload fail: status label shows error detail from API (e.g. "only PDF files accepted"); bar turns red.
  - Network error: status label "Falha de rede".
  - OCR timeout (90s): banner dismissed silently; no explicit error shown to user.
  - Paperless 502: file row shows "paperless rejected: {detail}".
- **Unsupported actions:** No inline edit of extracted data. No delete. No filter on table. No pagination UI (backend supports limit/offset but UI sends no params beyond default 100).

---

### Banco

- **Purpose:** Import bank statement CSV and review movements.
- **Primary actions:**
  1. Choose CSV file.
  2. Click "Importar movimentos" → `POST /bank-transactions/upload`.
- **Data shown:**
  - Instruction text: required columns (`date`, `description`, `amount`), separator (`;`).
  - Bank transactions table: ID, Data, Descrição, Valor (coloured: green positive, red negative).
- **Required components:** File label, import button, feedback toast, bank transactions table.
- **Empty states:** Table shows empty state with "Sem movimentos — Importa um extracto bancário em CSV."
- **Loading states:** None (synchronous import; button not disabled during request — acceptable for MVP).
- **Success states:** Toast "✓ {N} movimentos importados."; table reloads; summary bar updates.
- **Error states:** Toast "Erro: {message}" — e.g. "CSV must have columns: date, description, amount".
- **Unsupported actions:** No date filter UI. No delete. No pagination. No preview before import.

---

### Reconciliar

- **Purpose:** Run automatic matching of invoices to bank movements.
- **Primary actions:**
  1. Click "Reconciliar agora" → `POST /reconcile`.
- **Data shown:**
  - Match cards: each card shows invoice side (ID, NIF, total, date) ↔ movement side (ID, amount, description, date) with confidence %.
- **Required components:** Run button (with loading spinner state), feedback toast/message, match card grid.
- **Empty states:** "Sem reconciliações — Carrega documentos e movimentos, depois clica Reconciliar."
- **Loading states:** Button disabled; label changes to spinner icon + "A reconciliar…".
- **Success states (matches found):** Toast "✓ {N} correspondência(s) encontrada(s)."; match list reloads; summary bar updates.
- **Success states (no new matches):** Info toast "Sem novas correspondências. Verifica valores e datas."
- **Error states:** Toast "Erro: {message}".
- **Unsupported actions:** No manual match override. No unmatch. No confidence threshold control.

---

### IVA

- **Purpose:** Monthly VAT report — read-only reference for the user's tax obligations.
- **Primary actions:** None (read-only). Loaded on tab switch.
- **Data shown:**
  - Monthly table: Mês (YYYY-MM), Docs (count), Total (€), IVA (€ in amber).
  - Last 12 months, descending.
- **Required components:** Table.
- **Empty states:** "Sem dados de IVA — Carrega faturas para ver resumo mensal."
- **Loading states:** Empty until `/dashboard/monthly` resolves.
- **Success states:** Table populated.
- **Error states:** Console error; table stays empty.
- **Unsupported actions:** No date range filter. No download. No chart on this screen (chart lives on Dashboard).

---

## 4. Shared Components Contract

| Component | Used on | Purpose | Inputs/data | States | Notes |
|---|---|---|---|---|---|
| KPI Card | Dashboard | Single metric with label and coloured accent bar | tag (string), value (string), label (string), dot colour (blue/green/red/neutral) | default, red (unmatched > 0) | `data-dot` attr drives `::after` CSS accent |
| Donut Chart | Dashboard | Reconciliation rate | reconciliations (int), unmatched_documents (int) | loaded, zero (all unmatched), full (all reconciled) | Chart.js doughnut, 76% cutout, % in center |
| Bar Chart | Dashboard | Monthly VAT | rows [{month, vat}] | loaded, empty (no bars rendered) | Chart.js bar, gradient fill, responsive |
| Summary Bar | All tabs | Persistent top-of-content metrics | Same as `/dashboard/summary` | loaded, refreshing (silent) | 5 items separated by dividers |
| Topbar Badge | All tabs | Reconciliation alert | unmatched_documents (int) | ok (green "✓ ok"), warn (amber "{N} por reconciliar") | Pill shape |
| Dropzone | Faturas | PDF upload trigger | — | default, drag-over (highlighted border), uploading | Click or drag |
| File Row | Faturas | Per-file upload status | filename, progress (0–100%), status label | pending, uploading, done (green), fail (red) | XHR progress event drives bar width |
| OCR Banner | Faturas | OCR in-progress indicator | filename | visible (spinner + text), dismissed (removed from DOM) | Shown on upload accept; removed on doc count increase or 90s timeout |
| Toast | Faturas, Banco, Reconciliar | Transient feedback message | text, type (ok/err/info) | visible, auto-dismissed (5s for ok type) | `.toast.ok`, `.toast.err`, `.toast.info` |
| Documents Table | Faturas | Extracted invoice data | list of DocumentOut | populated, empty | NIF as chip (monospace); amounts in monospace |
| Bank Transactions Table | Banco | Bank movements | list of BankTransactionOut | populated, empty | Amount coloured: green if ≥0, red if <0 |
| Match Card | Reconciliar | Invoice ↔ movement pair | reconciliation row with joined doc + tx fields | single state | Two-column layout with ⇄ arrow and confidence % |
| Empty State | Faturas, Banco, Reconciliar, IVA | No-data placeholder | icon key, title, subtitle | — | SVG icon + title + subtitle |
| Paperless Hint | Faturas | Callout linking to Paperless-ngx | PAPERLESS_URL (hardcoded to `http://localhost:8000` in dev) | — | External link, opens in new tab |

---

## 5. Navigation Contract

**Sidebar structure:**
```
Principal
  ├─ Dashboard    (grid icon)
  ├─ Faturas      (document icon)
  ├─ Banco        (currency icon)
  └─ Reconciliar  (shuffle icon)

Relatórios
  └─ IVA          (bar chart icon)

Footer: status dot + "Sistema operacional"
```

**Topbar logic:**
- Sticky, `backdrop-filter: blur(20px)`.
- Left: page title (updates on tab switch from `TAB_TITLES` map).
- Right: reconciliation badge (pill; green "✓ ok" or amber "{N} por reconciliar").
- No breadcrumbs, no user menu, no settings icon.

**Summary bar logic:**
- Rendered below topbar, above tab content on all screens.
- Populated from `GET /dashboard/summary` on load and every 30s.
- Also refreshed after successful import or reconcile.
- Content: `documentos | faturado | movimentos | reconciliados | por reconciliar`.
- "Por reconciliar" value coloured red if > 0, green if 0.

**Tab switching behaviour:**
- Click sidebar button → removes `active` from all panes, adds to target pane.
- Triggers data load for the newly active tab:
  - `faturas` → `loadDocs()`
  - `banco` → `loadTxs()`
  - `reconciliar` → `loadRecs()`
  - `iva` → `loadMonthly()`
- Pane enters with `fadeUp` animation (≤250ms).

**Responsive behaviour:**
- No confirmed responsive design in current implementation.
- Do not add breakpoints or mobile nav unless backend changes — see §7B.

---

## 6. UX State Contract

### Initial Load
- **Trigger:** Page load (`DOMContentLoaded`).
- **Backend support:** `GET /dashboard/summary` + `GET /dashboard/monthly`.
- **UI treatment:** KPI values show "—"; bar is empty; summary bar shows "—". Both requests fire in parallel.
- **Copy:** No user-visible loading copy; values replace "—" when ready.

### Empty (no data)
- **Trigger:** API returns empty array.
- **Backend support:** All list endpoints return `[]` when table is empty.
- **UI treatment:** Table slot replaced by empty state (SVG icon + title + subtitle).
- **Copy per screen:** "Sem documentos — Arrasta PDFs para começar" / "Sem movimentos — Importa um extracto bancário em CSV" / "Sem reconciliações — Carrega documentos e movimentos, depois clica Reconciliar" / "Sem dados de IVA — Carrega faturas para ver resumo mensal".

### Upload In Progress
- **Trigger:** User selects/drops PDF; XHR `upload.progress` fires.
- **Backend support:** `POST /documents/upload` streams to Paperless.
- **UI treatment:** File row progress bar fills 0→100%; status label shows percentage, then "A enviar…" at 100%.
- **Copy:** "{N}%" → "A enviar…" → "Enviado ✓".

### OCR Processing
- **Trigger:** Upload XHR returns 200/202; polling begins.
- **Backend support:** Paperless processes async; `/dashboard/summary` doc count increases when done.
- **UI treatment:** OCR banner with spinner: "{filename} enviado — Paperless a processar OCR". Below: "O documento aparece abaixo assim que estiver pronto (~30s)". Polling every 3s.
- **Copy:** Exactly as above. Do not show a progress bar for OCR — duration is unknown.

### OCR Timeout
- **Trigger:** 90 seconds elapsed since upload accepted; doc count has not increased. Timer is hardcoded in `web/app.js` (`pollForNewDoc`, `> 90000` ms check).
- **Backend support:** None — UI-side timer only.
- **UI treatment:** Banner silently removed. No error toast.
- **Copy:** None. User can manually click "Actualizar" to check.

### Import Success
- **Trigger:** Poll detects doc count increased (PDF) or import API returns `imported > 0` (CSV).
- **Backend support:** Count change via `GET /dashboard/summary`; CSV count in `POST /bank-transactions/upload` response.
- **UI treatment:** OCR banner removed; toast "✓ Documento importado com sucesso." (PDF) or "✓ {N} movimentos importados." (CSV). Toast disappears after 5s. Table and summary bar refresh.
- **Copy:** As above.

### Import Error
- **Trigger:** XHR non-200 status (PDF) or API returns 4xx/5xx (CSV).
- **Backend support:** 422 for bad PDF, 502 if Paperless rejects, 422 for bad CSV columns.
- **UI treatment:** File row status label shows error detail (PDF). Toast "Erro: {message}" (CSV).
- **Copy:** Raw `detail` from API response. Do not normalise copy — backend messages are descriptive.

### Reconcile Running
- **Trigger:** User clicks "Reconciliar agora".
- **Backend support:** `POST /reconcile` is synchronous; response contains match list.
- **UI treatment:** Button disabled; label replaces with spinner icon + "A reconciliar…".
- **Copy:** "A reconciliar…".

### Reconcile Success
- **Trigger:** `POST /reconcile` returns `matched > 0`.
- **Backend support:** Confirmed.
- **UI treatment:** Toast "✓ {N} correspondência(s) encontrada(s)."; match list reloads; summary bar refreshes.
- **Copy:** "✓ {N} correspondência(s) encontrada(s)."

### No Matches Found
- **Trigger:** `POST /reconcile` returns `matched = 0`.
- **Backend support:** Confirmed — engine simply finds nothing.
- **UI treatment:** Info toast (not an error): "Sem novas correspondências. Verifica valores e datas."
- **Copy:** Exactly as above. Do not use red/error styling.

### Paperless Unavailable
- **Trigger:** `POST /documents/upload` returns 502 or network error.
- **Backend support:** 502 returned by `/documents/upload` when Paperless is down.
- **UI treatment:** File row status label shows "paperless rejected: {detail}" or "Falha de rede". No retry button.
- **Copy:** Raw API detail.

### Table Overflow / Pagination Absence
- **Trigger:** More than 100 rows returned (backend default `limit=100`).
- **Backend support:** Limit/offset supported on all list endpoints but UI sends no pagination params.
- **UI treatment:** Table scrolls vertically within its container. No pagination controls rendered.
- **Copy:** None. Do not add "Showing 1–100 of N" unless backend is wired.

### Degraded Parsed Data (NIF 000000000)
- **Trigger:** invoice2data and regex fallback could not extract a valid NIF.
- **Backend support:** `000000000` stored as placeholder; confirmed in `parse.py`.
- **UI treatment:** NIF chip renders `000000000` in monospace, no special warning. No validation indicator.
- **Copy:** None. Do not flag it visually unless a future backend field indicates parse quality.

---

## 7. Build-Now vs Do-Not-Build

### A. Build Now (confirmed backend truth)

- **Dashboard:** 5 KPI cards from `GET /dashboard/summary`. Donut from reconciliations/unmatched ratio. Bar chart from `GET /dashboard/monthly`.
- **Summary bar:** 5 metrics, persistent, updates on import/reconcile.
- **Topbar badge:** Derived from `unmatched_documents`; two states (ok / warn).
- **Faturas tab:** Dropzone (PDF upload via XHR), per-file progress bar, OCR banner + 3s polling up to 90s, documents table (7 columns), Paperless callout + external link, refresh button, export CSV button.
- **Banco tab:** CSV file picker, import button, success/error toast, bank transactions table (4 columns).
- **Reconciliar tab:** Single run button with loading state, success/info/error toast, match card list.
- **IVA tab:** Monthly table (4 columns, last 12 months, amber VAT column). Bar chart lives on Dashboard only.
- **Empty states:** All 4 list screens.
- **Toast feedback:** ok / err / info variants on Faturas, Banco, Reconciliar.
- **Navigation:** Sidebar with 5 items in 2 groups; no router, tab switching via JS class toggle.
- **Global 30s auto-refresh:** `loadSummary()` + `loadMonthly()` on timer.

### B. Do Not Build Unless Backend Changes

- **Authentication / login screen:** No auth in backend.
- **Search / filter UI on tables:** Backend supports filter params but UI does not use them; no filter controls.
- **Pagination controls:** Backend supports limit/offset; UI does not paginate.
- **Edit or delete for documents/transactions:** No PUT/DELETE endpoints exist.
- **Manual reconciliation override:** No endpoint to create or delete individual reconciliations by hand.
- **OCR progress indicator beyond polling:** Paperless provides no progress webhook.
- **Settings / configuration screen:** No settings endpoints.
- **Notifications / email / alerts:** No backend support.
- **Multi-user / roles:** No auth, no user model.
- **AT portal / SAFT export:** Explicitly out of scope.
- **Mobile responsive layout:** Not required; no breakpoints confirmed.
- **Dark/light theme toggle:** Dark only; no theme switching logic.
- **NIF validation warning in UI:** Backend stores `000000000` silently; no parse-quality signal in API response.
- **Paperless URL configuration in UI:** Hardcoded in backend env; not a UI concern.
- **Retry on OCR timeout:** No re-upload endpoint; user must upload again.
- **Invoice detail drill-down screen:** `GET /documents/{id}` exists but no UI uses it.
- **Reconciliation confidence threshold control:** Fixed in backend (amount < 0.01, dates ≤ 5 days).

---

## 8. Lovable Handoff

### Sitemap

```
/ (Dashboard)
├─ /faturas
├─ /banco
├─ /reconciliar
└─ /iva
```

No nested routes. Single-page app with tab switching — no actual URL routing required.

### Screen Order to Generate

1. **Shell + Navigation** — sidebar, topbar, summary bar (static placeholders).
2. **Dashboard** — KPI cards, donut chart, bar chart wired to `GET /dashboard/summary` and `GET /dashboard/monthly`.
3. **Faturas** — Paperless callout, dropzone, file rows, OCR banner, documents table.
4. **Banco** — CSV upload, bank transactions table.
5. **Reconciliar** — Run button, match cards.
6. **IVA** — Monthly table.
7. **Empty states + toasts** — across all screens.
8. **Global auto-refresh + badge** — 30s timer, badge logic.

### Top Reusable Components

1. `KpiCard` — tag, value, label, dot colour.
2. `EmptyState` — icon key, title, subtitle.
3. `Toast` — text, type (ok/err/info), auto-dismiss.
4. `FileRow` — filename, progress (0–100%), status.
5. `MatchCard` — doc side, tx side, confidence.
6. `SummaryBar` — 5 metric slots.
7. `DataTable` — column headers + row renderer (used for docs, transactions, IVA).

### Design Principles

- **Dark theme only.** Base `#0d0d0d`. Surfaces (all in `web/style.css`): `--s0 #141414` (sidebar) → `--s1 #1a1a1a` (cards) → `--s2 #202020` (table headers, inputs) → `--s3 #282828` (hover, active row) → `--s4 #303030` (elevated).
- **Text:** `--t0 #ffffff` (headings, key values, 21:1) / `--t1 #dcdcdc` (body, 12:1) / `--t2 #aaaaaa` (muted labels, 7:1) / `--t3 #777777` (placeholders/disabled). WCAG AA.
- **Accent:** `--a #ffcc33` (gold, primary CTA). `--teal #33bfb3` (reconciled/green). `--pink #ff3366` (errors/red). `--amber #ffcc33` (VAT highlight).
- **Borders:** `--b0 rgba(255,255,255,.05)` / `--b1 .09` / `--b2 .14` / `--b3 .22`.
- **KPI accent bar:** `::after` pseudo, coloured left border, driven by `data-dot="blue|green|red"`.
- **Icons:** SVG stroke only. `stroke-width: 1.75`. `stroke-linecap: round`. `stroke-linejoin: round`. No emojis, no icon font.
- **Typography:** Inter for all text. `SF Mono` / `ui-monospace` for NIFs and amounts.
- **Animations:** `fadeUp` on tab enter. `slideDown` on banners. `pulse` on badge. `spin` on spinner. All ≤250ms except `spin`.
- **Topbar:** `backdrop-filter: blur(20px)`, sticky.
- **No build tools.** Chart.js via CDN. Vanilla JS. No framework.
- **Language:** UI copy in Portuguese. Code, comments in English.

### Strict "Must Not Invent" List

- Authentication of any kind.
- Edit or delete flows for any entity.
- Search or filter controls on any table.
- Pagination controls.
- Multi-user, roles, or permissions.
- Notifications or alerts beyond in-page toasts.
- Settings or configuration screens.
- AT, SAFT, or any tax-portal integration.
- Mobile responsive or adaptive layouts.
- Light theme or theme switcher.
- NIF validity warning indicators.
- Manual reconciliation matching.
- Confidence threshold configuration.
- Invoice detail page (even though `GET /documents/{id}` exists).
- Any state or flow not described in §3 or §6.
