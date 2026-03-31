---
name: testing
description: "Use when writing or fixing pytest tests for TIM backend. Knows FakeConn mock, conftest patterns, coverage gate, CI constraints. Use for: debugging test failures, adding coverage, understanding mock setup, fixing CI red."
---
# TIM Testing

## Test Stack
- **pytest** with `TestClient(app)` from FastAPI
- **In-memory FakeConn** — no real PostgreSQL needed. See `app/tests/conftest.py`.
- **Coverage gate: 70%** — adding untested code can break CI even if tests pass.
- Test files: `thing_test.py`, not `test_thing.py`

## How FakeConn Works

`conftest.py` provides a `FakeConn` that intercepts all `conn.execute(sql, params)` calls. It pattern-matches `sql_lower` to route to per-table handlers.

**Handlers:** `_handle_documents`, `_handle_bank_transactions`, `_handle_reconciliations`, `_handle_tenant_settings`, `_handle_classification_rules`, `_handle_movement_rules`, `_handle_alerts`, `_handle_assets`, `_handle_suppliers`, `_handle_ingredients`, `_handle_stock_events`, `_handle_products`, `_handle_recipe_ingredients`, `_handle_price_history`, `_handle_unit_families`, `_handle_unit_conversions`, `_handle_tenant_plans`, `_handle_admin_tenants`, `_handle_admin_metrics`, `_handle_admin_churn_risk`, `_handle_aggregate`, `_handle_webhook_events`

The `_clean_db_and_patch` fixture (autouse) patches `get_conn` in EVERY module:
- `app.routes`, `app.billing`, `app.db`, `app.reconcile`, `app.parse`, `app.classify`, `app.alerts`, `app.classify_movements`, `app.assistant`

### Adding support for new tables

If you add a new table and tests fail with unhandled SQL:
1. Add the table name to `ALL_TABLES` in conftest.py
2. Add a `_handle_{table}` method to `FakeConn`
3. Handle `INSERT`, `SELECT`, `UPDATE`, `DELETE` patterns
4. If the module is new, add it to the patch list in `_clean_db_and_patch`

## Test Patterns

```python
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app, raise_server_exceptions=False)

# Basic route test
def test_list_things():
    r = client.get("/api/things")
    assert r.status_code == 200
    assert isinstance(r.json(), list)

# Test with mocked external dep
@patch("app.routes._extract_with_vision", return_value={...})
def test_upload(mock_vision):
    r = client.post("/api/upload", files={"file": ("f.pdf", b"%PDF", "application/pdf")})
    assert r.status_code == 200
```

## CI Gotchas

- **No Postgres in CI.** `bin/test` sets `DATABASE_URL` to `localhost:5432` but CI has no Postgres service. Tests work because `FakeConn` patches `get_conn` before any real connection happens. If your test somehow bypasses FakeConn, CI will fail.
- **Coverage gate is 70%.** Count your lines. A new 100-line module with 0 tests can drop coverage below the threshold.
- **Python 3.11 in CI.** Don't use 3.12-only features (like `type` keyword for type aliases).
- **Frontend builds before tests.** `npm run build` catches TypeScript errors before vitest runs.

## Running Tests

```bash
make test                                    # full suite (backend + frontend)
python -m pytest app/tests/routes_test.py -v # one file
python -m pytest app/tests/ -k "test_upload" # by name
python -m pytest app/tests/ -x --tb=short    # stop on first failure
```

## Debugging Failures

1. **Read the traceback** — find the exact line in the test AND the module
2. **Check SQL routing** — is the SQL pattern handled in FakeConn? Search for `sql_lower` patterns
3. **Check patches** — is `get_conn` patched in the module your code imports from?
4. **Check auth** — `AUTH_DISABLED=1` is set by conftest. `tenant_id="dev-tenant"`.
5. **Run with full trace** — `python -m pytest app/tests/ -x --tb=long -s`
6. **Capture output** — `make test > /tmp/test.log 2>&1` then grep for `FAILED`, `ERROR`, `assert`
3. Check if the module is patched in `_clean_db_and_patch`
4. Run with `-x --tb=long` for full context
