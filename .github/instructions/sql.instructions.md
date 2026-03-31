---
description: "Use when writing SQL queries, adding tables, or debugging database issues in TIM. Covers psycopg3 patterns, tenant isolation, and FakeConn mock compatibility."
applyTo: ""
---
# SQL Conventions

## Query Pattern

```python
with get_conn() as conn:
    rows = conn.execute(
        """SELECT id, name, total
             FROM documents
            WHERE tenant_id = %s AND status = %s
            ORDER BY created_at DESC
            LIMIT %s OFFSET %s""",
        (auth.tenant_id, status, limit, offset),
    ).fetchall()
```

## Rules

- Always `%s` params. Never f-strings, `.format()`, or concatenation.
- Always `WHERE tenant_id = %s`. No exceptions. Even aggregates.
- Money: `NUMERIC(15,2)` → Python `Decimal`. Never `float`, `REAL`, or `DOUBLE`.
- Timestamps: `TIMESTAMPTZ`. Store UTC. Display `Europe/Lisbon`.
- Batch inserts: `conn.executemany()`. Never loop single inserts.
- `fetchone()` for single row, `fetchall()` for lists. Check None before accessing.
- B-tree index on `(tenant_id, <lookup_column>)` for every table.

## New Table Checklist

1. Add `CREATE TABLE IF NOT EXISTS` to `ensure_tables()` in `app/db.py`
2. Include `tenant_id TEXT NOT NULL` column
3. Add `_handle_{table}` method to `FakeConn` in `app/tests/conftest.py`
4. Add table name to `ALL_TABLES` list in conftest.py
5. Handle `INSERT`, `SELECT`, `UPDATE`, `DELETE` patterns in the handler

## Common Mistakes

- Forgetting `tenant_id` in WHERE → **data leak across tenants**
- Using `LIKE %s` with user input without escaping `%` and `_` chars
- Not handling `fetchone() → None` before accessing columns
- Adding a column without a migration path for existing data
