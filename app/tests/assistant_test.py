"""Tests: batch stock queries, AI assistant, dashboard cache."""

import sys
from decimal import Decimal
from unittest.mock import patch

import pytest

# ── Helpers ───────────────────────────────────────────────────────────────

def _conftest():
    return sys.modules["tests.conftest"]


def _jwt_headers(tenant_id: str) -> dict:
    import base64
    import json
    header  = base64.urlsafe_b64encode(b'{"alg":"HS256","typ":"JWT"}').rstrip(b"=").decode()
    payload = base64.urlsafe_b64encode(json.dumps({"sub": tenant_id, "org_id": tenant_id}).encode()).rstrip(b"=").decode()
    return {"Authorization": f"Bearer {header}.{payload}.fakesig"}


_T1 = _jwt_headers("t1")
_T2 = _jwt_headers("t2")


# ─────────────────────────────────────────────────────────────────────────────
# 6.1  _get_batch_stock helper
# ─────────────────────────────────────────────────────────────────────────────

class TestBatchStock:
    def _seed_events(self):
        c = _conftest()
        for _i, iid in enumerate([1, 2, 3], start=1):
            c._seq["ingredients"] = iid
            c._tables["ingredients"].append({
                "id": iid, "tenant_id": "t1", "name": f"ing{iid}",
                "category": "a", "unit": "kg",
                "min_threshold": Decimal("1"),
                "supplier_id": None, "last_cost": Decimal("0"), "avg_cost": Decimal("0"),
            })
        # 3 entradas + 1 saída for ing 1 → net 2
        for qty, t in [(3, "entrada"), (1, "saída")]:
            c._seq["stock_events"] += 1
            c._tables["stock_events"].append({
                "id": c._seq["stock_events"], "tenant_id": "t1",
                "type": t, "ingredient_id": 1,
                "qty": Decimal(str(qty)), "unit": "kg", "date": "2025-01-01",
                "source": "manual", "reference": "", "cost": None,
            })
        # 5 entrada for ing 2
        c._seq["stock_events"] += 1
        c._tables["stock_events"].append({
            "id": c._seq["stock_events"], "tenant_id": "t1",
            "type": "entrada", "ingredient_id": 2,
            "qty": Decimal("5"), "unit": "kg", "date": "2025-01-01",
            "source": "manual", "reference": "", "cost": None,
        })
        # ing 3 has no events → 0

    def test_batch_stock_returns_correct_values(self, client):
        self._seed_events()
        from app.routes import _get_batch_stock
        with _conftest().fake_get_conn() as conn:
            result = _get_batch_stock(conn, [1, 2, 3], "t1")
        assert result[1] == Decimal("2")
        assert result[2] == Decimal("5")
        assert result[3] == Decimal("0")

    def test_batch_stock_empty_list(self, client):
        from app.routes import _get_batch_stock
        with _conftest().fake_get_conn() as conn:
            result = _get_batch_stock(conn, [], "t1")
        assert result == {}

    def test_batch_stock_unknown_ids_return_zero(self, client):
        from app.routes import _get_batch_stock
        with _conftest().fake_get_conn() as conn:
            result = _get_batch_stock(conn, [999], "t1")
        assert result[999] == Decimal("0")


# ─────────────────────────────────────────────────────────────────────────────
# 6.2  inventory_stats — no N+1
# ─────────────────────────────────────────────────────────────────────────────

