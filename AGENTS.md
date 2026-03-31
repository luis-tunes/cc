# TIM

Portuguese accounting SaaS. FastAPI + React. PostgreSQL. Docker.

```
make dev     # run (needs .env.production locally)
make test    # pytest + vitest (coverage gate: 70%)
make deploy  # ship to production
```

> **Note:** `CLAUDE.md` is a symlink to `AGENTS.md`. They are the same file.

## Codebase

```
app/                 # FastAPI backend (Python 3.12, psycopg3 sync, raw SQL)
  routes.py          # All API endpoints (APIRouter, ~1400 lines)
  db.py              # Schema + ensure_tables() + ConnectionPool + helpers
  auth.py            # Clerk JWT → AuthInfo(user_id, tenant_id, email)
  billing.py         # Stripe checkout/webhooks + Clerk user webhooks
  parse.py           # Document ingestion, OCR (pdftotext + GPT vision), NIF validation
  reconcile.py       # Bank transaction ↔ document matching engine
  classify.py        # AI-powered document classification
  cache.py           # Optional Redis cache (graceful no-op if unavailable)
  main.py            # App assembly: lifespan, middleware stack, routing
  tests/             # pytest — FakeConn mock, no real DB needed
frontend/src/        # React 18, TypeScript strict, Tailwind, Vite
  pages/             # One file per route (~30 pages)
  components/        # UI components by domain
  hooks/             # Custom hooks (use-*.ts, ~25 hooks)
  lib/api.ts         # API client — ALL backend calls go here
bin/                 # Shell scripts. Source of truth. Makefile calls bin/. CI calls make.
mcp/                 # MCP server — 7 domain-specific tools, stdio transport
```

## How You Work

Read before write. Search before guess. Test before done.

- **Iterate until green.** Run `make test`. Fix failures. Run again. Never stop at red.
- **Debug root causes.** Read tracebacks. Read the failing code. Don't patch symptoms.
- **Non-trivial fix = new test.** If a bug could recur, add a test that catches it.
- **Two failures = rethink.** Same approach failing twice means wrong approach. Step back.
- **Don't ask, do.** Reversible actions (edit, run, read) need no permission.
- **Subagents for exploration.** Use `@reviewer` for audits, `@db` for schema work, `@Explore` for search. Don't clutter the main thread with 20 search calls.

### Context Efficiency

- **Grep first, read second.** For large files (`routes.py` is 1400+ lines), find the line number, then read a targeted range. Never re-read unchanged sections.
- **Capture once, analyze many.** `make test > /tmp/test.log 2>&1` then grep the log. Don't re-run the same tests to see different parts of the output.
- **Batch edits before testing.** Group related changes across files, then run one test cycle. Not test-per-edit.
- **Don't re-fetch.** If you read a file and it hasn't changed, don't read it again.
- **Use `$skill` for deep workflows.** `$testing` for pytest patterns, `$architecture` for domain flows.

### Task Decomposition

1. Understand — read the relevant code
2. Plan — identify the minimal set of changes
3. Implement — make the changes
4. Verify — `make test`, check types
5. If verify fails, go to 2 with new information

## How You Code

- No new dependencies without asking.
- No new files when editing an existing one works.
- No comments on obvious things. No docstrings on private functions.
- No over-engineering. No abstractions for one-time operations.
- Avoid writing large amounts of new code. Look for existing utilities first.
- No ORM. Raw SQL with psycopg3 `%s` params in the module that uses them.
- Errors raise. Don't return None.
- One function, one job. Extract on third repeat.
- Type hints on signatures. mypy must pass.
- Pydantic at API boundaries only.
- Decimal for money. Never float.
- UTC storage. Europe/Lisbon display.
- Test with pytest. `thing_test.py`, not `test_thing.py`.
- Batch DB queries. Never N+1.
- UI text in Portuguese. Code, comments, commits in English.
- `bin/` scripts are source of truth. Makefile calls `bin/`. CI calls `make`.

## Gotchas — Read Before You Break Things

### Auth

- `AUTH_DISABLED=1` in tests → hardcoded `tenant_id="dev-tenant"`, `user_id="dev-user"`. Conftest sets this at import time AND patches the attribute directly.
- Production auth: Clerk JWT → RS256 validation → `AuthInfo`. `tenant_id` = Clerk `org_id` if present, else `user_id`.
- Every route MUST use `require_auth` or `optional_auth`. No exceptions.

### Database

- psycopg3 **sync** (not async). `with get_conn() as conn:` pattern everywhere.
- `ConnectionPool` needs a connectable Postgres at import time for pool init. CI has **no Postgres service** — tests work entirely via `FakeConn` mock that patches `get_conn`.
- New tables: add to `ensure_tables()` in `db.py` AND add `_handle_{table}` to `FakeConn` in `conftest.py` AND add table name to `ALL_TABLES`.

### Cache

- Redis is optional. If down at import time → `_redis_available = False` forever (dead flag, no retry). Code must always handle `cache_get() → None`.
- `cache_set` uses `default=str` for JSON — handles Decimal and datetime automatically.

### Testing

- Coverage gate: **70% minimum**. Adding untested code can break CI even if tests pass.
- `FakeConn` routes SQL by pattern-matching `sql_lower`. Unhandled SQL → KeyError or wrong data.
- Frontend: `npm run build` runs before `npm test` — TypeScript errors caught even without explicit type-check step.
- Use `$testing` skill for FakeConn patterns and debugging workflow.

### Billing

- `MASTER_USER_IDS` env → comma-separated Clerk IDs/emails that always get pro access.
- `TRIAL_DAYS` env → default 14.
- In-memory `_clerk_email_cache` — no TTL, no eviction, process lifetime.

### Docker / Deploy

- `bin/dev` uses `.env.production` (not `.env`). Must exist locally.
- `VITE_CLERK_PUBLISHABLE_KEY` baked at Docker build time, not runtime. Change → full rebuild.
- Paperless healthcheck takes ~2 min → cold deploys wait before app starts.
- `CORS_ORIGINS` env — default only allows localhost. Must set in production.
- `/webhook` (no prefix) exists for backward-compat with Paperless.

### CI

- Python 3.11 in CI (not 3.12). Don't use 3.12-only features.
- Pipeline: `ruff check` → `mypy` → `npm ci` → `make test` → (on main) → ship + deploy.
- No Postgres service container in CI. Everything must mock.

## Specialized Agents

Use agents for context isolation. The main thread orchestrates; agents execute.

- `@reviewer` — Read-only code audit. SQL injection, N+1, tenant isolation, money floats, auth bypass. Returns structured findings.
- `@db` — Schema changes, migrations, SQL queries. Reads `app/db.py` first. Delegates to `@reviewer` after edits.
- `@Explore` — Fast read-only codebase search. Use instead of chaining file reads.

## Specialized Skills

Use skills for conditional, deep workflows. Keep baseline rules in this file.

- `$testing` — FakeConn mock setup, conftest patterns, test debugging workflow.
- `$architecture` — Domain flows: document lifecycle, reconciliation, billing, auth. How data moves through the system.
