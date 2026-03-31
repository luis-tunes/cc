"""
Shared test fixtures — unified in-memory DB mock.

All test files import the FakeConn and helpers from here instead of
duplicating ~500 lines of mock infrastructure each.
"""
import os
from contextlib import contextmanager
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from unittest.mock import patch

import pytest

# Ensure auth is disabled for tests
os.environ.setdefault("AUTH_DISABLED", "1")
os.environ.setdefault("DATABASE_URL", "postgresql://cc:cc@localhost:5432/cc")

import app.auth

app.auth.AUTH_DISABLED = True

# Disable rate limiting in tests
from app.limiter import limiter as _limiter  # noqa: E402

_limiter.enabled = False


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
    "classification_rules",
    "movement_rules", "alerts", "assets",
    "audit_log", "webhook_events",
)

ALL_SEQ_TABLES = (
    "documents", "bank_transactions", "reconciliations",
    "unit_families", "unit_conversions",
    "suppliers", "ingredients", "stock_events",
    "products", "recipe_ingredients",
    "price_history",
    "classification_rules",
    "movement_rules", "alerts", "assets",
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
    def __init__(self, rows: list[dict], rowcount: int | None = None):
        self._rows = rows
        self.rowcount = rowcount if rowcount is not None else len(rows)

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
        if sql_lower.startswith("select") and ("count(" in sql_lower or ("sum(" in sql_lower and "coalesce" in sql_lower)):
            # Only route to aggregate handler for top-level COUNT/SUM queries
            # (not subqueries like "WHERE id NOT IN (SELECT ...)")
            # Also skip LATERAL join queries, admin metrics (multi-subselect), and admin churn-risk
            if "lateral" not in sql_lower and "tenant_plans" not in sql_lower and sql_lower.count("select count(*)") < 3:
                if "from documents" in sql_lower or "from bank_transactions" in sql_lower or "from reconciliations" in sql_lower:
                    return self._handle_aggregate(sql, params)

        # ── Admin queries (LATERAL joins on tenant_plans) ──
        if "tenant_plans" in sql_lower and "lateral" in sql_lower:
            return self._handle_admin_tenants(sql, params)

        # ── Admin metrics (multiple subselects on tenant_plans) ──
        if "tenant_plans" in sql_lower and sql_lower.count("select count(*)") >= 3:
            return self._handle_admin_metrics(sql, params)

        # ── Admin churn-risk (tenant_plans + audit_log correlated subquery) ──
        if "tenant_plans" in sql_lower and "audit_log" in sql_lower:
            return self._handle_admin_churn_risk(sql, params)

        # ── Tenant plans (billing) ──
        if "tenant_plans" in sql_lower:
            return self._handle_tenant_plans(sql, params)

        # ── Tenant settings ──
        if "tenant_settings" in sql_lower:
            return self._handle_tenant_settings(sql, params)

        # ── Classification rules ──
        if "classification_rules" in sql_lower:
            return self._handle_classification_rules(sql, params)

        # ── Movement rules ──
        if "movement_rules" in sql_lower:
            return self._handle_movement_rules(sql, params)

        # ── Alerts ──
        if "alerts" in sql_lower and any(k in sql_lower for k in ("from alerts", "into alerts", "delete from alerts", "update alerts")):
            return self._handle_alerts(sql, params)

        # ── Assets (before suppliers to avoid substring match) ──
        if "assets" in sql_lower and any(k in sql_lower for k in ("from assets", "into assets", "update assets", "delete from assets")):
            return self._handle_assets(sql, params)

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
        # Only route here if reconciliations is the primary table.
        # Exclude cases where it appears only in a subquery of a document query
        # (e.g. correlated subquery in SELECT column list or RETURNING clause).
        _recon_is_primary = (
            "from reconciliations" in sql_lower
            and "not in" not in sql_lower
            and "from documents" not in sql_lower
            and not sql_lower.startswith("update documents")
            and not sql_lower.startswith("delete from documents")
        )
        if _recon_is_primary:
            return self._handle_reconciliations(sql, params)
        if "into reconciliations" in sql_lower:
            return self._handle_reconciliations(sql, params)
        if "update reconciliations" in sql_lower:
            return self._handle_reconciliations(sql, params)
        if "delete from reconciliations" in sql_lower:
            return self._handle_reconciliations(sql, params)

        # ── Bank transactions ──
        if "bank_transactions" in sql_lower:
            return self._handle_bank_transactions(sql, params)

        # ── Webhook events ──
        if "webhook_events" in sql_lower:
            return self._handle_webhook_events(sql, params)

        # ── Documents ──
        if "documents" in sql_lower:
            return self._handle_documents(sql, params)

        # ── Aggregates / fallback ──
        if "count(" in sql_lower or "sum(" in sql_lower:
            return self._handle_aggregate(sql, params)
        if "to_char" in sql_lower:
            return FakeCursor([])

        # Fire-and-forget: audit log, advisory locks, health checks
        if "audit_log" in sql_lower:
            return FakeCursor([])
        if "pg_advisory" in sql_lower:
            return FakeCursor([])
        if sql_lower.strip() == "select 1":
            return FakeCursor([{"?column?": 1}])

        raise NotImplementedError(f"FakeConn: unhandled SQL: {sql[:120]}")

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
                "notes": None,
                "snc_account": None,
                "classification_source": None,
                "reconciliation_status": None,
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
                # ingest_document: (tenant_id, supplier_nif, client_nif, total, vat, date, type, paperless_id, raw_text, status, notes, classification_source) — 12 params
                elif len(params) == 12:
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
                    doc["notes"] = params[10]
                    doc["classification_source"] = params[11]
                    # ON CONFLICT (paperless_id) → upsert
                    existing = [d for d in _tables["documents"] if d.get("paperless_id") == params[7]]
                    if existing:
                        orig_id = existing[0]["id"]
                        existing[0].update(doc)
                        existing[0]["id"] = orig_id
                        return FakeCursor([existing[0]])
                # Legacy ingest_document: 10 params (without notes/classification_source)
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
                        orig_id = existing[0]["id"]
                        existing[0].update(doc)
                        existing[0]["id"] = orig_id
                        return FakeCursor([existing[0]])
                # Simple (filename, tid) — 2 params
                elif len(params) == 2:
                    doc["filename"] = params[0]
                    doc["tenant_id"] = params[1]
                    doc["status"] = "a processar"
            _tables["documents"].append(doc)
            return FakeCursor([doc])
        if sql_lower.startswith("update"):
            # Find doc_id from WHERE id = %s by counting SET params
            set_part = sql.split("SET")[1].split("WHERE")[0] if "WHERE" in sql else ""
            set_param_count = set_part.count("%s")
            doc_id: int = params[set_param_count] if set_param_count < len(params) else (params[-1] if params else 0)
            doc = next((d for d in _tables["documents"] if d["id"] == doc_id), {})  # type: ignore[arg-type]
            if not doc:
                return FakeCursor([])
            field_names = [f.strip().split("=")[0].strip() for f in set_part.split(",")]
            for i, fname in enumerate(field_names):
                if i < set_param_count:
                    doc[fname] = params[i]
            return FakeCursor([doc])
        if sql_lower.startswith("select"):
            docs = list(_tables["documents"])
            # Filter by paperless_id IS NULL (used by pending-doc lookup)
            if "paperless_id is null" in sql_lower:
                docs = [d for d in docs if d.get("paperless_id") is None]
            # Filter by status IN (used by pending-doc lookup)
            if "status in" in sql_lower:
                allowed = set()
                for s in ("pendente ocr", "a processar"):
                    if s in sql_lower:
                        allowed.add(s)
                if allowed:
                    docs = [d for d in docs if d.get("status") in allowed]
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
            # Populate reconciliation_status from the reconciliations table when the
            # query requests it (correlated subquery or LATERAL join in the SELECT column list)
            if "reconciliation_status" in sql_lower:
                recon_by_doc = {}
                for r in _tables["reconciliations"]:
                    if r["document_id"] not in recon_by_doc:
                        recon_by_doc[r["document_id"]] = r
                result = []
                for d in docs:
                    row = dict(d)
                    if "reconciliation_status" not in row or row["reconciliation_status"] is None:
                        recon = recon_by_doc.get(row["id"])
                        row["reconciliation_status"] = recon["status"] if recon else None
                    result.append(row)
                return FakeCursor(result)
            return FakeCursor(docs)
        if sql_lower.startswith("delete"):
            if params:
                doc_id = params[0]
                _tables["documents"] = [d for d in _tables["documents"] if d["id"] != doc_id]
            return FakeCursor([])
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
                "category": None,
                "snc_account": None,
                "entity_nif": None,
                "classification_source": None,
                "created_at": "2025-01-01T00:00:00+00:00",
            }
            _tables["bank_transactions"].append(tx)
            return FakeCursor([tx])
        if sql_lower.startswith("select"):
            # Self-JOIN for find_duplicates
            if "join bank_transactions" in sql_lower and "a.id < b.id" in sql_lower:
                tid = params[2] if len(params) >= 3 else None
                amt_tol = float(params[0]) if params else 0.01
                date_tol = int(params[1]) if len(params) >= 2 else 3
                txs = [t for t in _tables["bank_transactions"] if t.get("tenant_id") == tid]
                results = []
                for i, a in enumerate(txs):
                    for b in txs[i+1:]:
                        if a["id"] >= b["id"]:
                            continue
                        a_date = a["date"] if isinstance(a["date"], date) else date.fromisoformat(str(a["date"]))
                        b_date = b["date"] if isinstance(b["date"], date) else date.fromisoformat(str(b["date"]))
                        if abs(float(a["amount"] - b["amount"])) < amt_tol and abs((a_date - b_date).days) <= date_tol:
                            results.append({
                                "id_a": a["id"], "id_b": b["id"],
                                "amount": a["amount"],
                                "date_a": a_date, "date_b": b_date,
                                "desc_a": a["description"], "desc_b": b["description"],
                            })
                return FakeCursor(results)
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
        if sql_lower.startswith("update"):
            # UPDATE bank_transactions SET category=..., snc_account=..., entity_nif=..., classification_source=... WHERE id=%s
            tx_id = params[-1]  # id is always last param
            for t in _tables["bank_transactions"]:
                if t["id"] == tx_id:
                    if "category" in sql_lower:
                        t["category"] = params[0]
                        t["snc_account"] = params[1]
                        t["entity_nif"] = params[2]
                        t["classification_source"] = "manual" if "manual" in sql_lower else "rule"
                    elif "entity_nif" in sql_lower:
                        t["entity_nif"] = params[0]
                        t["classification_source"] = "rule"
                    break
            return FakeCursor([])
        if sql_lower.startswith("delete"):
            tx_id = params[0] if params else None
            _tables["bank_transactions"] = [t for t in _tables["bank_transactions"] if t["id"] != tx_id]
            return FakeCursor([])
        return FakeCursor([])

    # ────── Webhook Events ──────

    def _handle_webhook_events(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            event_id = params[0] if params else ""
            source = params[1] if len(params) > 1 else ""
            # ON CONFLICT DO NOTHING
            if not any(e["event_id"] == event_id for e in _tables["webhook_events"]):
                _tables["webhook_events"].append({"event_id": event_id, "source": source, "processed_at": "2025-01-01T00:00:00+00:00"})
            return FakeCursor([])
        if sql_lower.startswith("select"):
            event_id = params[0] if params else ""
            matches = [e for e in _tables["webhook_events"] if e["event_id"] == event_id]
            return FakeCursor(matches)
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
                "status": "pendente",
            }
            # ON CONFLICT DO NOTHING
            existing = [r for r in _tables["reconciliations"]
                        if r["document_id"] == params[0] and r["bank_transaction_id"] == params[1]]
            if not existing:
                _tables["reconciliations"].append(row)
            return FakeCursor([])
        if sql_lower.startswith("update"):
            # PATCH status endpoint: UPDATE reconciliations SET status = %s WHERE id = %s AND tenant_id = %s
            recon_id = params[-2] if len(params) >= 2 else None
            tid = params[-1] if params else None
            rec = next((r for r in _tables["reconciliations"] if r["id"] == recon_id and r.get("tenant_id") == tid), None)
            if not rec:
                return FakeCursor([])
            set_part = sql.split("SET")[1].split("WHERE")[0]
            field_names = [f.strip().split("=")[0].strip() for f in set_part.split(",")]
            for i, fname in enumerate(field_names):
                if i < len(params) - 2:
                    rec[fname] = params[i]
            return FakeCursor([rec])
        if sql_lower.startswith("select"):
            rows = list(_tables["reconciliations"])
            if "tenant_id = %s" in sql_lower and params:
                tid = params[-1] if params else None
                rows = [r for r in rows if r.get("tenant_id") == tid]
            # Simulate JOIN with documents and bank_transactions
            if "join documents" in sql_lower or "join bank_transactions" in sql_lower:
                joined = []
                for r in rows:
                    doc = next((d for d in _tables["documents"] if d["id"] == r["document_id"]), None)
                    tx = next((t for t in _tables["bank_transactions"] if t["id"] == r["bank_transaction_id"]), None)
                    row = {
                        "id": r["id"],
                        "document_id": r["document_id"],
                        "bank_transaction_id": r["bank_transaction_id"],
                        "match_confidence": r["match_confidence"],
                        "reconciliation_status": r.get("status", "pendente"),
                        "supplier_nif": doc["supplier_nif"] if doc else "",
                        "total": doc["total"] if doc else Decimal("0"),
                        "doc_vat": doc["vat"] if doc else Decimal("0"),
                        "doc_date": str(doc["date"]) if doc and doc.get("date") else None,
                        "doc_filename": doc.get("filename") if doc else None,
                        "description": tx["description"] if tx else "",
                        "amount": tx["amount"] if tx else Decimal("0"),
                        "tx_date": str(tx["date"]) if tx and tx.get("date") else None,
                    }
                    joined.append(row)
                return FakeCursor(joined)
            return FakeCursor(rows)
        if sql_lower.startswith("delete"):
            if "document_id" in sql_lower and params:
                doc_id = params[0]
                _tables["reconciliations"] = [r for r in _tables["reconciliations"] if r["document_id"] != doc_id]
            return FakeCursor([])
        return FakeCursor([])

    # ────── Tenant settings ──────

    def _handle_tenant_settings(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("select"):
            tid = params[0] if params else None
            rows = [r for r in _tables["tenant_settings"] if r.get("tenant_id") == tid]
            # Simulate JSONB: parse JSON strings in "data" field
            for r in rows:
                if isinstance(r.get("data"), str):
                    import json as _json
                    r["data"] = _json.loads(r["data"])
            return FakeCursor(rows)
        if sql_lower.startswith("insert"):
            entry = {"tenant_id": params[0], "key": "entity_profile", "data": params[1]}
            _tables["tenant_settings"] = [r for r in _tables["tenant_settings"] if r.get("tenant_id") != params[0]]
            _tables["tenant_settings"].append(entry)
            return FakeCursor([entry])
        return FakeCursor([])

    # ────── Classification rules ──────

    def _handle_classification_rules(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("select"):
            tid = params[0] if params else None
            rows = [r for r in _tables["classification_rules"] if r.get("tenant_id") == tid]
            if "active = true" in sql_lower or "active = %s" in sql_lower:
                rows = [r for r in rows if r.get("active", True)]
            rows.sort(key=lambda r: (r.get("priority", 0), r.get("id", 0)))
            return FakeCursor(rows)
        if sql_lower.startswith("insert"):
            _seq["classification_rules"] += 1
            rule = {
                "id": _seq["classification_rules"],
                "tenant_id": params[0],
                "field": params[1],
                "operator": params[2],
                "value": params[3],
                "account": params[4],
                "label": params[5] if len(params) > 5 else "",
                "priority": params[6] if len(params) > 6 else 0,
                "active": params[7] if len(params) > 7 else True,
            }
            _tables["classification_rules"].append(rule)
            return FakeCursor([rule])
        if sql_lower.startswith("update"):
            rule_id = params[-2] if len(params) >= 2 else None
            tid = params[-1] if params else None
            rule = next((r for r in _tables["classification_rules"] if r["id"] == rule_id and r.get("tenant_id") == tid), {})  # type: ignore[arg-type]
            if not rule:
                return FakeCursor([])
            set_part = sql.split("SET")[1].split("WHERE")[0]
            field_names = [f.strip().split("=")[0].strip() for f in set_part.split(",")]
            for i, fname in enumerate(field_names):
                if i < len(params) - 2:
                    rule[fname] = params[i]
            return FakeCursor([rule])
        if sql_lower.startswith("delete"):
            rule_id = params[0] if params else None
            tid = params[1] if len(params) > 1 else None
            rule = next((r for r in _tables["classification_rules"] if r["id"] == rule_id and r.get("tenant_id") == tid), {})  # type: ignore[arg-type]
            if rule:
                _tables["classification_rules"].remove(rule)
                return FakeCursor([rule])
            return FakeCursor([])
        return FakeCursor([])

    # ────── Tenant plans ──────

    def _handle_tenant_plans(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("select"):
            tid = params[0] if params else None
            if tid:
                rows = [r for r in _tables["tenant_plans"] if r.get("tenant_id") == tid]
            else:
                # No filter param: return all (used by admin/revenue, admin/churn-risk)
                rows = list(_tables["tenant_plans"])
            return FakeCursor(rows)
        if sql_lower.startswith("insert"):
            now = datetime.now(UTC)
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
            # Detect SET clause values
            if "stripe_customer = %s" in sql_lower or "where stripe_customer" in sql_lower:
                customer = params[-1] if params else None
                for plan in _tables["tenant_plans"]:
                    if plan.get("stripe_customer") == customer:
                        if "status = 'cancelled'" in sql_lower or ("plan = 'free'" in sql_lower and "status = 'cancelled'" in sql_lower):
                            plan["plan"] = "free"
                            plan["status"] = "cancelled"
                        elif "status = 'past_due'" in sql_lower:
                            plan["status"] = "past_due"
                        elif "status = 'active'" in sql_lower:
                            plan["status"] = "active"
                        elif "status = %s" in sql_lower and len(params) >= 2:
                            plan["status"] = params[0]
                        return FakeCursor([plan])
            if "tenant_id = %s" in sql_lower:
                tid = params[-1] if params else None
                for plan in _tables["tenant_plans"]:
                    if plan.get("tenant_id") == tid:
                        return FakeCursor([plan])
            return FakeCursor([])
        return FakeCursor([])

    # ────── Admin queries ──────

    def _handle_admin_tenants(self, sql, params):
        """Handle the admin/tenants LATERAL join query."""
        results = []
        for tp in _tables["tenant_plans"]:
            tid = tp["tenant_id"]
            docs = [d for d in _tables["documents"] if d.get("tenant_id") == tid]
            txs = [t for t in _tables["bank_transactions"] if t.get("tenant_id") == tid]
            recs = [r for r in _tables["reconciliations"] if r.get("tenant_id") == tid]
            logs = [a for a in _tables.get("audit_log", []) if a.get("tenant_id") == tid]
            results.append({
                **tp,
                "doc_count": len(docs),
                "doc_total": sum(d.get("total", Decimal("0")) for d in docs),
                "tx_count": len(txs),
                "recon_count": len(recs),
                "last_activity": max((a.get("created_at") for a in logs), default=None) if logs else None,
            })
        return FakeCursor(results)

    def _handle_admin_metrics(self, sql, params):
        """Handle the admin/metrics multi-subselect query."""
        return FakeCursor([{
            "total_tenants": len(_tables["tenant_plans"]),
            "pro_tenants": len([t for t in _tables["tenant_plans"] if t.get("plan") == "pro" and t.get("status") == "active"]),
            "trialing_tenants": len([t for t in _tables["tenant_plans"] if t.get("status") == "trialing"]),
            "expired_tenants": len([t for t in _tables["tenant_plans"] if t.get("status") == "trial_expired"]),
            "cancelled_tenants": len([t for t in _tables["tenant_plans"] if t.get("status") == "cancelled"]),
            "past_due_tenants": len([t for t in _tables["tenant_plans"] if t.get("status") == "past_due"]),
            "total_documents": len(_tables["documents"]),
            "total_transactions": len(_tables["bank_transactions"]),
            "total_reconciliations": len(_tables["reconciliations"]),
            "docs_last_30d": len(_tables["documents"]),
            "docs_last_7d": len(_tables["documents"]),
            "txs_last_30d": len(_tables["bank_transactions"]),
            "total_document_value": sum(d.get("total", Decimal("0")) for d in _tables["documents"]),
            "unread_alerts_global": len([a for a in _tables["alerts"] if not a.get("read", False)]),
        }])

    def _handle_admin_churn_risk(self, sql, params):
        """Handle the admin/churn-risk query with correlated subqueries."""
        results = []
        statuses = {"active", "trialing", "past_due"}
        for tp in _tables["tenant_plans"]:
            if tp.get("status") not in statuses:
                continue
            tid = tp["tenant_id"]
            logs = [a for a in _tables.get("audit_log", []) if a.get("tenant_id") == tid]
            last_activity = max((a.get("created_at") for a in logs), default=None) if logs else None
            doc_count = len([d for d in _tables["documents"] if d.get("tenant_id") == tid])
            results.append({
                **tp,
                "last_activity": last_activity,
                "doc_count": doc_count,
            })
        return FakeCursor(results)

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
            if "count(" in sql_lower and not has_pk:
                tid = params[0] if params else None
                rows = [s for s in _tables["suppliers"] if s["tenant_id"] == tid]
                return FakeCursor([{"count": len(rows)}])
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
            if "any(%s)" in sql_lower or "any (%s)" in sql_lower:
                # Batch fetch (used for FOR UPDATE lock and batch lookups)
                ids = params[0] if params else []
                tid = params[1] if len(params) > 1 else None
                rows = [i for i in _tables["ingredients"] if i["id"] in ids]
                if tid:
                    rows = [i for i in rows if i["tenant_id"] == tid]
                return FakeCursor(rows)
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
            if "count(" in sql_lower:
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
            if "count(" in sql_lower:
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

    # ────── Movement rules ──────

    def _handle_movement_rules(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["movement_rules"] += 1
            row = {
                "id": _seq["movement_rules"],
                "tenant_id": params[0],
                "name": params[1],
                "pattern": params[2],
                "category": params[3],
                "snc_account": params[4],
                "entity_nif": params[5],
                "priority": params[6],
                "active": params[7],
            }
            _tables["movement_rules"].append(row)
            return FakeCursor([row])
        if sql_lower.startswith("update"):
            rule_id = params[-2]
            tid = params[-1]
            rule = next((r for r in _tables["movement_rules"] if r["id"] == rule_id and r.get("tenant_id") == tid), None)
            if not rule:
                return FakeCursor([])
            set_part = sql.split("SET")[1].split("WHERE")[0]
            field_names = [f.strip().split("=")[0].strip() for f in set_part.split(",")]
            for i, fname in enumerate(field_names):
                if i < len(params) - 2:
                    rule[fname] = params[i]
            return FakeCursor([rule])
        if sql_lower.startswith("delete"):
            rule_id = params[0]
            tid = params[1] if len(params) > 1 else None
            deleted = [r for r in _tables["movement_rules"] if r["id"] == rule_id and r.get("tenant_id") == tid]
            _tables["movement_rules"] = [r for r in _tables["movement_rules"] if not (r["id"] == rule_id and r.get("tenant_id") == tid)]
            return FakeCursor([{"id": rule_id}] if deleted else [])
        if sql_lower.startswith("select"):
            tid = params[0] if params else None
            rows = [r for r in _tables["movement_rules"] if r.get("tenant_id") == tid]
            if "active = true" in sql_lower or "active = %s" in sql_lower:
                rows = [r for r in rows if r.get("active", True)]
            rows.sort(key=lambda r: (r.get("priority", 0), r.get("id", 0)))
            return FakeCursor(rows)
        return FakeCursor([])

    # ────── Alerts ──────

    def _handle_alerts(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("delete"):
            # DELETE FROM alerts WHERE tenant_id = %s AND read = false
            tid = params[0] if params else None
            len(_tables["alerts"])
            _tables["alerts"] = [a for a in _tables["alerts"]
                                  if not (a.get("tenant_id") == tid and not a.get("read", False))]
            return FakeCursor([])
        if sql_lower.startswith("insert"):
            _seq["alerts"] += 1
            row = {
                "id": _seq["alerts"],
                "tenant_id": params[0],
                "type": params[1],
                "severity": params[2],
                "title": params[3],
                "description": params[4],
                "action_url": params[5] if len(params) > 5 else None,
                "read": False,
                "created_at": None,
            }
            _tables["alerts"].append(row)
            return FakeCursor([row])
        if sql_lower.startswith("update"):
            # UPDATE alerts SET read = true WHERE id = %s AND tenant_id = %s
            alert_id = params[0]
            tid = params[1] if len(params) > 1 else None
            alert = next((a for a in _tables["alerts"] if a["id"] == alert_id and a.get("tenant_id") == tid), None)
            if not alert:
                return FakeCursor([])
            alert["read"] = True
            return FakeCursor([alert])
        if sql_lower.startswith("select"):
            tid = params[0] if params else None
            rows = [a for a in _tables["alerts"] if a.get("tenant_id") == tid]
            if "read = false" in sql_lower:
                rows = [a for a in rows if not a.get("read", False)]
            if "count(" in sql_lower:
                return FakeCursor([{"count": len(rows)}])
            return FakeCursor(rows)
        return FakeCursor([])

    # ────── Assets ──────

    def _handle_assets(self, sql, params):
        sql_lower = sql.strip().lower()
        if sql_lower.startswith("insert"):
            _seq["assets"] += 1
            row = {
                "id": _seq["assets"],
                "tenant_id": params[0],
                "name": params[1],
                "category": params[2],
                "acquisition_date": params[3],
                "acquisition_cost": Decimal(str(params[4])),
                "useful_life_years": params[5],
                "depreciation_method": params[6],
                "current_value": Decimal(str(params[7])),
                "status": params[8],
                "supplier": params[9] if len(params) > 9 else None,
                "invoice_ref": params[10] if len(params) > 10 else None,
                "notes": params[11] if len(params) > 11 else None,
                "created_at": None,
            }
            _tables["assets"].append(row)
            return FakeCursor([row])
        if sql_lower.startswith("update"):
            asset_id = params[-2]
            tid = params[-1]
            asset = next((a for a in _tables["assets"] if a["id"] == asset_id and a.get("tenant_id") == tid), None)
            if not asset:
                return FakeCursor([])
            set_part = sql.split("SET")[1].split("WHERE")[0]
            field_names = [f.strip().split("=")[0].strip() for f in set_part.split(",")]
            for i, fname in enumerate(field_names):
                if i < len(params) - 2:
                    asset[fname] = params[i]
            return FakeCursor([asset])
        if sql_lower.startswith("delete"):
            asset_id = params[0]
            tid = params[1] if len(params) > 1 else None
            deleted = [a for a in _tables["assets"] if a["id"] == asset_id and a.get("tenant_id") == tid]
            _tables["assets"] = [a for a in _tables["assets"] if not (a["id"] == asset_id and a.get("tenant_id") == tid)]
            return FakeCursor([{"id": asset_id}] if deleted else [])
        if sql_lower.startswith("select"):
            has_pk = "where id = %s" in sql_lower or "and id = %s" in sql_lower
            if "count(" in sql_lower and not has_pk:
                # Aggregate query: COUNT(*) + SUM(acquisition_cost)
                tid = params[0] if params else None
                rows = [a for a in _tables["assets"] if a.get("tenant_id") == tid]
                if "status = 'ativo'" in sql_lower:
                    rows = [a for a in rows if a.get("status") == "ativo"]
                cost = sum(a.get("acquisition_cost", Decimal("0")) for a in rows)
                return FakeCursor([{"count": len(rows), "cost": cost}])
            if has_pk:
                asset_id = params[0]
                tid = params[1] if len(params) > 1 else None
                rows = [a for a in _tables["assets"] if a["id"] == asset_id]
                if tid:
                    rows = [a for a in rows if a.get("tenant_id") == tid]
                return FakeCursor(rows)
            tid = params[0] if params else None
            rows = [a for a in _tables["assets"] if a.get("tenant_id") == tid]
            return FakeCursor(rows)
        return FakeCursor([])

    # ────── Aggregates ──────

    def _handle_aggregate(self, sql, params):
        import re as _re
        sql_lower = sql.strip().lower()
        # Detect COUNT alias (e.g. COUNT(*) as cnt → _ck="cnt")
        _cm = _re.search(r'count\(\*\)\s+as\s+(\w+)', sql_lower)
        _ck = _cm.group(1) if _cm else "count"
        if "to_char" in sql_lower:
            return FakeCursor([])
        # Tax IRC: SUM(CASE WHEN type=...) AS receitas/gastos + COUNT(*) from documents
        if "receitas" in sql_lower and "gastos" in sql_lower and "from documents" in sql_lower:
            docs = list(_tables["documents"])
            if params:
                docs = [d for d in docs if d.get("tenant_id") == params[0]]
            receitas = sum(d.get("total", Decimal("0")) for d in docs if d.get("type") == "fatura")
            gastos = sum(d.get("total", Decimal("0")) for d in docs if d.get("type") in ("fatura-fornecedor", "recibo"))
            return FakeCursor([{"receitas": receitas, "gastos": gastos, "doc_count": len(docs)}])
        # Tax IVA periods / reports P&L: SUM with GROUP BY quarter/month
        if "quarter" in sql_lower or "month_label" in sql_lower or ("extract" in sql_lower and "from documents" in sql_lower):
            return FakeCursor([])
        # Tax audit flags (zero vat, round amounts, missing nif, duplicates)
        if "vat = 0" in sql_lower or "mod(" in sql_lower or "having count" in sql_lower:
            return FakeCursor([{_ck: 0}])
        if "supplier_nif is null" in sql_lower or "(supplier_nif = ''" in sql_lower:
            return FakeCursor([{_ck: 0}])
        # Top suppliers: SUM(total) GROUP BY supplier_nif
        if "supplier_nif" in sql_lower and "sum" in sql_lower:
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
            return FakeCursor([{_ck: len(recs)}])
        # Dashboard: unmatched documents (NOT IN reconciliations subquery)
        if "count" in sql_lower and "not in" in sql_lower and "document_id" in sql_lower:
            docs = list(_tables["documents"])
            rec_doc_ids = {r["document_id"] for r in _tables["reconciliations"]}
            docs = [d for d in docs if d["id"] not in rec_doc_ids]
            if "tenant_id = %s" in sql_lower and params:
                docs = [d for d in docs if d.get("tenant_id") == params[-1]]
            return FakeCursor([{_ck: len(docs)}])
        # Dashboard: pending/classified status filter
        if "count" in sql_lower and "status" in sql_lower and "from documents" in sql_lower:
            docs = list(_tables["documents"])
            if "pendente" in sql_lower:
                docs = [d for d in docs if d.get("status") == "pendente"]
            elif "classificado" in sql_lower:
                docs = [d for d in docs if d.get("status") in ("classificado", "revisto")]
            if "tenant_id = %s" in sql_lower and params:
                docs = [d for d in docs if d.get("tenant_id") == params[-1]]
            return FakeCursor([{_ck: len(docs)}])
        # Generic: simple COUNT or SUM not matched above
        if "count" in sql_lower and "from documents" in sql_lower:
            docs = list(_tables["documents"])
            if "tenant_id = %s" in sql_lower and params:
                docs = [d for d in docs if d.get("tenant_id") == params[-1]]
            return FakeCursor([{_ck: len(docs)}])
        if "sum" in sql_lower and "from documents" in sql_lower:
            docs = list(_tables["documents"])
            if "tenant_id = %s" in sql_lower and params:
                docs = [d for d in docs if d.get("tenant_id") == params[-1]]
            total_v = sum(d.get("total", Decimal("0")) for d in docs)
            vat_v = sum(d.get("vat", Decimal("0")) for d in docs)
            return FakeCursor([{"total": total_v, "vat": vat_v}])
        if "from bank_transactions" in sql_lower:
            txs = list(_tables["bank_transactions"])
            if "tenant_id = %s" in sql_lower and params:
                txs = [t for t in txs if t.get("tenant_id") == params[-1]]
            if "amount > 0" in sql_lower:
                txs = [t for t in txs if float(t.get("amount", 0)) > 0]
            elif "amount < 0" in sql_lower:
                txs = [t for t in txs if float(t.get("amount", 0)) < 0]
            total_v = sum(t.get("amount", Decimal("0")) for t in txs)
            return FakeCursor([{"total": total_v, _ck: len(txs)}])
        if "count(" in sql_lower:
            return FakeCursor([{_ck: 0}])
        return FakeCursor([])


@contextmanager
def fake_get_conn():
    yield FakeConn()


# ── Fixtures ──────────────────────────────────────────────────────────

@pytest.fixture(autouse=True)
def _clean_db_and_patch(tmp_path):
    """Reset in-memory tables and re-apply FakeConn per test."""
    reset_db()
    with patch("app.routes_documents.get_conn", fake_get_conn), \
         patch("app.routes_bank.get_conn", fake_get_conn), \
         patch("app.routes_inventory.get_conn", fake_get_conn), \
         patch("app.routes_finance.get_conn", fake_get_conn), \
         patch("app.routes_admin.get_conn", fake_get_conn), \
         patch("app.billing.get_conn", fake_get_conn), \
         patch("app.db.get_conn", fake_get_conn), \
         patch("app.reconcile.get_conn", fake_get_conn), \
         patch("app.parse.get_conn", fake_get_conn), \
         patch("app.classify.get_conn", fake_get_conn), \
         patch("app.alerts.get_conn", fake_get_conn), \
         patch("app.classify_movements.get_conn", fake_get_conn), \
         patch("app.assistant.get_conn", fake_get_conn), \
         patch("app.cache.cache_get", return_value=None), \
         patch("app.cache.cache_set", return_value=None), \
         patch("app.routes_documents.UPLOADS_DIR", str(tmp_path / "uploads")):
        yield


@pytest.fixture
def client():
    """Provide a FastAPI TestClient."""
    from fastapi.testclient import TestClient

    from app.main import app
    return TestClient(app, raise_server_exceptions=False)
