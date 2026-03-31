"""Invoice lifecycle API routes — series, CRUD, finalize, void, payments."""

import datetime
import logging
from decimal import Decimal
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import HTMLResponse
from pydantic import BaseModel

from app.auth import AuthInfo, require_auth
from app.db import get_conn, log_activity

logger = logging.getLogger(__name__)

router = APIRouter()


class InvoiceSeriesCreate(BaseModel):
    series_code: str
    document_type: str = "FT"
    atcud_validation_code: str = ""


class InvoiceLineIn(BaseModel):
    description: str
    quantity: str | float = "1"
    unit_price: str | float = "0"
    discount_pct: str | float = "0"
    vat_rate: str | float = "23"
    snc_account: str = ""


class InvoiceCreate(BaseModel):
    series_id: int
    customer_id: int | None = None
    customer_name: str = ""
    customer_nif: str = ""
    issue_date: str
    due_date: str | None = None
    notes: str = ""
    withholding_tax_pct: str | float = "0"
    lines: list[InvoiceLineIn]


class InvoiceUpdate(BaseModel):
    customer_id: int | None = None
    customer_name: str | None = None
    customer_nif: str | None = None
    issue_date: str | None = None
    due_date: str | None = None
    notes: str | None = None
    withholding_tax_pct: str | float | None = None
    lines: list[InvoiceLineIn] | None = None


class PaymentCreate(BaseModel):
    amount: str
    payment_date: str
    method: str = ""
    reference: str = ""
    notes: str = ""


def _calc_line(ln: InvoiceLineIn) -> dict:
    qty = Decimal(str(ln.quantity))
    price = Decimal(str(ln.unit_price))
    disc = Decimal(str(ln.discount_pct))
    vat_rate = Decimal(str(ln.vat_rate))
    subtotal = (qty * price * (Decimal("100") - disc) / Decimal("100")).quantize(Decimal("0.01"))
    vat_amount = (subtotal * vat_rate / Decimal("100")).quantize(Decimal("0.01"))
    total = subtotal + vat_amount
    return {
        "description": ln.description, "quantity": qty, "unit_price": price,
        "discount_pct": disc, "vat_rate": vat_rate, "subtotal": subtotal,
        "vat_amount": vat_amount, "total": total, "snc_account": ln.snc_account,
    }


def _invoice_select_cols() -> str:
    return """i.id, i.tenant_id, i.series_id, i.number, i.document_type, i.atcud,
              i.customer_id, i.customer_name, i.customer_nif,
              i.issue_date, i.due_date,
              i.subtotal, i.vat_total, i.total, i.withholding_tax, i.net_total,
              i.currency, i.notes, i.status,
              i.finalized_at, i.voided_at, i.created_at,
              s.series_code"""


def _row_to_invoice(row: dict) -> dict:
    inv = dict(row)
    inv["series_code"] = inv.pop("series_code", "")
    num = inv.get("number", 0)
    sc = inv.get("series_code", "")
    inv["display_number"] = f"{sc}/{num}" if sc else str(num)
    return inv


def _fetch_invoice(conn: Any, invoice_id: int, tenant_id: str) -> dict | None:
    row = conn.execute(
        f"""SELECT {_invoice_select_cols()}
              FROM invoices i
              JOIN invoice_series s ON s.id = i.series_id
             WHERE i.id = %s AND i.tenant_id = %s""",
        (invoice_id, tenant_id),
    ).fetchone()
    if not row:
        return None
    inv = _row_to_invoice(row)
    lines = conn.execute(
        """SELECT id, invoice_id, line_number, description, quantity, unit_price,
                  discount_pct, vat_rate, subtotal, vat_amount, total, snc_account
             FROM invoice_lines WHERE invoice_id = %s AND tenant_id = %s
             ORDER BY line_number""",
        (invoice_id, tenant_id),
    ).fetchall()
    inv["lines"] = [dict(ln) for ln in lines]
    return inv


