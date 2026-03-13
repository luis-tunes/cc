"""
Shared test fixtures — unified in-memory DB mock.

All test files import the FakeConn and helpers from here instead of
duplicating ~500 lines of mock infrastructure each.
"""
import os
import pytest
from contextlib import contextmanager
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from unittest.mock import patch

# Ensure auth is disabled for tests
os.environ.setdefault("AUTH_DISABLED", "1")
os.environ.setdefault("DATABASE_URL", "postgresql://cc:cc@localhost:5432/cc")

import app.auth
app.auth.AUTH_DISABLED = True


# ══════════════════════════════════════════════════════════════════════
# ── In-memory DB mock ────────────────────────────────────────────────
# ══════════════════════════════════════════════════════════════════════

ALL_TABLES = (
    "documents", "bank_transactions", "reconciliations",
    "tenant_settings", "tenant_plans",
    "unit_families", "unit_conversions",
    "suppliers", "ingredients", "stock_events",
    "products", "recipe_ingredients",
    "price_history", "supplier_ingredients",
)

ALL_SEQ_TABLES = (
    "documents", "bank_transactions", "reconciliations",
    "unit_families", "unit_conversions",
    "suppliers", "ingredients", "stock_events",
    "products", "recipe_ingredients",
    "price_history",
)

_tables: dict[str, list[dict]] = {}
_seq: dict[str, int] = {}


def reset_db():
    _tables.clear()
    for t in ALL_TABLES:
        _tables[t] = []
    _seq.clear()
    for t in ALL_SEQ_TABLES:
        _seq[t] = 0


def get_tables():
    return _tables


def get_seq():
    return _seq


class FakeCursor:
    """Returned by conn.execute(); holds fetchone/fetchall results."""
    def __init__(self, rows: list[dict]):
        self._rows = rows

    def fetchone(self):
        return self._rows[0] if self._rows else None

    def fetchall(self):
        return self._rows


