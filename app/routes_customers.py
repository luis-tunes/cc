"""Customer management API routes."""

import logging

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.auth import AuthInfo, require_auth
from app.db import get_conn, log_activity

logger = logging.getLogger(__name__)

router = APIRouter()


class CustomerCreate(BaseModel):
    name: str
    nif: str = ""
    email: str = ""
    phone: str = ""
    address: str = ""
    postal_code: str = ""
    city: str = ""
    country: str = "PT"
    notes: str = ""


class CustomerPatch(BaseModel):
    name: str | None = None
    nif: str | None = None
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    postal_code: str | None = None
    city: str | None = None
    country: str | None = None
    notes: str | None = None
    active: bool | None = None


@router.get("/customers")
def api_list_customers(
    search: str | None = None,
    active_only: bool = True,
    auth: AuthInfo = Depends(require_auth),
):
    with get_conn() as conn:
        sql = """SELECT id, name, nif, email, phone, address, postal_code, city,
                        country, notes, active, created_at
                   FROM customers WHERE tenant_id = %s"""
        params: list[object] = [auth.tenant_id]
        if active_only:
            sql += " AND active = true"
        if search:
            sql += " AND (name ILIKE %s OR nif ILIKE %s)"
            like = f"%{search}%"
            params.extend([like, like])
        sql += " ORDER BY name"
        rows = conn.execute(sql, tuple(params)).fetchall()
    return [dict(r) for r in rows]


@router.get("/customers/{customer_id}")
def api_get_customer(customer_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        row = conn.execute(
            """SELECT id, name, nif, email, phone, address, postal_code, city,
                      country, notes, active, created_at
                 FROM customers WHERE id = %s AND tenant_id = %s""",
            (customer_id, auth.tenant_id),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="Customer not found")
    return dict(row)


@router.post("/customers")
def api_create_customer(body: CustomerCreate, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO customers
               (tenant_id, name, nif, email, phone, address, postal_code, city, country, notes)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, name, nif, email, phone, address, postal_code, city,
                         country, notes, active, created_at""",
            (auth.tenant_id, body.name, body.nif, body.email, body.phone,
             body.address, body.postal_code, body.city, body.country, body.notes),
        ).fetchone()
        log_activity(conn, auth.tenant_id, "customer", row["id"], "create", body.name)
        conn.commit()
    return dict(row)


@router.patch("/customers/{customer_id}")
def api_patch_customer(customer_id: int, body: CustomerPatch, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM customers WHERE id = %s AND tenant_id = %s",
            (customer_id, auth.tenant_id),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Customer not found")

        updates: list[str] = []
        params: list[object] = []
        for field in ("name", "nif", "email", "phone", "address", "postal_code", "city", "country", "notes", "active"):
            val = getattr(body, field)
            if val is not None:
                updates.append(f"{field} = %s")
                params.append(val)
        if not updates:
            raise HTTPException(status_code=400, detail="No fields to update")

        params.extend([customer_id, auth.tenant_id])
        conn.execute(
            f"UPDATE customers SET {', '.join(updates)} WHERE id = %s AND tenant_id = %s",
            tuple(params),
        )
        conn.commit()
        row = conn.execute(
            """SELECT id, name, nif, email, phone, address, postal_code, city,
                      country, notes, active, created_at
                 FROM customers WHERE id = %s AND tenant_id = %s""",
            (customer_id, auth.tenant_id),
        ).fetchone()
        log_activity(conn, auth.tenant_id, "customer", customer_id, "update", "")
        conn.commit()
    return dict(row)


@router.delete("/customers/{customer_id}")
def api_delete_customer(customer_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM customers WHERE id = %s AND tenant_id = %s",
            (customer_id, auth.tenant_id),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Customer not found")
        conn.execute(
            "DELETE FROM customers WHERE id = %s AND tenant_id = %s",
            (customer_id, auth.tenant_id),
        )
        log_activity(conn, auth.tenant_id, "customer", customer_id, "delete", "")
        conn.commit()
    return {"ok": True}
