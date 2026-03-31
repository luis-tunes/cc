---
description: "Scaffold a new FastAPI route with auth, tenant isolation, and DB query pattern."
agent: "agent"
argument-hint: "Describe the endpoint: method, path, what it does"
---
Create a new FastAPI route following TIM conventions:

1. Read [routes.py](../../app/routes.py) to find where to add the endpoint
2. Use this exact pattern:

```python
@router.{method}("/api/{path}")
def endpoint_name(auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        row = conn.execute(
            "SELECT ... FROM {table} WHERE tenant_id = %s",
            (auth.tenant_id,),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="not found")
    return row
```

Rules:
- Always include `tenant_id = %s` in WHERE clause
- Use `require_auth` (or `optional_auth` for public endpoints)
- Parameterize with `%s`, never f-strings
- Add a Pydantic response_model if the route returns structured data
- Add the corresponding test in `app/tests/routes_test.py`