class FakeConn:
    """Minimal stand-in for a psycopg connection.
    Routes SQL to in-memory table handlers by pattern-matching the SQL string.
    """

    def execute(self, sql: str, params=None):
        sql_lower = sql.strip().lower()

        # ── DDL (CREATE TABLE / ALTER / CREATE INDEX) ──
        if any(k in sql_lower for k in ("create table", "create index", "alter table", "do $$")):
            return FakeCursor([])

        # ── Aggregates first (COUNT/SUM on any table) — before table routing ──
        if sql_lower.startswith("select") and ("count" in sql_lower or ("sum" in sql_lower and "coalesce" in sql_lower)):
            # Only route to aggregate handler for top-level COUNT/SUM queries
            # (not subqueries like "WHERE id NOT IN (SELECT ...)")
            if "from documents" in sql_lower or "from bank_transactions" in sql_lower or "from reconciliations" in sql_lower:
                return self._handle_aggregate(sql, params)

        # ── Tenant plans (billing) ──
        if "tenant_plans" in sql_lower:
            return self._handle_tenant_plans(sql, params)

        # ── Tenant settings ──
        if "tenant_settings" in sql_lower:
            return self._handle_tenant_settings(sql, params)

        # ── Unit conversions (before unit_families) ──
        if "unit_conversions" in sql_lower:
            return self._handle_unit_conversions(sql, params)

        # ── Unit families ──
        if "unit_families" in sql_lower:
            return self._handle_unit_families(sql, params)

        # ── Supplier ingredients (junction — before suppliers) ──
        if "supplier_ingredients" in sql_lower:
            return self._handle_supplier_ingredients(sql, params)

        # ── Price history ──
        if "price_history" in sql_lower:
            return self._handle_price_history(sql, params)

        # ── Recipe ingredients (before products and ingredients) ──
        if "recipe_ingredients" in sql_lower:
            return self._handle_recipe_ingredients(sql, params)

        # ── Stock events ──
        if "stock_events" in sql_lower:
            return self._handle_stock_events(sql, params)

        # ── Products (before ingredients, since some queries touch both) ──
        if "products" in sql_lower and "ingredients" not in sql_lower:
            return self._handle_products(sql, params)

        # ── Ingredients ──
        if "from ingredients" in sql_lower or ("ingredients" in sql_lower and "suppliers" not in sql_lower):
            return self._handle_ingredients(sql, params)
        if "ingredients" in sql_lower and "suppliers" in sql_lower and "from suppliers" not in sql_lower:
            return self._handle_ingredients(sql, params)

        # ── Products (fallback) ──
        if "products" in sql_lower:
            return self._handle_products(sql, params)

        # ── Suppliers ──
        if "suppliers" in sql_lower:
            return self._handle_suppliers(sql, params)

        # ── Ingredients (fallback) ──
        if "ingredients" in sql_lower:
            return self._handle_ingredients(sql, params)

        # ── Reconciliations ──
        # Only route here if the primary FROM is reconciliations, not when it
        # appears only in a subquery (e.g. "NOT IN (SELECT ... FROM reconciliations)")
        if "from reconciliations" in sql_lower and "not in" not in sql_lower:
            return self._handle_reconciliations(sql, params)
        if "into reconciliations" in sql_lower:
            return self._handle_reconciliations(sql, params)

        # ── Bank transactions ──
        if "bank_transactions" in sql_lower:
            return self._handle_bank_transactions(sql, params)

        # ── Documents ──
        if "documents" in sql_lower:
            return self._handle_documents(sql, params)

        # ── Aggregates / fallback ──
        if "count" in sql_lower or "sum" in sql_lower:
            return self._handle_aggregate(sql, params)
        if "to_char" in sql_lower:
            return FakeCursor([])

        return FakeCursor([])

    def commit(self):
        pass

    # ────── Documents ──────

    def _handle_documents(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["documents"] += 1
            doc_id = _seq["documents"]
            doc = {
                "id": doc_id,
                "tenant_id": None,
                "supplier_nif": "",
                "client_nif": "",
                "total": Decimal("0"),
                "vat": Decimal("0"),
                "date": None,
                "type": "outro",
                "filename": None,
                "raw_text": None,
                "status": "pendente",
                "paperless_id": None,
                "created_at": "2025-01-01T00:00:00+00:00",
            }
            if params:
                # Upload route: ('','',0,0,'outro',filename,status,tid) — 8 params
                if len(params) == 8:
                    doc["supplier_nif"] = params[0]
                    doc["client_nif"] = params[1]
                    doc["total"] = Decimal(str(params[2]))
                    doc["vat"] = Decimal(str(params[3]))
                    doc["type"] = params[4]
                    doc["filename"] = params[5]
                    doc["status"] = params[6]
                    doc["tenant_id"] = params[7]
                # ingest_document: (tenant_id, supplier_nif, client_nif, total, vat, date, type, paperless_id, raw_text, status) — 10 params
                elif len(params) == 10:
                    doc["tenant_id"] = params[0]
                    doc["supplier_nif"] = params[1]
                    doc["client_nif"] = params[2]
                    doc["total"] = Decimal(str(params[3]))
                    doc["vat"] = Decimal(str(params[4]))
                    doc["date"] = params[5]
                    doc["type"] = params[6]
                    doc["paperless_id"] = params[7]
                    doc["raw_text"] = params[8]
                    doc["status"] = params[9]
                    # ON CONFLICT (paperless_id) → upsert
                    existing = [d for d in _tables["documents"] if d.get("paperless_id") == params[7]]
                    if existing:
                        existing[0].update(doc)
                        existing[0]["id"] = existing[0]["id"]  # keep original id
                        return FakeCursor([existing[0]])
                # Simple (filename, tid) — 2 params
                elif len(params) == 2:
                    doc["filename"] = params[0]
                    doc["tenant_id"] = params[1]
                    doc["status"] = "a processar"
            _tables["documents"].append(doc)
            return FakeCursor([doc])
        if sql_lower.startswith("update"):
            doc_id = None
            for p in params:
                if isinstance(p, int):
                    doc_id = p
                    break
            if doc_id is None and params:
                doc_id = params[-1]
            doc = next((d for d in _tables["documents"] if d["id"] == doc_id), None)
            if not doc:
                return FakeCursor([])
            set_part = sql.split("SET")[1].split("WHERE")[0]
            field_names = [f.strip().split("=")[0].strip() for f in set_part.split(",")]
            for i, fname in enumerate(field_names):
                if i < len(params):
                    doc[fname] = params[i]
            return FakeCursor([doc])
        if sql_lower.startswith("select"):
            docs = list(_tables["documents"])
            # Filter by primary key — use word boundary to avoid matching tenant_id
            has_id_filter = ("where id = %s" in sql_lower or "and id = %s" in sql_lower)
            if has_id_filter and params:
                doc_id = params[0]
                docs = [d for d in docs if d["id"] == doc_id]
            # Tenant filter — find the correct param index for tenant_id
            if "tenant_id = %s" in sql_lower and params:
                # Find which %s position corresponds to tenant_id = %s
                idx = sql_lower.index("tenant_id = %s")
                tid_pos = sql_lower[:idx].count("%s")
                if has_id_filter:
                    tid_pos = 1  # id = %s is param[0], tenant_id = %s is param[1]
                if tid_pos < len(params):
                    tid = params[tid_pos]
                    docs = [d for d in docs if d.get("tenant_id") == tid]
                docs = [d for d in docs if d.get("tenant_id") == tid]
            # Exclude already reconciled
            if "not in (select document_id from reconciliations)" in sql_lower:
                rec_doc_ids = {r["document_id"] for r in _tables["reconciliations"]}
                docs = [d for d in docs if d["id"] not in rec_doc_ids]
            return FakeCursor(docs)
        return FakeCursor([])

    # ────── Bank transactions ──────

    def _handle_bank_transactions(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["bank_transactions"] += 1
            tx = {
                "id": _seq["bank_transactions"],
                "date": params[0],
                "description": params[1],
                "amount": Decimal(str(params[2])) if not isinstance(params[2], Decimal) else params[2],
                "tenant_id": params[3] if len(params) > 3 else None,
                "created_at": "2025-01-01T00:00:00+00:00",
            }
            _tables["bank_transactions"].append(tx)
            return FakeCursor([tx])
        if sql_lower.startswith("select"):
            txs = list(_tables["bank_transactions"])
            # Exclude already reconciled
            if "not in (select bank_transaction_id from reconciliations)" in sql_lower:
                rec_tx_ids = {r["bank_transaction_id"] for r in _tables["reconciliations"]}
                txs = [t for t in txs if t["id"] not in rec_tx_ids]
            # Tenant filter — find the correct param index
            if "tenant_id = %s" in sql_lower and params:
                idx = sql_lower.index("tenant_id = %s")
                tid_pos = sql_lower[:idx].count("%s")
                if tid_pos < len(params):
                    tid = params[tid_pos]
                    txs = [t for t in txs if t.get("tenant_id") == tid]
            return FakeCursor(txs)
        return FakeCursor([])

    # ────── Reconciliations ──────

    def _handle_reconciliations(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["reconciliations"] += 1
            row = {
                "id": _seq["reconciliations"],
                "document_id": params[0],
                "bank_transaction_id": params[1],
                "match_confidence": Decimal(str(params[2])),
                "tenant_id": params[3] if len(params) > 3 else None,
            }
            # ON CONFLICT DO NOTHING
            existing = [r for r in _tables["reconciliations"]
                        if r["document_id"] == params[0] and r["bank_transaction_id"] == params[1]]
            if not existing:
                _tables["reconciliations"].append(row)
            return FakeCursor([])
        if sql_lower.startswith("select"):
            rows = list(_tables["reconciliations"])
            if "tenant_id = %s" in sql_lower and params:
                tid = params[-1] if params else None
                rows = [r for r in rows if r.get("tenant_id") == tid]
            return FakeCursor(rows)
        return FakeCursor([])

    # ────── Tenant settings ──────

    def _handle_tenant_settings(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("select"):
            tid = params[0] if params else None
            rows = [r for r in _tables["tenant_settings"] if r.get("tenant_id") == tid]
            return FakeCursor(rows)
        if sql_lower.startswith("insert"):
            entry = {"tenant_id": params[0], "key": "entity_profile", "data": params[1]}
            _tables["tenant_settings"] = [r for r in _tables["tenant_settings"] if r.get("tenant_id") != params[0]]
            _tables["tenant_settings"].append(entry)
            return FakeCursor([entry])
        return FakeCursor([])

    # ────── Tenant plans ──────

    def _handle_tenant_plans(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("select"):
            tid = params[0] if params else None
            rows = [r for r in _tables["tenant_plans"] if r.get("tenant_id") == tid]
            return FakeCursor(rows)
        if sql_lower.startswith("insert"):
            now = datetime.now(timezone.utc)
            # Full upsert from billing webhook
            if "on conflict" in sql_lower:
                entry = {
                    "tenant_id": params[0],
                    "plan": "pro",
                    "status": "active",
                    "trial_start": now,
                    "trial_end": now + timedelta(days=14),
                    "stripe_customer": params[1] if len(params) > 1 else None,
                }
                # Upsert: remove existing, add new
                _tables["tenant_plans"] = [r for r in _tables["tenant_plans"] if r.get("tenant_id") != params[0]]
                _tables["tenant_plans"].append(entry)
                return FakeCursor([entry])
            # Simple trial insert
            entry = {
                "tenant_id": params[0],
                "plan": "free",
                "status": "trialing",
                "trial_start": now,
                "trial_end": now + timedelta(days=14),
                "stripe_customer": None,
            }
            _tables["tenant_plans"].append(entry)
            return FakeCursor([entry])
        if sql_lower.startswith("update"):
            # Update by stripe_customer or tenant_id
            if "stripe_customer = %s" in sql_lower:
                customer = params[-1] if params else None
                for plan in _tables["tenant_plans"]:
                    if plan.get("stripe_customer") == customer:
                        plan["plan"] = "free"
                        plan["status"] = "cancelled"
                        return FakeCursor([plan])
            if "tenant_id = %s" in sql_lower:
                tid = params[-1] if params else None
                for plan in _tables["tenant_plans"]:
                    if plan.get("tenant_id") == tid:
                        # Apply updates from SET clause
                        return FakeCursor([plan])
            return FakeCursor([])
        return FakeCursor([])

    # ────── Unit families ──────

    def _handle_unit_families(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["unit_families"] += 1
            row = {"id": _seq["unit_families"], "tenant_id": params[0], "name": params[1], "base_unit": params[2]}
            _tables["unit_families"].append(row)
            return FakeCursor([row])
        if sql_lower.startswith("select"):
            tid = params[0] if params else None
            rows = [f for f in _tables["unit_families"] if f["tenant_id"] == tid]
            return FakeCursor(rows)
        return FakeCursor([])

    def _handle_unit_conversions(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["unit_conversions"] += 1
            row = {"id": _seq["unit_conversions"], "unit_family_id": params[0],
                   "from_unit": params[1], "to_unit": params[2], "factor": Decimal(str(params[3]))}
            _tables["unit_conversions"].append(row)
            return FakeCursor([row])
        if sql_lower.startswith("select"):
            if "any(%s)" in sql_lower or "any (%s)" in sql_lower:
                ids = params[0] if params else []
                rows = [c for c in _tables["unit_conversions"] if c["unit_family_id"] in ids]
                return FakeCursor(rows)
            if "from_unit = %s" in sql_lower and "to_unit = %s" in sql_lower:
                from_u = params[0] if params else None
                to_u = params[1] if len(params) > 1 else None
                rows = [c for c in _tables["unit_conversions"]
                        if c["from_unit"] == from_u and c["to_unit"] == to_u]
                return FakeCursor(rows)
            family_id = params[0] if params else None
            rows = [c for c in _tables["unit_conversions"] if c["unit_family_id"] == family_id]
            return FakeCursor(rows)
        return FakeCursor([])

    # ────── Suppliers ──────

    def _handle_suppliers(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["suppliers"] += 1
            row = {"id": _seq["suppliers"], "tenant_id": params[0], "name": params[1],
                   "nif": params[2], "category": params[3],
                   "avg_delivery_days": params[4], "reliability": Decimal(str(params[5]))}
            _tables["suppliers"].append(row)
            return FakeCursor([row])
        if sql_lower.startswith("update"):
            sid, tid = params[-2], params[-1]
            sup = next((s for s in _tables["suppliers"] if s["id"] == sid and s["tenant_id"] == tid), None)
            if not sup:
                return FakeCursor([])
            set_part = sql.split("SET")[1].split("WHERE")[0]
            field_names = [f.strip().split("=")[0].strip() for f in set_part.split(",")]
            for i, fname in enumerate(field_names):
                if i < len(params) - 2:
                    sup[fname] = params[i]
            return FakeCursor([sup])
        if sql_lower.startswith("delete"):
            sid, tid = params[0], params[1]
            deleted = [s for s in _tables["suppliers"] if s["id"] == sid and s["tenant_id"] == tid]
            _tables["suppliers"] = [s for s in _tables["suppliers"] if not (s["id"] == sid and s["tenant_id"] == tid)]
            return FakeCursor([{"id": sid}] if deleted else [])
        if sql_lower.startswith("select"):
            has_pk = ("where id = %s" in sql_lower or "and id = %s" in sql_lower)
            if has_pk:
                sid = params[0] if params else None
                tid = params[1] if len(params) > 1 else None
                rows = [s for s in _tables["suppliers"] if s["id"] == sid]
                if tid:
                    rows = [s for s in rows if s["tenant_id"] == tid]
                return FakeCursor(rows)
            tid = params[0] if params else None
            rows = [s for s in _tables["suppliers"] if s["tenant_id"] == tid]
            # Apply LIMIT/OFFSET if present in SQL
            if "limit" in sql_lower:
                l = params[1] if len(params) > 1 else len(rows)
                o = params[2] if len(params) > 2 else 0
                rows = rows[o:o + l]
            return FakeCursor(rows)
        return FakeCursor([])

    # ────── Supplier ingredients ──────

    def _handle_supplier_ingredients(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            row = {"supplier_id": params[0], "ingredient_id": params[1]}
            existing = [r for r in _tables["supplier_ingredients"]
                        if r["supplier_id"] == params[0] and r["ingredient_id"] == params[1]]
            if not existing:
                _tables["supplier_ingredients"].append(row)
            return FakeCursor([])
        if sql_lower.startswith("select"):
            if "any(%s)" in sql_lower or "any (%s)" in sql_lower:
                ids = params[0] if params else []
                rows = [r for r in _tables["supplier_ingredients"] if r["supplier_id"] in ids]
                return FakeCursor(rows)
            sid = params[0] if params else None
            rows = [r for r in _tables["supplier_ingredients"] if r["supplier_id"] == sid]
            return FakeCursor(rows)
        return FakeCursor([])

    # ────── Ingredients ──────

    def _handle_ingredients(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["ingredients"] += 1
            row = {"id": _seq["ingredients"], "tenant_id": params[0], "name": params[1],
                   "category": params[2], "unit": params[3],
                   "min_threshold": Decimal(str(params[4])),
                   "supplier_id": params[5],
                   "last_cost": Decimal(str(params[6])),
                   "avg_cost": Decimal(str(params[7]))}
            _tables["ingredients"].append(row)
            return FakeCursor([row])
        if sql_lower.startswith("update"):
            if "avg_cost = %s, last_cost = %s" in sql.lower():
                avg_cost, last_cost, iid = params[0], params[1], params[2]
                ing = next((i for i in _tables["ingredients"] if i["id"] == iid), None)
                if ing:
                    ing["avg_cost"] = avg_cost
                    ing["last_cost"] = last_cost
                return FakeCursor([ing] if ing else [])
            if "last_cost = %s where id = %s" in sql.lower():
                lc, iid = params[0], params[1]
                ing = next((i for i in _tables["ingredients"] if i["id"] == iid), None)
                if ing:
                    ing["last_cost"] = lc
                return FakeCursor([ing] if ing else [])
            iid, tid = params[-2], params[-1]
            ing = next((i for i in _tables["ingredients"] if i["id"] == iid and i["tenant_id"] == tid), None)
            if not ing:
                return FakeCursor([])
            set_part = sql.split("SET")[1].split("WHERE")[0]
            field_names = [f.strip().split("=")[0].strip() for f in set_part.split(",")]
            for i, fname in enumerate(field_names):
                if i < len(params) - 2:
                    ing[fname] = params[i]
            return FakeCursor([ing])
        if sql_lower.startswith("delete"):
            iid, tid = params[0], params[1]
            deleted = [i for i in _tables["ingredients"] if i["id"] == iid and i["tenant_id"] == tid]
            _tables["ingredients"] = [i for i in _tables["ingredients"] if not (i["id"] == iid and i["tenant_id"] == tid)]
            return FakeCursor([{"id": iid}] if deleted else [])
        if sql_lower.startswith("select"):
            if "avg(price)" in sql_lower:
                iid = params[0] if params else None
                prices = [p["price"] for p in _tables["price_history"] if p["ingredient_id"] == iid]
                avg_p = sum(prices) / len(prices) if prices else None
                return FakeCursor([{"avg_price": avg_p}])
            if "left join suppliers" in sql_lower or "supplier_name" in sql_lower:
                tid = params[0] if params else None
                # Find category filter if present
                category_val = None
                if "category = %s" in sql_lower:
                    category_val = params[1] if len(params) > 1 else None
                rows = []
                for ing in _tables["ingredients"]:
                    if ing["tenant_id"] != tid:
                        continue
                    if category_val and ing.get("category") != category_val:
                        continue
                    sup_name = None
                    if ing["supplier_id"]:
                        sup = next((s for s in _tables["suppliers"] if s["id"] == ing["supplier_id"]), None)
                        sup_name = sup["name"] if sup else None
                    rows.append({**ing, "supplier_name": sup_name})
                # Apply LIMIT/OFFSET if present
                if "limit" in sql_lower and len(params) >= 2:
                    l = params[-2] if isinstance(params[-2], int) else len(rows)
                    o = params[-1] if isinstance(params[-1], int) else 0
                    rows = rows[o:o + l]
                return FakeCursor(rows)
            if "where id = %s" in sql_lower or "i.id = %s" in sql_lower:
                iid = params[0] if params else None
                rows = [i for i in _tables["ingredients"] if i["id"] == iid]
                if len(params) > 1:
                    tid = params[1]
                    rows = [i for i in rows if i["tenant_id"] == tid]
                return FakeCursor(rows)
            if "count" in sql_lower:
                tid = params[0] if params else None
                cnt = len([i for i in _tables["ingredients"] if i["tenant_id"] == tid])
                return FakeCursor([{"count": cnt}])
            if "min_threshold > 0" in sql_lower:
                tid = params[0] if params else None
                rows = []
                for ing in _tables["ingredients"]:
                    if ing["tenant_id"] != tid:
                        continue
                    if ing["min_threshold"] <= 0:
                        continue
                    sup_name = None
                    if ing["supplier_id"]:
                        sup = next((s for s in _tables["suppliers"] if s["id"] == ing["supplier_id"]), None)
                        sup_name = sup["name"] if sup else None
                    rows.append({**ing, "supplier_name": sup_name})
                return FakeCursor(rows)
            tid = params[0] if params else None
            rows = [i for i in _tables["ingredients"] if i["tenant_id"] == tid]
            return FakeCursor(rows)
        return FakeCursor([])

    # ────── Stock events ──────

    def _handle_stock_events(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["stock_events"] += 1
            if "'saída'" in sql_lower or "'produção'" in sql_lower:
                row = {"id": _seq["stock_events"], "tenant_id": params[0],
                       "type": "saída", "ingredient_id": params[1],
                       "qty": Decimal(str(params[2])), "unit": params[3],
                       "date": params[4], "source": "produção",
                       "reference": params[5] if len(params) > 5 else "",
                       "cost": None}
            else:
                row = {"id": _seq["stock_events"], "tenant_id": params[0],
                       "type": params[1], "ingredient_id": params[2],
                       "qty": Decimal(str(params[3])), "unit": params[4],
                       "date": params[5], "source": params[6],
                       "reference": params[7] if len(params) > 7 else "",
                       "cost": params[8] if len(params) > 8 else None}
            _tables["stock_events"].append(row)
            return FakeCursor([row])
        if sql_lower.startswith("select"):
            # Batch stock computation: ANY(%s) + GROUP BY ingredient_id
            if ("any(%s)" in sql_lower or "any (%s)" in sql_lower) and "group by" in sql_lower:
                ids = params[0] if params else []
                tid = params[1] if len(params) > 1 else None
                totals: dict[int, Decimal] = {}
                for e in _tables["stock_events"]:
                    if e["ingredient_id"] not in ids:
                        continue
                    if tid and e.get("tenant_id") != tid:
                        continue
                    val = Decimal("0")
                    if e["type"] == "entrada":
                        val = e["qty"]
                    elif e["type"] in ("saída", "desperdício"):
                        val = -e["qty"]
                    elif e["type"] == "ajuste":
                        val = e["qty"]
                    totals[e["ingredient_id"]] = totals.get(e["ingredient_id"], Decimal("0")) + val
                rows = [{"ingredient_id": iid, "stock": stock} for iid, stock in totals.items()]
                return FakeCursor(rows)
            if "coalesce" in sql_lower or "sum" in sql_lower:
                iid = params[0] if params else None
                total = Decimal("0")
                for e in _tables["stock_events"]:
                    if e["ingredient_id"] != iid:
                        continue
                    if len(params) > 1 and e.get("tenant_id") != params[1]:
                        continue
                    if e["type"] == "entrada":
                        total += e["qty"]
                    elif e["type"] in ("saída", "desperdício"):
                        total -= e["qty"]
                    elif e["type"] == "ajuste":
                        total += e["qty"]
                return FakeCursor([{"stock": total}])
            if "count" in sql_lower:
                tid = params[0] if params else None
                rows = [e for e in _tables["stock_events"] if e["tenant_id"] == tid]
                if "entrada" in sql_lower:
                    rows = [e for e in rows if e["type"] == "entrada"]
                elif "saída" in sql_lower or "desperdício" in sql_lower:
                    rows = [e for e in rows if e["type"] in ("saída", "desperdício")]
                return FakeCursor([{"count": len(rows)}])
            tid = params[0] if params else None
            rows = []
            for e in _tables["stock_events"]:
                if e["tenant_id"] != tid:
                    continue
                ing = next((i for i in _tables["ingredients"] if i["id"] == e["ingredient_id"]), None)
                rows.append({**e, "ingredient_name": ing["name"] if ing else "?"})
            return FakeCursor(rows)
        return FakeCursor([])

    # ────── Products ──────

    def _handle_products(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["products"] += 1
            row = {"id": _seq["products"], "tenant_id": params[0], "code": params[1],
                   "name": params[2], "category": params[3],
                   "recipe_version": params[4],
                   "estimated_cost": Decimal(str(params[5])),
                   "pvp": Decimal(str(params[6])),
                   "margin": Decimal(str(params[7])),
                   "active": params[8]}
            _tables["products"].append(row)
            return FakeCursor([row])
        if sql_lower.startswith("update"):
            if "estimated_cost" in sql_lower and "margin" in sql_lower:
                ec, m, pid = params[0], params[1], params[2]
                p = next((p for p in _tables["products"] if p["id"] == pid), None)
                if p:
                    p["estimated_cost"] = ec
                    p["margin"] = m
                return FakeCursor([])
            pid, tid = params[-2], params[-1]
            prod = next((p for p in _tables["products"] if p["id"] == pid and p["tenant_id"] == tid), None)
            if not prod:
                return FakeCursor([])
            set_part = sql.split("SET")[1].split("WHERE")[0]
            field_names = [f.strip().split("=")[0].strip() for f in set_part.split(",")]
            for i, fname in enumerate(field_names):
                if i < len(params) - 2:
                    prod[fname] = params[i]
            return FakeCursor([prod])
        if sql_lower.startswith("delete"):
            pid, tid = params[0], params[1]
            deleted = [p for p in _tables["products"] if p["id"] == pid and p["tenant_id"] == tid]
            _tables["products"] = [p for p in _tables["products"] if not (p["id"] == pid and p["tenant_id"] == tid)]
            return FakeCursor([{"id": pid}] if deleted else [])
        if sql_lower.startswith("select"):
            has_pk = ("where id = %s" in sql_lower or "and id = %s" in sql_lower)
            if "pvp" in sql_lower and has_pk and "code" not in sql_lower:
                pid = params[0] if params else None
                rows = [p for p in _tables["products"] if p["id"] == pid]
                if len(params) > 1:
                    tid = params[1]
                    rows = [p for p in rows if p["tenant_id"] == tid]
                return FakeCursor(rows)
            if has_pk:
                pid = params[0] if params else None
                rows = [p for p in _tables["products"] if p["id"] == pid]
                if len(params) > 1:
                    tid = params[1]
                    rows = [p for p in rows if p["tenant_id"] == tid]
                return FakeCursor(rows)
            tid = params[0] if params else None
            rows = [p for p in _tables["products"] if p["tenant_id"] == tid]
            # Apply LIMIT/OFFSET if present
            if "limit" in sql_lower:
                l = params[1] if len(params) > 1 else len(rows)
                o = params[2] if len(params) > 2 else 0
                rows = rows[o:o + l]
            return FakeCursor(rows)
        return FakeCursor([])

    def _handle_recipe_ingredients(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["recipe_ingredients"] += 1
            row = {"id": _seq["recipe_ingredients"],
                   "product_id": params[0], "ingredient_id": params[1],
                   "qty": Decimal(str(params[2])), "unit": params[3],
                   "wastage_percent": Decimal(str(params[4]))}
            _tables["recipe_ingredients"].append(row)
            return FakeCursor([row])
        if sql_lower.startswith("delete"):
            pid = params[0] if params else None
            _tables["recipe_ingredients"] = [r for r in _tables["recipe_ingredients"] if r["product_id"] != pid]
            return FakeCursor([])
        if sql_lower.startswith("select"):
            if "any(%s)" in sql_lower or "any (%s)" in sql_lower:
                ids = params[0] if params else []
                rows = []
                for ri in _tables["recipe_ingredients"]:
                    if ri["product_id"] not in ids:
                        continue
                    ing = next((i for i in _tables["ingredients"] if i["id"] == ri["ingredient_id"]), None)
                    rows.append({
                        **ri,
                        "ingredient_name": ing["name"] if ing else "?",
                        "name": ing["name"] if ing else "?",
                        "avg_cost": ing["avg_cost"] if ing else Decimal("0"),
                        "min_threshold": ing["min_threshold"] if ing else Decimal("0"),
                    })
                return FakeCursor(rows)
            if "tenant_id" in sql_lower and len(params) >= 2:
                tid, pid = params[0], params[1]
            else:
                pid = params[0] if params else None
                tid = None
            rows = []
            for ri in _tables["recipe_ingredients"]:
                if ri["product_id"] != pid:
                    continue
                ing = next((i for i in _tables["ingredients"] if i["id"] == ri["ingredient_id"]), None)
                if tid and ing and ing.get("tenant_id") != tid:
                    continue
                rows.append({
                    **ri,
                    "ingredient_name": ing["name"] if ing else "?",
                    "name": ing["name"] if ing else "?",
                    "avg_cost": ing["avg_cost"] if ing else Decimal("0"),
                    "min_threshold": ing["min_threshold"] if ing else Decimal("0"),
                })
            return FakeCursor(rows)
        return FakeCursor([])

    # ────── Price history ──────

    def _handle_price_history(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["price_history"] += 1
            row = {"id": _seq["price_history"], "tenant_id": params[0],
                   "ingredient_id": params[1], "supplier_id": params[2],
                   "price": Decimal(str(params[3])), "date": params[4]}
            _tables["price_history"].append(row)
            return FakeCursor([row])
        if sql_lower.startswith("select"):
            if "any(%s)" in sql_lower or "any (%s)" in sql_lower:
                ids = params[0] if params else []
                rows = [p for p in _tables["price_history"] if p["supplier_id"] in ids]
                return FakeCursor(rows)
            if "supplier_id = %s" in sql_lower and "tenant_id = %s" in sql_lower:
                sid = params[0] if params else None
                tid = params[1] if len(params) > 1 else None
                rows = [p for p in _tables["price_history"] if p["supplier_id"] == sid and (not tid or p["tenant_id"] == tid)]
                return FakeCursor(rows)
            if "supplier_id = %s" in sql_lower:
                sid = params[0] if params else None
                rows = [p for p in _tables["price_history"] if p["supplier_id"] == sid]
                return FakeCursor(rows)
            if "avg" in sql_lower:
                iid = params[0] if params else None
                tid = params[1] if len(params) > 1 else None
                prices = [p["price"] for p in _tables["price_history"] if p["ingredient_id"] == iid and (not tid or p["tenant_id"] == tid)]
                avg_p = sum(prices) / len(prices) if prices else None
                return FakeCursor([{"avg_price": avg_p}])
            return FakeCursor([])
        return FakeCursor([])

    # ────── Aggregates ──────

    def _handle_aggregate(self, sql, params):
        sql_lower = sql.strip().lower()
        if "to_char" in sql_lower:
            return FakeCursor([])
        # Dashboard: documents count + sum(total)
        if "count" in sql_lower and "sum" in sql_lower and "from documents" in sql_lower:
            docs = list(_tables["documents"])
            if "tenant_id = %s" in sql_lower and params:
                docs = [d for d in docs if d.get("tenant_id") == params[-1]]
            total = sum(d.get("total", Decimal("0")) for d in docs)
            return FakeCursor([{"count": len(docs), "total": total}])
        # Dashboard: bank_transactions count + sum(amount)
        if "count" in sql_lower and "sum" in sql_lower and "from bank_transactions" in sql_lower:
            txs = list(_tables["bank_transactions"])
            if "tenant_id = %s" in sql_lower and params:
                txs = [t for t in txs if t.get("tenant_id") == params[-1]]
            total = sum(t.get("amount", Decimal("0")) for t in txs)
            return FakeCursor([{"count": len(txs), "total": total}])
        # Dashboard: reconciliations count
        if "count" in sql_lower and "from reconciliations" in sql_lower:
            recs = list(_tables["reconciliations"])
            if "tenant_id = %s" in sql_lower and params:
                recs = [r for r in recs if r.get("tenant_id") == params[-1]]
            return FakeCursor([{"count": len(recs)}])
        # Dashboard: unmatched documents (NOT IN reconciliations subquery)
        if "count" in sql_lower and "not in" in sql_lower and "document_id" in sql_lower:
            docs = list(_tables["documents"])
            rec_doc_ids = {r["document_id"] for r in _tables["reconciliations"]}
            docs = [d for d in docs if d["id"] not in rec_doc_ids]
            if "tenant_id = %s" in sql_lower and params:
                docs = [d for d in docs if d.get("tenant_id") == params[-1]]
            return FakeCursor([{"count": len(docs)}])
        # Dashboard: pending/classified status filter
        if "count" in sql_lower and "status" in sql_lower and "from documents" in sql_lower:
            docs = list(_tables["documents"])
            if "pendente" in sql_lower:
                docs = [d for d in docs if d.get("status") == "pendente"]
            elif "classificado" in sql_lower:
                docs = [d for d in docs if d.get("status") in ("classificado", "revisto")]
            if "tenant_id = %s" in sql_lower and params:
                docs = [d for d in docs if d.get("tenant_id") == params[-1]]
            return FakeCursor([{"count": len(docs)}])
        if "count" in sql_lower:
            return FakeCursor([{"count": 0}])
        return FakeCursor([])


@contextmanager
def fake_get_conn():
    yield FakeConn()


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _clean_db_and_patch():
    """Reset in-memory tables and re-apply FakeConn per test."""
    reset_db()
    with patch("app.routes.get_conn", fake_get_conn), \
         patch("app.billing.get_conn", fake_get_conn), \
         patch("app.db.get_conn", fake_get_conn), \
         patch("app.reconcile.get_conn", fake_get_conn), \
         patch("app.parse.get_conn", fake_get_conn):
        yield


@pytest.fixture
def client():
    """Provide a FastAPI TestClient."""
    from fastapi.testclient import TestClient
    from app.main import app
    return TestClient(app, raise_server_exceptions=False)