def _compute_payment_status(conn: Any, invoice_id: int, tenant_id: str) -> tuple[str, Decimal]:
    payments = conn.execute(
        "SELECT COALESCE(SUM(amount), 0) AS paid FROM invoice_payments WHERE invoice_id = %s AND tenant_id = %s",
        (invoice_id, tenant_id),
    ).fetchone()
    paid = Decimal(str(payments["paid"]))
    inv = conn.execute(
        "SELECT net_total, status FROM invoices WHERE id = %s AND tenant_id = %s",
        (invoice_id, tenant_id),
    ).fetchone()
    net = Decimal(str(inv["net_total"]))
    if inv["status"] == "anulada":
        return "voided", paid
    if paid >= net:
        return "paid", paid
    if paid > 0:
        return "partial", paid
    return "unpaid", paid


@router.get("/invoice-series")
def api_list_invoice_series(auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT id, tenant_id, series_code, document_type, current_number,
                      atcud_validation_code, active, created_at
                 FROM invoice_series WHERE tenant_id = %s ORDER BY series_code""",
            (auth.tenant_id,),
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/invoice-series")
def api_create_invoice_series(body: InvoiceSeriesCreate, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO invoice_series (tenant_id, series_code, document_type, atcud_validation_code)
               VALUES (%s, %s, %s, %s)
               RETURNING id, tenant_id, series_code, document_type, current_number,
                         atcud_validation_code, active, created_at""",
            (auth.tenant_id, body.series_code, body.document_type, body.atcud_validation_code),
        ).fetchone()
        log_activity(conn, auth.tenant_id, "invoice_series", row["id"], "create", body.series_code)
        conn.commit()
    return dict(row)


