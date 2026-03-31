# TIM — Copilot Instructions

Portuguese accounting SaaS. FastAPI + React + PostgreSQL.

## Stack

- Backend: Python 3.12, FastAPI, asyncpg, raw SQL (no ORM)
- Frontend: React 18, TypeScript, Tailwind CSS, Vite
- DB: PostgreSQL with multi-tenant isolation via `tenant_id`
- Deploy: Docker, Caddy, GHCR

## Commands

```
make dev     # run locally
make test    # run all tests
make deploy  # deploy to production
```

## Conventions

- Decimal for money. Never float.
- UTC storage. Europe/Lisbon display.
- UI text in Portuguese. Code in English.
- Type hints on all signatures.
- Pydantic at API boundaries only.
- Errors raise, never return None.
- Batch DB queries. Never N+1.
- `bin/` scripts are source of truth. Makefile calls `bin/`. CI calls `make`.