class TestInventoryStats:
    def _seed(self):
        c = _conftest()
        for iid in [1, 2]:
            c._seq["ingredients"] = iid
            c._tables["ingredients"].append({
                "id": iid, "tenant_id": "t1", "name": f"ing{iid}",
                "category": "a", "unit": "kg",
                "min_threshold": Decimal("5"),
                "supplier_id": None,
                "last_cost": Decimal("1"),
                "avg_cost": Decimal("1"),
            })
        # ing1 → 10 units (normal), ing2 → 0 (rutura)
        c._seq["stock_events"] += 1
        c._tables["stock_events"].append({
            "id": 1, "tenant_id": "t1", "type": "entrada",
            "ingredient_id": 1, "qty": Decimal("10"), "unit": "kg",
            "date": "2025-01-01", "source": "manual", "reference": "", "cost": None,
        })

    def test_inventory_stats_rutura_count(self, client):
        self._seed()
        r = client.get("/api/inventory/stats", headers=_T1)
        assert r.status_code == 200
        data = r.json()
        assert data["total_ingredients"] == 2
        assert data["rutura_count"] == 1   # ing2 has 0 stock
        assert data["baixo_count"] == 0    # ing1 has 10 > threshold 5

    def test_inventory_stats_stock_value(self, client):
        self._seed()
        r = client.get("/api/inventory/stats", headers=_T1)
        assert r.status_code == 200
        # 10 units × €1 avg_cost = €10
        assert r.json()["stock_value"] == pytest.approx(10.0)


# ─────────────────────────────────────────────────────────────────────────────
# 6.3  shopping_list — batch stock
# ─────────────────────────────────────────────────────────────────────────────

class TestShoppingList:
    def _seed(self):
        c = _conftest()
        for iid in [1, 2]:
            c._seq["ingredients"] = iid
            c._tables["ingredients"].append({
                "id": iid, "tenant_id": "t1", "name": f"ing{iid}",
                "category": "a", "unit": "kg",
                "min_threshold": Decimal("5"),
                "supplier_id": None,
                "last_cost": Decimal("2"),
                "avg_cost": Decimal("2"),
            })
        # ing1 has 10 → does NOT appear in shopping list
        c._seq["stock_events"] += 1
        c._tables["stock_events"].append({
            "id": 1, "tenant_id": "t1", "type": "entrada",
            "ingredient_id": 1, "qty": Decimal("10"), "unit": "kg",
            "date": "2025-01-01", "source": "manual", "reference": "", "cost": None,
        })
        # ing2 has 0 → appears

    def test_shopping_list_only_below_threshold(self, client):
        self._seed()
        r = client.get("/api/inventory/shopping-list", headers=_T1)
        assert r.status_code == 200
        items = r.json()
        assert len(items) == 1
        assert items[0]["ingredient_id"] == 2
        assert items[0]["urgency"] == "urgente"


# ─────────────────────────────────────────────────────────────────────────────
# 6.4  produce_product — race condition (FOR UPDATE)
# ─────────────────────────────────────────────────────────────────────────────

class TestProduceProductLock:
    def _seed(self):
        c = _conftest()
        # Ingredient
        c._seq["ingredients"] = 1
        c._tables["ingredients"].append({
            "id": 1, "tenant_id": "t1", "name": "Farinha",
            "category": "seco", "unit": "kg",
            "min_threshold": Decimal("0"),
            "supplier_id": None, "last_cost": Decimal("1"), "avg_cost": Decimal("1"),
        })
        # Stock: 10 kg
        c._seq["stock_events"] = 1
        c._tables["stock_events"].append({
            "id": 1, "tenant_id": "t1", "type": "entrada",
            "ingredient_id": 1, "qty": Decimal("10"), "unit": "kg",
            "date": "2025-01-01", "source": "manual", "reference": "", "cost": None,
        })
        # Product
        c._seq["products"] = 1
        c._tables["products"].append({
            "id": 1, "tenant_id": "t1", "code": "PAO",
            "name": "Pão", "category": "padaria",
            "recipe_version": 1,
            "estimated_cost": Decimal("0.5"),
            "pvp": Decimal("1.0"),
            "margin": Decimal("0.5"),
            "active": True,
        })
        # Recipe: 2 kg farinha per unit
        c._seq["recipe_ingredients"] = 1
        c._tables["recipe_ingredients"].append({
            "id": 1, "product_id": 1, "ingredient_id": 1,
            "qty": Decimal("2"), "unit": "kg", "wastage_percent": Decimal("0"),
        })

    def test_produce_success(self, client):
        self._seed()
        r = client.post("/api/products/1/produce", json={"qty": 3}, headers=_T1)
        assert r.status_code == 200
        assert r.json()["produced"] == 3

    def test_produce_insufficient_stock(self, client):
        self._seed()
        # Try to produce 6 units (needs 12 kg, only 10 available)
        r = client.post("/api/products/1/produce", json={"qty": 6}, headers=_T1)
        assert r.status_code == 422

    def test_produce_wrong_tenant_404(self, client):
        self._seed()
        r = client.post("/api/products/1/produce", json={"qty": 1}, headers=_T2)
        assert r.status_code == 404