@router.get("/invoices")
def api_list_invoices(
    status: str | None = None,
    document_type: str | None = None,
    customer_id: int | None = None,
    date_from: str | None = None,
    date_to: str | None = None,
    search: str | None = None,
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    with get_conn() as conn:
        sql = f"""SELECT {_invoice_select_cols()}
                    FROM invoices i
                    JOIN invoice_series s ON s.id = i.series_id
                   WHERE i.tenant_id = %s"""
        params: list[object] = [auth.tenant_id]
        if status:
            sql += " AND i.status = %s"
            params.append(status)
        if document_type:
            sql += " AND i.document_type = %s"
            params.append(document_type)
        if customer_id is not None:
            sql += " AND i.customer_id = %s"
            params.append(customer_id)
        if date_from:
            sql += " AND i.issue_date >= %s"
            params.append(date_from)
        if date_to:
            sql += " AND i.issue_date <= %s"
            params.append(date_to)
        if search:
            sql += " AND (i.customer_name ILIKE %s OR i.customer_nif ILIKE %s OR CAST(i.number AS TEXT) ILIKE %s)"
            like = f"%{search}%"
            params.extend([like, like, like])
        sql += " ORDER BY i.issue_date DESC, i.id DESC LIMIT %s OFFSET %s"
        params.extend([limit, offset])
        rows = conn.execute(sql, tuple(params)).fetchall()
    return [_row_to_invoice(r) for r in rows]


@router.get("/invoices/summary")
def api_invoice_summary(year: int | None = None, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        sql_filter = " AND EXTRACT(YEAR FROM i.issue_date) = %s" if year else ""
        base_params: list[object] = [auth.tenant_id]
        if year:
            base_params.append(year)
        by_status = conn.execute(
            f"""SELECT i.status, COUNT(*) AS cnt, COALESCE(SUM(i.total), 0) AS total_amount
                  FROM invoices i WHERE i.tenant_id = %s{sql_filter}
                 GROUP BY i.status""",
            tuple(base_params),
        ).fetchall()
        by_type = conn.execute(
            f"""SELECT i.document_type, COUNT(*) AS cnt, COALESCE(SUM(i.total), 0) AS total_amount
                  FROM invoices i WHERE i.tenant_id = %s{sql_filter}
                 GROUP BY i.document_type""",
            tuple(base_params),
        ).fetchall()
    return {"by_status": [dict(r) for r in by_status], "by_type": [dict(r) for r in by_type]}


@router.get("/invoices/aged-receivables")
def api_aged_receivables(auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT {_invoice_select_cols()}
                  FROM invoices i
                  JOIN invoice_series s ON s.id = i.series_id
                 WHERE i.tenant_id = %s AND i.status = 'emitida'
                 ORDER BY i.due_date""",
            (auth.tenant_id,),
        ).fetchall()

        today = datetime.date.today()
        buckets: dict[str, dict] = {
            "current": {"items": [], "total": Decimal("0")},
            "overdue_1_30": {"items": [], "total": Decimal("0")},
            "overdue_31_60": {"items": [], "total": Decimal("0")},
            "overdue_61_90": {"items": [], "total": Decimal("0")},
            "overdue_90_plus": {"items": [], "total": Decimal("0")},
        }
        total_outstanding = Decimal("0")

        for row in rows:
            inv = _row_to_invoice(row)
            payment_status, paid = _compute_payment_status(conn, inv["id"], auth.tenant_id)
            net = Decimal(str(inv["net_total"]))
            outstanding = net - paid
            if outstanding <= 0:
                continue

            due = inv.get("due_date")
            if due:
                due_date = datetime.date.fromisoformat(due) if isinstance(due, str) else due
                days_overdue = (today - due_date).days
            else:
                days_overdue = 0

            item = {
                "id": inv["id"], "number": inv["number"],
                "document_type": inv["document_type"],
                "customer_name": inv["customer_name"],
                "customer_nif": inv["customer_nif"],
                "issue_date": str(inv["issue_date"]),
                "due_date": str(inv.get("due_date", "")),
                "net_total": str(net), "amount_paid": str(paid),
                "payment_status": payment_status,
                "series_code": inv.get("series_code", ""),
                "outstanding": str(outstanding),
                "days_overdue": max(0, days_overdue),
            }
            total_outstanding += outstanding

            if days_overdue <= 0:
                buckets["current"]["items"].append(item)
                buckets["current"]["total"] += outstanding
            elif days_overdue <= 30:
                buckets["overdue_1_30"]["items"].append(item)
                buckets["overdue_1_30"]["total"] += outstanding
            elif days_overdue <= 60:
                buckets["overdue_31_60"]["items"].append(item)
                buckets["overdue_31_60"]["total"] += outstanding
            elif days_overdue <= 90:
                buckets["overdue_61_90"]["items"].append(item)
                buckets["overdue_61_90"]["total"] += outstanding
            else:
                buckets["overdue_90_plus"]["items"].append(item)
                buckets["overdue_90_plus"]["total"] += outstanding

    result: dict[str, Any] = {k: {"items": v["items"], "total": str(v["total"])} for k, v in buckets.items()}
    result["total_outstanding"] = str(total_outstanding)
    return result


@router.get("/invoices/{invoice_id}")
def api_get_invoice(invoice_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        inv = _fetch_invoice(conn, invoice_id, auth.tenant_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    return inv


@router.post("/invoices")
def api_create_invoice(body: InvoiceCreate, auth: AuthInfo = Depends(require_auth)):
    if not body.lines:
        raise HTTPException(status_code=400, detail="At least one line is required")

    with get_conn() as conn:
        series = conn.execute(
            "SELECT id, series_code, document_type, current_number, atcud_validation_code FROM invoice_series WHERE id = %s AND tenant_id = %s",
            (body.series_id, auth.tenant_id),
        ).fetchone()
        if not series:
            raise HTTPException(status_code=404, detail="Invoice series not found")

        next_num = series["current_number"] + 1
        conn.execute(
            "UPDATE invoice_series SET current_number = %s WHERE id = %s AND tenant_id = %s",
            (next_num, body.series_id, auth.tenant_id),
        )

        calculated_lines = [_calc_line(ln) for ln in body.lines]
        subtotal = sum(ln["subtotal"] for ln in calculated_lines)
        vat_total = sum(ln["vat_amount"] for ln in calculated_lines)
        total = subtotal + vat_total
        wh_pct = Decimal(str(body.withholding_tax_pct))
        withholding = (subtotal * wh_pct / Decimal("100")).quantize(Decimal("0.01"))
        net_total = total - withholding

        atcud_code = series["atcud_validation_code"] or ""
        atcud = f"{atcud_code}-{next_num}" if atcud_code else ""

        customer_name = body.customer_name
        customer_nif = body.customer_nif
        if body.customer_id:
            cust = conn.execute(
                "SELECT name, nif FROM customers WHERE id = %s AND tenant_id = %s",
                (body.customer_id, auth.tenant_id),
            ).fetchone()
            if cust:
                customer_name = customer_name or cust["name"]
                customer_nif = customer_nif or cust["nif"]

        inv_row = conn.execute(
            """INSERT INTO invoices
               (tenant_id, series_id, number, document_type, atcud,
                customer_id, customer_name, customer_nif,
                issue_date, due_date,
                subtotal, vat_total, total, withholding_tax, net_total,
                currency, notes, status)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, 'rascunho')
               RETURNING id""",
            (auth.tenant_id, body.series_id, next_num, series["document_type"], atcud,
             body.customer_id, customer_name, customer_nif,
             body.issue_date, body.due_date,
             subtotal, vat_total, total, withholding, net_total,
             "EUR", body.notes),
        ).fetchone()
        invoice_id = inv_row["id"]

        for i, ln in enumerate(calculated_lines, 1):
            conn.execute(
                """INSERT INTO invoice_lines
                   (invoice_id, tenant_id, line_number, description, quantity, unit_price,
                    discount_pct, vat_rate, subtotal, vat_amount, total, snc_account)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                (invoice_id, auth.tenant_id, i, ln["description"], ln["quantity"], ln["unit_price"],
                 ln["discount_pct"], ln["vat_rate"], ln["subtotal"], ln["vat_amount"], ln["total"], ln["snc_account"]),
            )

        log_activity(conn, auth.tenant_id, "invoice", invoice_id, "create", f"{series['series_code']}/{next_num}")
        conn.commit()
        inv = _fetch_invoice(conn, invoice_id, auth.tenant_id)
    return inv


@router.patch("/invoices/{invoice_id}")
def api_patch_invoice(invoice_id: int, body: InvoiceUpdate, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id, status FROM invoices WHERE id = %s AND tenant_id = %s",
            (invoice_id, auth.tenant_id),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if existing["status"] != "rascunho":
            raise HTTPException(status_code=400, detail="Only draft invoices can be edited")

        updates: list[str] = []
        params: list[object] = []
        for field in ("customer_id", "customer_name", "customer_nif", "issue_date", "due_date", "notes"):
            val = getattr(body, field, None)
            if val is not None:
                updates.append(f"{field} = %s")
                params.append(val)

        if body.lines is not None:
            calculated_lines = [_calc_line(ln) for ln in body.lines]
            subtotal = sum(ln["subtotal"] for ln in calculated_lines)
            vat_total = sum(ln["vat_amount"] for ln in calculated_lines)
            total = subtotal + vat_total
            wh_pct_val = Decimal(str(body.withholding_tax_pct)) if body.withholding_tax_pct is not None else Decimal("0")
            withholding = (subtotal * wh_pct_val / Decimal("100")).quantize(Decimal("0.01"))
            net_total = total - withholding

            updates.extend(["subtotal = %s", "vat_total = %s", "total = %s", "withholding_tax = %s", "net_total = %s"])
            params.extend([subtotal, vat_total, total, withholding, net_total])

            conn.execute("DELETE FROM invoice_lines WHERE invoice_id = %s AND tenant_id = %s", (invoice_id, auth.tenant_id))
            for i, ln in enumerate(calculated_lines, 1):
                conn.execute(
                    """INSERT INTO invoice_lines
                       (invoice_id, tenant_id, line_number, description, quantity, unit_price,
                        discount_pct, vat_rate, subtotal, vat_amount, total, snc_account)
                       VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)""",
                    (invoice_id, auth.tenant_id, i, ln["description"], ln["quantity"], ln["unit_price"],
                     ln["discount_pct"], ln["vat_rate"], ln["subtotal"], ln["vat_amount"], ln["total"], ln["snc_account"]),
                )

        if updates:
            params.extend([invoice_id, auth.tenant_id])
            conn.execute(
                f"UPDATE invoices SET {', '.join(updates)} WHERE id = %s AND tenant_id = %s",
                tuple(params),
            )

        log_activity(conn, auth.tenant_id, "invoice", invoice_id, "update", "")
        conn.commit()
        inv = _fetch_invoice(conn, invoice_id, auth.tenant_id)
    return inv


@router.post("/invoices/{invoice_id}/finalize")
def api_finalize_invoice(invoice_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id, status FROM invoices WHERE id = %s AND tenant_id = %s",
            (invoice_id, auth.tenant_id),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if existing["status"] != "rascunho":
            raise HTTPException(status_code=400, detail="Only draft invoices can be finalized")

        now = datetime.datetime.now(datetime.UTC)
        conn.execute(
            "UPDATE invoices SET status = 'emitida', finalized_at = %s WHERE id = %s AND tenant_id = %s",
            (now, invoice_id, auth.tenant_id),
        )
        log_activity(conn, auth.tenant_id, "invoice", invoice_id, "finalize", "")
        conn.commit()
        inv = _fetch_invoice(conn, invoice_id, auth.tenant_id)
    return inv


@router.post("/invoices/{invoice_id}/void")
def api_void_invoice(invoice_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id, status FROM invoices WHERE id = %s AND tenant_id = %s",
            (invoice_id, auth.tenant_id),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if existing["status"] == "anulada":
            raise HTTPException(status_code=400, detail="Invoice already voided")

        now = datetime.datetime.now(datetime.UTC)
        conn.execute(
            "UPDATE invoices SET status = 'anulada', voided_at = %s WHERE id = %s AND tenant_id = %s",
            (now, invoice_id, auth.tenant_id),
        )
        log_activity(conn, auth.tenant_id, "invoice", invoice_id, "void", "")
        conn.commit()
        inv = _fetch_invoice(conn, invoice_id, auth.tenant_id)
    return inv


@router.delete("/invoices/{invoice_id}")
def api_delete_invoice(invoice_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id, status FROM invoices WHERE id = %s AND tenant_id = %s",
            (invoice_id, auth.tenant_id),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if existing["status"] != "rascunho":
            raise HTTPException(status_code=400, detail="Only draft invoices can be deleted")

        conn.execute("DELETE FROM invoice_lines WHERE invoice_id = %s AND tenant_id = %s", (invoice_id, auth.tenant_id))
        conn.execute("DELETE FROM invoice_payments WHERE invoice_id = %s AND tenant_id = %s", (invoice_id, auth.tenant_id))
        conn.execute("DELETE FROM invoices WHERE id = %s AND tenant_id = %s", (invoice_id, auth.tenant_id))
        log_activity(conn, auth.tenant_id, "invoice", invoice_id, "delete", "")
        conn.commit()
    return {"ok": True}


@router.get("/invoices/{invoice_id}/html")
def api_invoice_html(invoice_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        inv = _fetch_invoice(conn, invoice_id, auth.tenant_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    dn = inv.get("display_number", "")
    lines_html = ""
    for ln in inv.get("lines", []):
        lines_html += f"<tr><td>{ln['description']}</td><td class='r'>{ln['quantity']}</td><td class='r'>{ln['unit_price']}</td><td class='r'>{ln['vat_rate']}%</td><td class='r'>{ln['subtotal']}</td><td class='r'>{ln['total']}</td></tr>"
    html = f"<!DOCTYPE html><html><head><meta charset='utf-8'><title>Fatura {dn}</title></head><body><h1>Fatura {dn}</h1><p>Data: {inv['issue_date']}</p><p>Cliente: {inv['customer_name']} (NIF: {inv['customer_nif']})</p><table><thead><tr><th>Desc</th><th>Qtd</th><th>Preco</th><th>IVA</th><th>Subtotal</th><th>Total</th></tr></thead><tbody>{lines_html}</tbody></table><p>Subtotal: {inv['subtotal']} | IVA: {inv['vat_total']} | Total: {inv['total']}</p></body></html>"
    return HTMLResponse(content=html)


@router.get("/invoices/{invoice_id}/payments")
def api_list_payments(invoice_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        inv = conn.execute(
            "SELECT id FROM invoices WHERE id = %s AND tenant_id = %s",
            (invoice_id, auth.tenant_id),
        ).fetchone()
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        rows = conn.execute(
            """SELECT id, invoice_id, tenant_id, amount, payment_date, method, reference, notes, created_at
                 FROM invoice_payments WHERE invoice_id = %s AND tenant_id = %s
                 ORDER BY payment_date""",
            (invoice_id, auth.tenant_id),
        ).fetchall()
        payment_status, paid = _compute_payment_status(conn, invoice_id, auth.tenant_id)
    result = [dict(r) for r in rows]
    for r in result:
        r["payment_status"] = payment_status
        r["amount_paid"] = str(paid)
    return result


@router.post("/invoices/{invoice_id}/payments")
def api_create_payment(invoice_id: int, body: PaymentCreate, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        inv = conn.execute(
            "SELECT id, status FROM invoices WHERE id = %s AND tenant_id = %s",
            (invoice_id, auth.tenant_id),
        ).fetchone()
        if not inv:
            raise HTTPException(status_code=404, detail="Invoice not found")
        if inv["status"] not in ("emitida", "rascunho"):
            raise HTTPException(status_code=400, detail="Cannot add payment to this invoice")
        row = conn.execute(
            """INSERT INTO invoice_payments
               (invoice_id, tenant_id, amount, payment_date, method, reference, notes)
               VALUES (%s, %s, %s, %s, %s, %s, %s)
               RETURNING id, invoice_id, tenant_id, amount, payment_date, method, reference, notes, created_at""",
            (invoice_id, auth.tenant_id, Decimal(body.amount), body.payment_date, body.method, body.reference, body.notes),
        ).fetchone()
        log_activity(conn, auth.tenant_id, "invoice_payment", row["id"], "create", f"invoice={invoice_id}")
        conn.commit()
    return dict(row)


@router.delete("/invoices/{invoice_id}/payments/{payment_id}")
def api_delete_payment(invoice_id: int, payment_id: int, auth: AuthInfo = Depends(require_auth)):
    with get_conn() as conn:
        existing = conn.execute(
            "SELECT id FROM invoice_payments WHERE id = %s AND invoice_id = %s AND tenant_id = %s",
            (payment_id, invoice_id, auth.tenant_id),
        ).fetchone()
        if not existing:
            raise HTTPException(status_code=404, detail="Payment not found")
        conn.execute(
            "DELETE FROM invoice_payments WHERE id = %s AND tenant_id = %s",
            (payment_id, auth.tenant_id),
        )
        log_activity(conn, auth.tenant_id, "invoice_payment", payment_id, "delete", f"invoice={invoice_id}")
        conn.commit()
    return {"ok": True}


@router.get("/export/saft")
def api_saft_export(year: int = Query(...), month: int | None = None, auth: AuthInfo = Depends(require_auth)):
    from app.saft import generate_saft_xml
    with get_conn() as conn:
        xml = generate_saft_xml(auth.tenant_id, conn, year, month)
    from fastapi.responses import Response
    return Response(content=xml, media_type="application/xml",
                    headers={"Content-Disposition": f"attachment; filename=SAFT-PT-{year}{f'-{month:02d}' if month else ''}.xml"})
