---
name: testing
description: "Use when writing or fixing pytest tests for TIM backend. Knows FakeConn mock, conftest patterns, and test conventions. Use for: debugging test failures, adding new test coverage, understanding mock setup."
---
# TIM Testing

## Test Stack
- **pytest** with `TestClient(app)` from FastAPI
- **In-memory FakeConn** — no real PostgreSQL needed. See `app/tests/conftest.py`.
- Test files: `thing_test.py`, not `test_thing.py`

## How FakeConn Works

`conftest.py` provides a `FakeConn` that intercepts all `conn.execute(sql, params)` calls. It pattern-matches `sql_lower` to route to per-table handlers (`_handle_documents`, `_handle_bank_transactions`, etc.).

The `_clean_db_and_patch` fixture (autouse) patches `get_conn` in every module that imports it:
- `app.routes`, `app.billing`, `app.db`, `app.reconcile`, `app.parse`, `app.classify`, `app.alerts`, `app.classify_movements`, `app.assistant`

### Adding support for new tables

If you add a new table and tests fail with unhandled SQL:
1. Add the table name to `ALL_TABLES` in conftest.py
2. Add a `_handle_{table}` method to `FakeConn`
3. Handle `INSERT`, `SELECT`, `UPDATE`, `DELETE` patterns

## Test Patterns

```python
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

# Test auth required
def test_unauthorized():
    # conftest patches auth to always pass — to test rejection,
    # patch require_auth to raise HTTPException(401)
    pass
```

## Running Tests

```bash
make test                                    # all tests
python -m pytest app/tests/routes_test.py -v # one file
python -m pytest app/tests/ -k "test_upload" # by name
python -m pytest app/tests/ -x --tb=short    # stop on first failure
```

## Debugging Failures

1. Read the traceback — find the exact line in the test and the module
2. Check if the SQL pattern is handled in FakeConn (`conftest.py`)
3. Check if the module is patched in `_clean_db_and_patch`
4. Run with `-x --tb=long` for full context