# ─────────────────────────────────────────────────────────────────────────────
# 6.5  AI Assistant endpoint
# ─────────────────────────────────────────────────────────────────────────────

class TestAssistantChat:
    def test_get_quick_prompts(self, client):
        r = client.get("/api/assistant/prompts", headers=_T1)
        assert r.status_code == 200
        prompts = r.json()
        assert len(prompts) > 0
        assert all("label" in p and "prompt" in p and "category" in p for p in prompts)

    def test_chat_greeting(self, client):
        r = client.post("/api/assistant/chat", json={"question": "olá"}, headers=_T1)
        assert r.status_code == 200
        data = r.json()
        assert data["intent"] == "greeting"
        assert len(data["answer"]) > 10

    def test_chat_help(self, client):
        r = client.post("/api/assistant/chat", json={"question": "o que podes fazer?"}, headers=_T1)
        assert r.status_code == 200
        assert r.json()["intent"] == "help"

    def test_chat_dashboard(self, client):
        r = client.post("/api/assistant/chat", json={"question": "mostra-me o resumo da conta"}, headers=_T1)
        assert r.status_code == 200
        data = r.json()
        assert data["intent"] == "dashboard"
        assert "Documentos" in data["answer"] or "documentos" in data["answer"]

    def test_chat_docs_count(self, client):
        c = _conftest()
        c._seq["documents"] = 1
        c._tables["documents"].append({
            "id": 1, "tenant_id": "t1", "supplier_nif": "123456789",
            "client_nif": "", "total": Decimal("100"), "vat": Decimal("23"),
            "date": "2025-01-01", "type": "fatura", "filename": "test.pdf",
            "raw_text": None, "status": "classificado",
            "paperless_id": None, "created_at": "2025-01-01T00:00:00+00:00",
            "notes": None, "snc_account": None, "classification_source": None,
        })
        r = client.post("/api/assistant/chat", json={"question": "quantos documentos tenho?"}, headers=_T1)
        assert r.status_code == 200
        data = r.json()
        assert data["intent"] == "docs_count"
        assert "1" in data["answer"]

    def test_chat_pending_docs(self, client):
        r = client.post("/api/assistant/chat", json={"question": "documentos pendentes de revisão"}, headers=_T1)
        assert r.status_code == 200
        assert r.json()["intent"] == "docs_pending"

    def test_chat_reconciliation(self, client):
        r = client.post("/api/assistant/chat", json={"question": "qual é o estado das reconciliações?"}, headers=_T1)
        assert r.status_code == 200
        assert r.json()["intent"] == "recon_status"

    def test_chat_iva(self, client):
        r = client.post("/api/assistant/chat", json={"question": "qual é o IVA deste trimestre?"}, headers=_T1)
        assert r.status_code == 200
        assert r.json()["intent"] == "tax_iva"

    def test_chat_inventory(self, client):
        r = client.post("/api/assistant/chat", json={"question": "como está o inventário?"}, headers=_T1)
        assert r.status_code == 200
        assert r.json()["intent"] == "inventory"

    def test_chat_suppliers(self, client):
        r = client.post("/api/assistant/chat", json={"question": "tenho fornecedores registados?"}, headers=_T1)
        assert r.status_code == 200
        assert r.json()["intent"] == "suppliers"

    def test_chat_unknown_intent(self, client):
        r = client.post("/api/assistant/chat", json={"question": "xyzzy foobar baz qux"}, headers=_T1)
        assert r.status_code == 200
        assert r.json()["intent"] == "unknown"

    def test_chat_empty_question_422(self, client):
        r = client.post("/api/assistant/chat", json={"question": ""}, headers=_T1)
        assert r.status_code == 422

    def test_chat_too_long_422(self, client):
        r = client.post("/api/assistant/chat", json={"question": "x" * 501}, headers=_T1)
        assert r.status_code == 422

    def test_tenant_isolation(self, client):
        # T1 has a document, T2 should see 0
        c = _conftest()
        c._seq["documents"] = 1
        c._tables["documents"].append({
            "id": 1, "tenant_id": "t1", "supplier_nif": "",
            "client_nif": "", "total": Decimal("500"), "vat": Decimal("0"),
            "date": None, "type": "fatura", "filename": None, "raw_text": None,
            "status": "pendente", "paperless_id": None,
            "created_at": "2025-01-01T00:00:00+00:00",
            "notes": None, "snc_account": None, "classification_source": None,
        })
        r1 = client.post("/api/assistant/chat", json={"question": "quantos documentos tenho?"}, headers=_T1)
        r2 = client.post("/api/assistant/chat", json={"question": "quantos documentos tenho?"}, headers=_T2)
        assert "1" in r1.json()["answer"]
        assert "0" in r2.json()["answer"]


