---
description: "Use when editing Python backend code: FastAPI routes, database queries, tests, billing, auth, parsing."
applyTo: "app/**/*.py"
---
# Backend Rules

- Raw SQL strings in the module that uses them. No ORM.
- `async def` for route handlers. `asyncpg` for DB.
- Pydantic models at API boundaries only. Internal code uses plain dicts/dataclasses.
- Test files: `thing_test.py`, not `test_thing.py`. Use pytest.
- Money is `Decimal`. Dates stored as UTC, displayed as `Europe/Lisbon`.
- One function, one job. Extract on third repeat.
- Type hints on all function signatures. mypy must pass.
- No docstrings on private functions. No comments on obvious code.
