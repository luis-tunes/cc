---
description: "Use when editing Python backend code: FastAPI routes, database queries, tests, billing, auth, parsing, reconciliation."
applyTo: "app/**/*.py"
---
# Backend Rules

- **DB**: psycopg3 `ConnectionPool` + `dict_row`. Parameterize with `%s`. No ORM.
- **Routes**: `def` handlers (sync). `get_conn()` context manager for DB access.
- **Auth**: Every route uses `require_auth` or `optional_auth`. No exceptions.
- **Pydantic**: At API boundaries only. Internal code uses plain dicts.
- **Tests**: `thing_test.py`, not `test_thing.py`. pytest. Fixtures in `conftest.py`.
- **Money**: `Decimal`. Never `float`. JSON serialize with `str()`.
- **Time**: UTC storage. `Europe/Lisbon` display. `datetime.datetime` with `tzinfo=UTC`.
- **Style**: Type hints on all signatures. mypy must pass. No docstrings on private functions.
- **Pattern**: One function, one job. Extract on third repeat. Errors raise, never return None.