# ─────────────────────────────────────────────────────────────────────────────
# 6.6  intent detection unit tests
# ─────────────────────────────────────────────────────────────────────────────

class TestIntentDetection:
    def _detect(self, q):
        from app.assistant import _detect_intent
        return _detect_intent(q)

    def test_greeting(self):
        assert self._detect("olá") == "greeting"
        assert self._detect("Bom dia") == "greeting"

    def test_dashboard(self):
        assert self._detect("como está a minha conta?") == "dashboard"
        assert self._detect("resumo geral") == "dashboard"

    def test_docs_count(self):
        assert self._detect("quantos documentos tenho?") == "docs_count"

    def test_docs_pending(self):
        assert self._detect("documentos pendentes") == "docs_pending"

    def test_bank(self):
        assert self._detect("movimentos bancários") == "bank_count"
        assert self._detect("qual é o saldo bancário?") == "bank_balance"

    def test_iva(self):
        assert self._detect("quanto de IVA tenho?") == "tax_iva"

    def test_help(self):
        assert self._detect("ajuda") == "help"
        assert self._detect("o que sabes fazer?") == "help"

    def test_unknown(self):
        assert self._detect("askjdhaksjdhaksjdh") == "unknown"


# ─────────────────────────────────────────────────────────────────────────────
# 6.7  Dashboard cache (mocked)
# ─────────────────────────────────────────────────────────────────────────────

class TestDashboardCache:
    def test_dashboard_summary_ok(self, client):
        """Dashboard summary returns 200 (cache miss → DB → returns result)."""
        r = client.get("/api/dashboard/summary", headers=_T1)
        assert r.status_code == 200
        data = r.json()
        assert "documents" in data
        assert "reconciliations" in data

    def test_dashboard_cache_hit(self, client):
        """When cache_get returns data, it's returned directly without DB call."""
        cached_data = {
            "documents": {"count": 99, "total": "999.00"},
            "bank_transactions": {"count": 0, "total": "0.00"},
            "reconciliations": 0,
            "unmatched_documents": 0,
            "pending_review": 0,
            "classified": 0,
        }
        with patch("app.routes.cache_get", return_value=cached_data):
            r = client.get("/api/dashboard/summary", headers=_T1)
        assert r.status_code == 200
        assert r.json()["documents"]["count"] == 99
