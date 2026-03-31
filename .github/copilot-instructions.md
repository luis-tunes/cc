# TIM — Copilot Instructions

Portuguese accounting SaaS. FastAPI + React + PostgreSQL.

## Stack

- Backend: Python 3.12, FastAPI, psycopg3 (ConnectionPool), raw SQL
- Frontend: React 18, TypeScript, Tailwind CSS, Vite
- DB: PostgreSQL with multi-tenant isolation via `tenant_id`
- Deploy: Docker, Caddy, GHCR

## Commands

```
make dev     # run locally
make test    # run all tests (pytest + vitest)
make deploy  # deploy to production
```

## Conventions

- Decimal for money. Never float.
- UTC storage. Europe/Lisbon display.
- UI text in Portuguese. Code in English.
- Type hints on all signatures. mypy must pass.
- Pydantic at API boundaries only.
- Errors raise, never return None.
- Batch DB queries. Never N+1.
- Every table and query includes `tenant_id`.
- `bin/` scripts are source of truth. Makefile calls `bin/`. CI calls `make`.
- Test files: `thing_test.py`, not `test_thing.py`.
- Test files: `thing_test.py`, not `test_thing.py`.
