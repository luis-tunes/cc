# TIM

Portuguese accounting SaaS. FastAPI + React. PostgreSQL. Docker.

```
make dev     # run
make test    # test
make deploy  # ship
```

## Codebase

```
app/                 # FastAPI backend (Python 3.12, psycopg3, raw SQL)
  routes.py          # All API endpoints (APIRouter)
  db.py              # Schema, pool, queries (psycopg3 ConnectionPool)
  auth.py            # JWT auth (require_auth / optional_auth)
  billing.py         # Stripe integration + billing routes
  parse.py           # Document ingestion, OCR, NIF validation
  reconcile.py       # Bank reconciliation engine
  classify.py        # AI classification
  tests/             # pytest (thing_test.py, not test_thing.py)
frontend/src/        # React 18, TypeScript, Tailwind, Vite
  pages/             # One file per route
  components/        # UI components by domain
  hooks/             # Custom hooks (use-*.ts)
  lib/api.ts         # API client — all backend calls go here
bin/                 # Shell scripts. Source of truth. Makefile calls bin/. CI calls make.
mcp/                 # MCP server — domain tools only (7 tools, stdio)
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

Stolen from Next.js — critical for autonomous loops:

- **Grep first, read second.** For large files, find the line number, then read a targeted range. Never re-read unchanged sections.
- **Capture once, analyze many.** `make test > /tmp/test.log 2>&1` then grep the log. Don't re-run the same tests to see different parts of the output.
- **Batch edits before testing.** Group related changes across files, then run one test cycle. Not test-per-edit.
- **Don't re-fetch.** If you read a file and it hasn't changed, don't read it again.

### Task Decomposition

Split work into steps. Verify each step before moving to the next.

1. Understand — read the relevant code
2. Plan — identify the minimal set of changes
3. Implement — make the changes
4. Verify — run tests, check types
5. If verify fails, go to 2 with new information

## How You Code

- No new dependencies without asking.
- No new files when editing an existing one works.
- No comments on obvious things. No docstrings on private functions.
- No over-engineering. No abstractions for one-time operations.
- Avoid writing large amounts of new code. Look for existing utilities first.
- No ORM. SQL strings in the module that uses them.
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

## Specialized Agents

Use agents for context isolation. The main thread orchestrates; agents execute.

- `@reviewer` — Read-only code audit. SQL injection, N+1, tenant isolation, money floats.
- `@db` — Schema changes, migrations, SQL queries. Reads `app/db.py` first.
- `@Explore` — Fast read-only codebase search. Use instead of chaining file reads.
