# CC

Accounting for Portugal. Docs in → data out → reconcile with bank.

## Dependencies

Only what you can't write in an afternoon:

- Python 3.11
- FastAPI + uvicorn (HTTP)
- psycopg (PostgreSQL driver, no ORM)
- invoice2data (invoice parsing)
- Paperless-ngx (OCR, runs as separate container)
- Docker

No ORM. No SQLAlchemy. No Pandas. No Celery. SQL is the interface to the database.

## How It Flows

```
doc arrives → Paperless (OCR) → post-consume script → curl webhook → parse (invoice2data) → PostgreSQL
```

## Schema

```sql
documents:         supplier_nif, client_nif, total, vat, date, type
bank_transactions: date, description, amount
reconciliations:   document_id, bank_transaction_id, match_confidence
```

## Reconciliation

`abs(total - amount) < 0.01 && abs(dates) <= 5 days`. That's it.

## Layout

```
app/
  main.py
  db.py
  parse.py
  reconcile.py
  routes.py
  pt_invoice.yml
  tests/
web/
  index.html   # HTML shell, no logic
  style.css    # all styles
  app.js       # all JS
bin/
  dev
  test
  clean
  deploy
  post-consume
Makefile
docker-compose.yml
Dockerfile
```

## Run

```
make dev       # local
make test      # tests
make clean     # nuke volumes
make deploy HOST=user@ip  # ship
```

## Won't Do

Multi-tenant. AT integration. SAFT. ML. Complex auth. ORM.

## Rules

- Decimal for money. Never float.
- NIF: 9 digits, mod 11. Validate on input.
- VAT: 23%, 13%, 6%.
- UTC storage. Europe/Lisbon display.
- Type hints on function signatures.
- Pydantic for API request/response only.
- Errors raise. Don't return None.
- No dead code. No TODOs in committed code.
- No unused imports. No dead variables.
- SQL strings in the module that uses them. No query builder.
- Clean up tempfiles. Always unlink.
- Test with pytest. thing_test.py, not test_thing.py.
- One function, one job. Extract on third repeat.
- bin/ scripts are the source of truth. Makefile calls bin/. CI calls make.
- UI text in Portuguese. Code, comments, commits in English.
- Same docker-compose.yml everywhere. Only .env changes.
- .env.example in repo. .env is local, never committed. Server .env created manually.

## UI

- Dark theme. Base `#0d1117`. Surfaces `--s0`…`--s4` (`#161b27`→`#2e3d52`). Never pure black.
- Borders `rgba(255,255,255,.06/.10/.15/.22)`. More visible than old theme.
- Text WCAG AA: `--t0 #e6edf3` / `--t1 #c9d1d9` / `--t2 #8b949e` / `--t3 #586069`.
- Accent `--a #79a4f7` (brighter indigo). Green `#3ddc97`. Red `#f87171`. Amber `#fbbf24`.
- KPI cards: colored left accent bar via `data-dot="blue|green|red"` + `::after` pseudo.
- Upload: XHR with `xhr.upload progress` → `.fr-bar` width. OCR banner `.ocr-banner` + `.ocr-spin` after accept. Poll `/dashboard/summary` every 3s for 90s until doc count increases.
- Paperless link: `.paperless-hint` callout at top of Faturas tab with `.btn-paperless`.
- SVG stroke icons (stroke-width 1.75, stroke-linecap/linejoin round). No emojis.
- Inter font. `SF Mono` / `ui-monospace` for NIFs and amounts.
- Keyframes: `fadeUp` / `slideDown` / `pulse` / `spin`. All ≤250ms except `spin`.
- `backdrop-filter: blur(20px)` on sticky topbar.
- CSS in `web/style.css`. JS in `web/app.js`. `index.html` is a shell only.
- No build tools. Chart.js CDN. Portuguese labels. English code.

## AI

- Don't explain. Don't comment obvious things.
- Don't create files when editing one works.
- Don't guess. Ask.
- Don't add dependencies without asking.
- Paperless at `http://paperless:8000/api/`. Webhook via PAPERLESS_POST_CONSUME_SCRIPT.
- invoice2data templates in `app/` (yml files next to parse.py).
