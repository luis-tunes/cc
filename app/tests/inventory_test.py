"""
Inventory / Operations API tests.
Covers: unit-families, suppliers, ingredients, stock-events,
        products, production, shopping-list, stats, price-history.
Uses shared FakeConn from conftest.py.
"""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


# ═══════════════════════════════════════════════════════════════════════
# ── Helpers ───────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def _create_supplier(name="Fornecedor A", **kwargs):
    body = {"name": name, "nif": "123456789", "category": "hortícolas", **kwargs}
    r = client.post("/api/suppliers", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _create_ingredient(name="Arroz", unit="kg", supplier_id=None, **kwargs):
    body = {"name": name, "unit": unit, "category": "cereais",
            "min_threshold": 5, "supplier_id": supplier_id,
            "last_cost": 1.2, "avg_cost": 1.15, **kwargs}
    r = client.post("/api/ingredients", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _create_stock_event(ingredient_id, qty=10, event_type="entrada", **kwargs):
    body = {"type": event_type, "ingredient_id": ingredient_id, "qty": qty,
            "source": "manual", **kwargs}
    r = client.post("/api/stock-events", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _create_product(code="M001", name="Marmita Arroz", ingredients_list=None, pvp=8.5, **kwargs):
    body = {"code": code, "name": name, "pvp": pvp,
            "category": "refeição", "ingredients": ingredients_list or [], **kwargs}
    r = client.post("/api/products", json=body)
    assert r.status_code == 200, r.text
    return r.json()


# ═══════════════════════════════════════════════════════════════════════
# ── Unit Families ─────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_list_unit_families_empty():
    r = client.get("/api/unit-families")
    assert r.status_code == 200
    assert r.json() == []


def test_create_unit_family():
    body = {"name": "Massa", "base_unit": "kg",
            "conversions": [{"from_unit": "g", "to_unit": "kg", "factor": 0.001}]}
    r = client.post("/api/unit-families", json=body)
    assert r.status_code == 200
    data = r.json()
    assert data["name"] == "Massa"
    assert data["base_unit"] == "kg"
    assert len(data["conversions"]) == 1


def test_create_unit_family_validation():
    r = client.post("/api/unit-families", json={"name": "", "base_unit": "kg"})
    assert r.status_code == 422


# ═══════════════════════════════════════════════════════════════════════
# ── Suppliers ─────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_list_suppliers_empty():
    r = client.get("/api/suppliers")
    assert r.status_code == 200
    assert r.json() == []


def test_create_supplier():
    data = _create_supplier("Mercado Central")
    assert data["name"] == "Mercado Central"
    assert data["nif"] == "123456789"
    assert "id" in data


def test_create_supplier_validation():
    r = client.post("/api/suppliers", json={"name": ""})
    assert r.status_code == 422


def test_update_supplier():
    sup = _create_supplier("Old Name")
    r = client.patch(f"/api/suppliers/{sup['id']}", json={"name": "New Name"})
    assert r.status_code == 200
    assert r.json()["name"] == "New Name"


def test_update_supplier_no_fields():
    sup = _create_supplier()
    r = client.patch(f"/api/suppliers/{sup['id']}", json={})
    assert r.status_code == 422


def test_update_supplier_invalid_nif():
    """PATCH with invalid NIF should be rejected."""
    sup = _create_supplier()
    r = client.patch(f"/api/suppliers/{sup['id']}", json={"nif": "abc"})
    assert r.status_code == 422
    assert "NIF" in r.json()["detail"]


def test_update_supplier_empty_name():
    """PATCH with empty name should be rejected."""
    sup = _create_supplier()
    r = client.patch(f"/api/suppliers/{sup['id']}", json={"name": ""})
    assert r.status_code == 422
    assert "name" in r.json()["detail"]


def test_delete_supplier():
    sup = _create_supplier()
    r = client.delete(f"/api/suppliers/{sup['id']}")
    assert r.status_code == 200
    assert r.json()["deleted"] is True
    r2 = client.get("/api/suppliers")
    assert len(r2.json()) == 0


# ═══════════════════════════════════════════════════════════════════════
# ── Ingredients ───────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_list_ingredients_empty():
    r = client.get("/api/ingredients")
    assert r.status_code == 200
    assert r.json() == []


def test_create_ingredient():
    data = _create_ingredient("Frango", unit="kg")
    assert data["name"] == "Frango"
    assert data["unit"] == "kg"
    assert data["stock"] == 0
    assert data["status"] == "normal"


def test_create_ingredient_validation():
    r = client.post("/api/ingredients", json={"name": ""})
    assert r.status_code == 422


def test_create_ingredient_with_supplier():
    sup = _create_supplier()
    ing = _create_ingredient("Tomate", supplier_id=sup["id"])
    assert ing["supplier_id"] == sup["id"]


def test_update_ingredient():
    ing = _create_ingredient()
    r = client.patch(f"/api/ingredients/{ing['id']}", json={"name": "Arroz Basmati"})
    assert r.status_code == 200
    assert r.json()["name"] == "Arroz Basmati"


def test_delete_ingredient():
    ing = _create_ingredient()
    r = client.delete(f"/api/ingredients/{ing['id']}")
    assert r.status_code == 200
    assert r.json()["deleted"] is True


def test_ingredients_stock_computed():
    ing = _create_ingredient("Alface", min_threshold=5)
    _create_stock_event(ing["id"], qty=20, event_type="entrada")
    r = client.get("/api/ingredients")
    items = r.json()
    assert len(items) == 1
    assert items[0]["stock"] == 20.0
    assert items[0]["status"] == "excesso"


def test_ingredients_status_baixo():
    ing = _create_ingredient("Cenoura", min_threshold=10)
    _create_stock_event(ing["id"], qty=5, event_type="entrada")
    r = client.get("/api/ingredients")
    items = r.json()
    assert items[0]["stock"] == 5.0
    assert items[0]["status"] == "baixo"


def test_ingredients_status_rutura():
    _create_ingredient("Sal", min_threshold=2)
    r = client.get("/api/ingredients")
    items = r.json()
    assert items[0]["stock"] == 0
    assert items[0]["status"] == "rutura"


# ═══════════════════════════════════════════════════════════════════════
# ── Stock Events ──────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_list_stock_events_empty():
    r = client.get("/api/stock-events")
    assert r.status_code == 200
    assert r.json() == []


def test_create_stock_event_entrada():
    ing = _create_ingredient()
    ev = _create_stock_event(ing["id"], qty=15, event_type="entrada", cost=2.5)
    assert ev["type"] == "entrada"
    assert float(ev["qty"]) == 15.0


def test_create_stock_event_saida():
    ing = _create_ingredient()
    _create_stock_event(ing["id"], qty=10, event_type="entrada")
    ev = _create_stock_event(ing["id"], qty=3, event_type="saída")
    assert ev["type"] == "saída"


def test_create_stock_event_validation():
    r = client.post("/api/stock-events", json={"type": "entrada"})
    assert r.status_code == 422


def test_create_stock_event_invalid_type():
    ing = _create_ingredient()
    r = client.post("/api/stock-events", json={"type": "invalid", "ingredient_id": ing["id"], "qty": 5})
    assert r.status_code == 422


def test_stock_ledger_math():
    """Verify entrada - saída - desperdício + ajuste math."""
    ing = _create_ingredient("Açúcar", min_threshold=5)
    _create_stock_event(ing["id"], qty=50, event_type="entrada")
    _create_stock_event(ing["id"], qty=10, event_type="saída")
    _create_stock_event(ing["id"], qty=5, event_type="desperdício")
    _create_stock_event(ing["id"], qty=3, event_type="ajuste")
    # 50 - 10 - 5 + 3 = 38
    r = client.get("/api/ingredients")
    assert r.json()[0]["stock"] == 38.0


# ═══════════════════════════════════════════════════════════════════════
# ── Products (Marmitas) ───────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_list_products_empty():
    r = client.get("/api/products")
    assert r.status_code == 200
    assert r.json() == []


def test_create_product_simple():
    prod = _create_product("M001", "Marmita Básica")
    assert prod["code"] == "M001"
    assert prod["name"] == "Marmita Básica"
    assert prod["active"] is True


def test_create_product_with_recipe():
    ing = _create_ingredient("Frango", avg_cost=5.0)
    prod = _create_product("M002", "Marmita Frango",
                           ingredients_list=[{"ingredient_id": ing["id"], "qty": 0.3, "unit": "kg", "wastage_percent": 10}],
                           pvp=9.0)
    assert prod["code"] == "M002"
    assert len(prod["ingredients"]) == 1


def test_create_product_validation():
    r = client.post("/api/products", json={"code": "", "name": ""})
    assert r.status_code == 422


def test_update_product():
    prod = _create_product()
    r = client.patch(f"/api/products/{prod['id']}", json={"name": "Updated Marmita"})
    assert r.status_code == 200


def test_delete_product():
    prod = _create_product()
    r = client.delete(f"/api/products/{prod['id']}")
    assert r.status_code == 200
    assert r.json()["deleted"] is True


# ═══════════════════════════════════════════════════════════════════════
# ── Product Cost & Production ─────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_product_cost_breakdown():
    ing = _create_ingredient("Arroz", avg_cost=1.5)
    prod = _create_product("M010", "Marmita Arroz",
                           ingredients_list=[{"ingredient_id": ing["id"], "qty": 0.5, "unit": "kg", "wastage_percent": 0}],
                           pvp=6.0)
    r = client.get(f"/api/products/{prod['id']}/cost")
    assert r.status_code == 200
    data = r.json()
    assert data["total_cost"] == 0.75
    assert data["margin"] > 0
    assert len(data["breakdown"]) == 1


def test_produce_product():
    ing = _create_ingredient("Arroz", min_threshold=5)
    _create_stock_event(ing["id"], qty=20, event_type="entrada")
    prod = _create_product("M020", "Marmita Test",
                           ingredients_list=[{"ingredient_id": ing["id"], "qty": 0.3, "unit": "kg", "wastage_percent": 0}])
    r = client.post(f"/api/products/{prod['id']}/produce", json={"qty": 5})
    assert r.status_code == 200
    data = r.json()
    assert data["produced"] == 5
    assert len(data["events"]) == 1


def test_produce_no_recipe():
    prod = _create_product("M030", "Empty Marmita")
    r = client.post(f"/api/products/{prod['id']}/produce", json={"qty": 1})
    assert r.status_code == 422


def test_stock_impact_preview():
    ing = _create_ingredient("Frango", min_threshold=5)
    _create_stock_event(ing["id"], qty=10, event_type="entrada")
    prod = _create_product("M040", "Impact Test",
                           ingredients_list=[{"ingredient_id": ing["id"], "qty": 2, "unit": "kg", "wastage_percent": 0}])
    r = client.get(f"/api/products/{prod['id']}/stock-impact?qty=3")
    assert r.status_code == 200
    data = r.json()
    assert data["qty"] == 3
    assert len(data["impact"]) == 1
    assert data["impact"][0]["current_stock"] == 10.0
    assert data["impact"][0]["needed"] == 6.0
    assert data["impact"][0]["after"] == 4.0
    assert data["sufficient"] is True


# ═══════════════════════════════════════════════════════════════════════
# ── Inventory Stats & Shopping List ───────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_inventory_stats_empty():
    r = client.get("/api/inventory/stats")
    assert r.status_code == 200
    data = r.json()
    assert data["total_ingredients"] == 0
    assert data["rutura_count"] == 0


def test_inventory_stats_with_data():
    ing = _create_ingredient("Arroz", min_threshold=10)
    _create_stock_event(ing["id"], qty=3, event_type="entrada")
    r = client.get("/api/inventory/stats")
    data = r.json()
    assert data["total_ingredients"] == 1
    assert data["baixo_count"] == 1


def test_shopping_list_empty():
    r = client.get("/api/inventory/shopping-list")
    assert r.status_code == 200
    assert r.json() == []


def test_shopping_list_with_items():
    ing = _create_ingredient("Cenoura", min_threshold=10)
    _create_stock_event(ing["id"], qty=3, event_type="entrada")
    r = client.get("/api/inventory/shopping-list")
    assert r.status_code == 200
    items = r.json()
    assert len(items) == 1
    assert items[0]["name"] == "Cenoura"
    assert items[0]["suggested_qty"] == 17.0
    assert items[0]["urgency"] == "alta"


def test_shopping_list_excludes_stocked():
    """Ingredients with stock >= threshold should not appear."""
    ing = _create_ingredient("Batata", min_threshold=5)
    _create_stock_event(ing["id"], qty=20, event_type="entrada")
    r = client.get("/api/inventory/shopping-list")
    assert r.json() == []


# ═══════════════════════════════════════════════════════════════════════
# ── Price History ─────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_add_price_point():
    sup = _create_supplier()
    ing = _create_ingredient("Azeite", supplier_id=sup["id"])
    r = client.post("/api/price-history", json={
        "ingredient_id": ing["id"], "supplier_id": sup["id"],
        "price": 4.5, "date": "2025-07-01",
    })
    assert r.status_code == 200
    data = r.json()
    assert float(data["price"]) == 4.5


def test_add_price_point_validation():
    r = client.post("/api/price-history", json={"ingredient_id": 1})
    assert r.status_code == 422


# ═══════════════════════════════════════════════════════════════════════
# ── Pagination ────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_ingredients_pagination():
    for i in range(5):
        _create_ingredient(f"Ing{i}")
    r = client.get("/api/ingredients?limit=2&offset=0")
    assert r.status_code == 200
    assert len(r.json()) == 2
    r2 = client.get("/api/ingredients?limit=2&offset=2")
    assert r2.status_code == 200
    assert len(r2.json()) == 2
    r3 = client.get("/api/ingredients?limit=10&offset=4")
    assert r3.status_code == 200
    assert len(r3.json()) == 1


def test_suppliers_pagination():
    for i in range(4):
        _create_supplier(f"Sup{i}")
    r = client.get("/api/suppliers?limit=2&offset=0")
    assert r.status_code == 200
    assert len(r.json()) == 2
    r2 = client.get("/api/suppliers?limit=2&offset=2")
    assert r2.status_code == 200
    assert len(r2.json()) == 2
    r3 = client.get("/api/suppliers?limit=10&offset=4")
    assert r3.status_code == 200
    assert len(r3.json()) == 0


def test_products_pagination():
    for i in range(3):
        _create_product(code=f"P{i:03}", name=f"Product {i}")
    r = client.get("/api/products?limit=2&offset=0")
    assert r.status_code == 200
    assert len(r.json()) == 2
    r2 = client.get("/api/products?limit=2&offset=2")
    assert r2.status_code == 200
    assert len(r2.json()) == 1


# ═══════════════════════════════════════════════════════════════════════
# ── Unit Conversion Enforcement ───────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_stock_event_same_unit_ok():
    """Stock event with same unit as ingredient passes through unchanged."""
    ing = _create_ingredient("Farinha", unit="kg")
    ev = _create_stock_event(ing["id"], qty=5, unit="kg")
    assert ev["unit"] == "kg"
    assert float(ev["qty"]) == 5


def test_stock_event_converted_unit():
    """Stock event in grams auto-converts to kg when conversion exists."""
    client.post("/api/unit-families", json={
        "name": "Peso", "base_unit": "kg",
        "conversions": [{"from_unit": "g", "to_unit": "kg", "factor": "0.001"}],
    })
    ing = _create_ingredient("Açúcar", unit="kg")
    ev = _create_stock_event(ing["id"], qty=500, unit="g")
    assert ev["unit"] == "kg"
    assert float(ev["qty"]) == 0.5


def test_stock_event_unknown_unit_rejected():
    """Stock event with unknown unit and no conversion returns 422."""
    ing = _create_ingredient("Leite", unit="L")
    r = client.post("/api/stock-events", json={
        "type": "entrada", "ingredient_id": ing["id"],
        "qty": 10, "unit": "galão",
    })
    assert r.status_code == 422
    assert "no conversion" in r.json()["detail"]


def test_stock_event_default_unit():
    """Stock event without explicit unit uses ingredient's base unit."""
    ing = _create_ingredient("Sal", unit="kg")
    ev = _create_stock_event(ing["id"], qty=2)
    assert ev["unit"] == "kg"


# ═══════════════════════════════════════════════════════════════════════
# ── Bulk Import: Ingredients ──────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def _csv_file(content: str, filename: str = "import.csv"):
    return {"file": (filename, content.encode("utf-8"), "text/csv")}


def test_import_ingredients_basic():
    csv_text = "nome;unidade;categoria;stock_minimo;custo\nArroz;kg;cereais;10;1.50\nSal;g;temperos;500;0.30\n"
    r = client.post("/api/ingredients/import", files=_csv_file(csv_text))
    assert r.status_code == 200
    data = r.json()
    assert data["imported"] == 2
    assert data["total_rows"] == 2
    assert data["errors"] == []


def test_import_ingredients_comma_delimiter():
    csv_text = "nome,unidade,categoria,stock_minimo,custo\nFarinha,kg,cereais,5,0.80\n"
    r = client.post("/api/ingredients/import", files=_csv_file(csv_text))
    assert r.status_code == 200
    assert r.json()["imported"] == 1


def test_import_ingredients_missing_columns():
    csv_text = "nome;custo\nArroz;1.50\n"
    r = client.post("/api/ingredients/import", files=_csv_file(csv_text))
    assert r.status_code == 422
    assert "unidade" in r.json()["detail"]


def test_import_ingredients_empty_name_error():
    csv_text = "nome;unidade;categoria;stock_minimo;custo\n;kg;cereais;10;1.50\nSal;g;temperos;0;0\n"
    r = client.post("/api/ingredients/import", files=_csv_file(csv_text))
    assert r.status_code == 200
    data = r.json()
    assert data["imported"] == 1
    assert len(data["errors"]) == 1
    assert "nome vazio" in data["errors"][0]


def test_import_ingredients_invalid_decimal():
    csv_text = "nome;unidade;categoria;stock_minimo;custo\nArroz;kg;cereais;abc;1.50\nSal;g;temperos;0;0.30\n"
    r = client.post("/api/ingredients/import", files=_csv_file(csv_text))
    assert r.status_code == 200
    data = r.json()
    assert data["imported"] == 1
    assert len(data["errors"]) == 1
    assert "stock_minimo" in data["errors"][0]


def test_import_ingredients_all_rows_fail():
    csv_text = "nome;unidade;categoria;stock_minimo;custo\n;kg;cereais;10;1.50\n"
    r = client.post("/api/ingredients/import", files=_csv_file(csv_text))
    assert r.status_code == 422
    assert "Nenhuma linha importada" in r.json()["detail"]


def test_import_ingredients_empty_file():
    r = client.post("/api/ingredients/import", files=_csv_file(""))
    assert r.status_code == 422


def test_import_ingredients_only_header():
    csv_text = "nome;unidade;categoria;stock_minimo;custo\n"
    r = client.post("/api/ingredients/import", files=_csv_file(csv_text))
    assert r.status_code == 422
    assert "sem dados" in r.json()["detail"].lower()


def test_import_ingredients_optional_columns():
    csv_text = "nome;unidade\nAzeite;L\n"
    r = client.post("/api/ingredients/import", files=_csv_file(csv_text))
    assert r.status_code == 200
    assert r.json()["imported"] == 1


# ═══════════════════════════════════════════════════════════════════════
# ── Bulk Import: Products ─────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_import_products_basic():
    csv_text = "codigo;nome;pvp;categoria;ativo\nP001;Marmita Frango;8.50;refeição;sim\nP002;Sopa Legumes;5.00;sopa;sim\n"
    r = client.post("/api/products/import", files=_csv_file(csv_text))
    assert r.status_code == 200
    data = r.json()
    assert data["imported"] == 2
    assert data["skipped"] == 0
    assert data["errors"] == []


def test_import_products_comma_delimiter():
    csv_text = "codigo,nome,pvp,categoria,ativo\nPC01,Bolo Chocolate,12.00,sobremesa,sim\n"
    r = client.post("/api/products/import", files=_csv_file(csv_text))
    assert r.status_code == 200
    assert r.json()["imported"] == 1


def test_import_products_duplicate_code_skipped():
    csv_text = "codigo;nome;pvp;categoria\nDUP1;Produto A;5.00;cat\n"
    r1 = client.post("/api/products/import", files=_csv_file(csv_text))
    assert r1.status_code == 200
    assert r1.json()["imported"] == 1

    r2 = client.post("/api/products/import", files=_csv_file(csv_text))
    assert r2.status_code == 200
    assert r2.json()["imported"] == 0
    assert r2.json()["skipped"] == 1


def test_import_products_missing_columns():
    csv_text = "nome;pvp\nMarmita;8.50\n"
    r = client.post("/api/products/import", files=_csv_file(csv_text))
    assert r.status_code == 422
    assert "codigo" in r.json()["detail"]


def test_import_products_empty_code_error():
    csv_text = "codigo;nome;pvp\n;Marmita;8.50\nP100;Sopa;3.00\n"
    r = client.post("/api/products/import", files=_csv_file(csv_text))
    assert r.status_code == 200
    assert r.json()["imported"] == 1
    assert len(r.json()["errors"]) == 1


def test_import_products_invalid_pvp():
    csv_text = "codigo;nome;pvp\nBAD1;Produto;abc\nGOOD1;Produto OK;5.00\n"
    r = client.post("/api/products/import", files=_csv_file(csv_text))
    assert r.status_code == 200
    assert r.json()["imported"] == 1
    assert "pvp" in r.json()["errors"][0]


def test_import_products_all_rows_fail():
    csv_text = "codigo;nome;pvp\n;Produto;8.50\n"
    r = client.post("/api/products/import", files=_csv_file(csv_text))
    assert r.status_code == 422
    assert "Nenhuma linha importada" in r.json()["detail"]


def test_import_products_inactive():
    csv_text = "codigo;nome;pvp;ativo\nINACT1;Produto Inativo;5.00;não\n"
    r = client.post("/api/products/import", files=_csv_file(csv_text))
    assert r.status_code == 200
    assert r.json()["imported"] == 1


def test_import_products_empty_file():
    r = client.post("/api/products/import", files=_csv_file(""))
    assert r.status_code == 422


def test_import_products_only_header():
    csv_text = "codigo;nome;pvp;categoria;ativo\n"
    r = client.post("/api/products/import", files=_csv_file(csv_text))
    assert r.status_code == 422
