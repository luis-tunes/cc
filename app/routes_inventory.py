import csv
import datetime
import io
import logging
from decimal import Decimal, InvalidOperation

from fastapi import APIRouter, Depends, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field

from app.auth import AuthInfo, require_auth
from app.db import get_conn, log_activity
from app.limiter import EXPENSIVE_RATE, UPLOAD_RATE, limiter
from app.parse import validate_nif

logger = logging.getLogger(__name__)


# ── Models ────────────────────────────────────────────────────────────

class UnitFamilyConversion(BaseModel):
    from_unit: str
    to_unit: str
    factor: float = Field(gt=0)


class UnitFamilyBody(BaseModel):
    name: str = Field(min_length=1)
    base_unit: str = Field(min_length=1)
    conversions: list[UnitFamilyConversion] = []


class SupplierCreate(BaseModel):
    name: str = Field(min_length=1)
    nif: str = ""
    category: str = ""
    reliability: Decimal = Decimal("80")
    avg_delivery_days: int = Field(default=3, ge=0)
    ingredient_ids: list[int] = []

class SupplierPatch(BaseModel):
    name: str | None = None
    nif: str | None = None
    category: str | None = None
    avg_delivery_days: int | None = Field(default=None, ge=0)
    reliability: Decimal | None = None

class IngredientCreate(BaseModel):
    name: str = Field(min_length=1)
    category: str = ""
    unit: str = "kg"
    min_threshold: Decimal = Field(default=Decimal("0"), ge=0)
    last_cost: Decimal = Field(default=Decimal("0"), ge=0)
    avg_cost: Decimal = Field(default=Decimal("0"), ge=0)
    supplier_id: int | None = None

class IngredientPatch(BaseModel):
    name: str | None = None
    category: str | None = None
    unit: str | None = None
    min_threshold: Decimal | None = None
    supplier_id: int | None = None
    last_cost: Decimal | None = None
    avg_cost: Decimal | None = None

class StockEventCreate(BaseModel):
    type: str
    ingredient_id: int
    qty: Decimal = Field(gt=0)
    unit: str | None = None
    cost: Decimal | None = Field(default=None, ge=0)
    date: str | None = None
    source: str = "manual"
    reference: str = ""

class RecipeIngredientInput(BaseModel):
    ingredient_id: int
    qty: Decimal = Field(gt=0)
    unit: str = "kg"
    wastage_percent: Decimal = Decimal("0")

class ProductCreate(BaseModel):
    code: str = Field(min_length=1)
    name: str = Field(min_length=1)
    pvp: Decimal = Field(default=Decimal("0"), ge=0)
    category: str = ""
    recipe_version: str = "v1"
    active: bool = True
    ingredients: list[RecipeIngredientInput] = []

class ProductPatch(BaseModel):
    code: str | None = None
    name: str | None = None
    category: str | None = None
    pvp: Decimal | None = None
    active: bool | None = None
    recipe_version: str | None = None
    estimated_cost: Decimal | None = None
    ingredients: list[RecipeIngredientInput] | None = None

class ProduceBody(BaseModel):
    qty: int = Field(default=1, gt=0)

class PricePointCreate(BaseModel):
    ingredient_id: int
    supplier_id: int
    price: Decimal = Field(ge=0)
    date: str | None = None


# ── Helpers ───────────────────────────────────────────────────────────

def _get_current_stock(conn, ingredient_id: int, tenant_id: str) -> Decimal:
    row = conn.execute(
        """SELECT COALESCE(SUM(
            CASE
                WHEN type = 'entrada' THEN qty
                WHEN type IN ('saída', 'desperdício') THEN -qty
                WHEN type = 'ajuste' THEN qty
                ELSE 0
            END
        ), 0) AS stock
        FROM stock_events WHERE ingredient_id = %s AND tenant_id = %s""",
        (ingredient_id, tenant_id),
    ).fetchone()
    return row["stock"] if row else Decimal("0")


def _get_ingredient_status(stock: Decimal, min_threshold: Decimal) -> str:
    if stock <= 0:
        return "rutura"
    if min_threshold > 0 and stock < min_threshold:
        return "baixo"
    if min_threshold > 0 and stock > min_threshold * 3:
        return "excesso"
    return "normal"


def _get_batch_stock(conn, ingredient_ids: list[int], tenant_id: str) -> dict[int, Decimal]:
    if not ingredient_ids:
        return {}
    rows = conn.execute(
        """SELECT ingredient_id,
                    COALESCE(SUM(
                        CASE
                            WHEN type = 'entrada' THEN qty
                            WHEN type IN ('saída', 'desperdício') THEN -qty
                            WHEN type = 'ajuste' THEN qty
                            ELSE 0
                        END
                    ), 0) AS stock
             FROM stock_events
             WHERE ingredient_id = ANY(%s) AND tenant_id = %s
             GROUP BY ingredient_id""",
        (ingredient_ids, tenant_id),
    ).fetchall()
    result = {row["ingredient_id"]: row["stock"] for row in rows}
    for iid in ingredient_ids:
        result.setdefault(iid, Decimal("0"))
    return result


router = APIRouter()


# --- Unit Families ---

@router.get("/unit-families")
async def list_unit_families(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        families = conn.execute(
            "SELECT id, name, base_unit FROM unit_families WHERE tenant_id = %s ORDER BY name",
            (tid,),
        ).fetchall()
        if not families:
            return []
        fam_ids = [f["id"] for f in families]
        conv_rows = conn.execute(
            "SELECT unit_family_id, from_unit, to_unit, factor FROM unit_conversions WHERE unit_family_id = ANY(%s)",
            (fam_ids,),
        ).fetchall()
        conv_map: dict[int, list[dict]] = {}
        for c in conv_rows:
            conv_map.setdefault(c["unit_family_id"], []).append(
                {"from_unit": c["from_unit"], "to_unit": c["to_unit"], "factor": c["factor"]}
            )
        result = []
        for f in families:
            result.append({**dict(f), "conversions": conv_map.get(f["id"], [])})
    return result


@router.post("/unit-families")
async def create_unit_family(body: UnitFamilyBody, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    name = body.name
    base_unit = body.base_unit
    conversions = [c.model_dump() for c in body.conversions]
    with get_conn() as conn:
        row = conn.execute(
            "INSERT INTO unit_families (tenant_id, name, base_unit) VALUES (%s, %s, %s) RETURNING id, name, base_unit",
            (tid, name, base_unit),
        ).fetchone()
        fam_id = row["id"]
        for c in conversions:
            conn.execute(
                "INSERT INTO unit_conversions (unit_family_id, from_unit, to_unit, factor) VALUES (%s, %s, %s, %s)",
                (fam_id, c["from_unit"], c["to_unit"], Decimal(str(c["factor"]))),
            )
        log_activity(conn, tid, "unit_family", fam_id, "created", name)
        conn.commit()
    return {**dict(row), "conversions": conversions}


# --- Suppliers ---

@router.get("/suppliers")
async def list_suppliers(
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT id, name, nif, category, avg_delivery_days, reliability FROM suppliers WHERE tenant_id = %s ORDER BY name LIMIT %s OFFSET %s",
            (tid, limit, offset),
        ).fetchall()
        if not rows:
            return []
        sup_ids = [s["id"] for s in rows]
        si_rows = conn.execute(
            "SELECT supplier_id, ingredient_id FROM supplier_ingredients WHERE supplier_id = ANY(%s)",
            (sup_ids,),
        ).fetchall()
        si_map: dict[int, list[int]] = {}
        for si in si_rows:
            si_map.setdefault(si["supplier_id"], []).append(si["ingredient_id"])
        ph_rows = conn.execute(
            "SELECT ingredient_id, price, date, supplier_id FROM price_history WHERE supplier_id = ANY(%s) AND tenant_id = %s ORDER BY date DESC",
            (sup_ids, tid),
        ).fetchall()
        ph_map: dict[int, list[dict]] = {}
        for ph in ph_rows:
            ph_map.setdefault(ph["supplier_id"], []).append(dict(ph))
        result = []
        for s in rows:
            result.append({
                **dict(s),
                "ingredient_ids": si_map.get(s["id"], []),
                "price_history": ph_map.get(s["id"], [])[:50],
            })
    return result


@router.post("/suppliers")
async def create_supplier(body: SupplierCreate, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name required")
    nif = body.nif.strip()
    if nif and (not nif.isdigit() or len(nif) != 9):
        raise HTTPException(status_code=422, detail="NIF must be exactly 9 digits")
    if nif and not validate_nif(nif):
        raise HTTPException(status_code=422, detail="NIF inválido (checksum mod-11 falhou)")
    reliability = min(max(body.reliability, Decimal("0")), Decimal("100"))
    avg_days = max(body.avg_delivery_days, 0)
    with get_conn() as conn:
        row = conn.execute(
            """INSERT INTO suppliers (tenant_id, name, nif, category, avg_delivery_days, reliability)
               VALUES (%s, %s, %s, %s, %s, %s)
               RETURNING id, name, nif, category, avg_delivery_days, reliability""",
            (tid, name, nif, body.category.strip(),
             avg_days, reliability),
        ).fetchone()
        for ing_id in body.ingredient_ids:
            conn.execute(
                "INSERT INTO supplier_ingredients (supplier_id, ingredient_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (row["id"], ing_id),
            )
        log_activity(conn, tid, "supplier", row["id"], "created", name)
        conn.commit()
    return {**dict(row), "ingredient_ids": [i for i in body.ingredient_ids], "price_history": []}


@router.patch("/suppliers/{supplier_id}")
async def update_supplier(supplier_id: int, body: SupplierPatch, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    updates = body.model_dump(exclude_unset=True)
    if not updates:
        raise HTTPException(status_code=422, detail="no fields to update")
    if "nif" in updates:
        nif = (updates["nif"] or "").strip()
        if nif and (not nif.isdigit() or len(nif) != 9):
            raise HTTPException(status_code=422, detail="NIF must be exactly 9 digits")
        if nif and not validate_nif(nif):
            raise HTTPException(status_code=422, detail="NIF inválido (checksum mod-11 falhou)")
        updates["nif"] = nif
    if "name" in updates:
        name = (updates["name"] or "").strip()
        if not name:
            raise HTTPException(status_code=422, detail="name required")
        updates["name"] = name
    if "reliability" in updates and updates["reliability"] is not None:
        updates["reliability"] = min(max(updates["reliability"], Decimal("0")), Decimal("100"))
    set_parts = [f"{k} = %s" for k in updates]
    params = list(updates.values()) + [supplier_id, tid]
    with get_conn() as conn:
        row = conn.execute(
            f"UPDATE suppliers SET {', '.join(set_parts)} WHERE id = %s AND tenant_id = %s RETURNING id, name, nif, category, avg_delivery_days, reliability",
            params,
        ).fetchone()
        if row:
            log_activity(conn, tid, "supplier", supplier_id, "updated", str(list(updates.keys())))
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="supplier not found")
    return dict(row)


@router.delete("/suppliers/{supplier_id}")
async def delete_supplier(supplier_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute("DELETE FROM suppliers WHERE id = %s AND tenant_id = %s RETURNING id", (supplier_id, tid)).fetchone()
        if row:
            log_activity(conn, tid, "supplier", supplier_id, "deleted")
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="supplier not found")
    return {"deleted": True}


# --- Ingredients ---

@router.get("/ingredients")
async def list_ingredients(
    category: str | None = None,
    status_filter: str | None = None,
    limit: int = Query(default=200, le=1000),
    offset: int = Query(default=0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id
    with get_conn() as conn:
        clauses = ["i.tenant_id = %s"]
        params: list = [tid]
        if category:
            clauses.append("i.category = %s")
            params.append(category)
        where = " AND ".join(clauses)
        params.extend([limit, offset])
        rows = conn.execute(
            f"""SELECT i.id, i.name, i.category, i.unit, i.min_threshold,
                       i.supplier_id, i.last_cost, i.avg_cost,
                       s.name as supplier_name
                FROM ingredients i
                LEFT JOIN suppliers s ON s.id = i.supplier_id
                WHERE {where}
                ORDER BY i.name
                LIMIT %s OFFSET %s""",
            params,
        ).fetchall()
        if not rows:
            return []
        ing_ids = [r["id"] for r in rows]
        stock_rows = conn.execute(
            """SELECT ingredient_id,
                      COALESCE(SUM(
                          CASE
                              WHEN type = 'entrada' THEN qty
                              WHEN type IN ('saída', 'desperdício') THEN -qty
                              WHEN type = 'ajuste' THEN qty
                              ELSE 0
                          END
                      ), 0) AS stock
               FROM stock_events
               WHERE ingredient_id = ANY(%s) AND tenant_id = %s
               GROUP BY ingredient_id""",
            (ing_ids, tid),
        ).fetchall()
        stock_map: dict[int, Decimal] = {sr["ingredient_id"]: sr["stock"] for sr in stock_rows}
        result = []
        for r in rows:
            stock = stock_map.get(r["id"], Decimal("0"))
            ing_status = _get_ingredient_status(stock, r["min_threshold"])
            if status_filter and ing_status != status_filter:
                continue
            result.append({
                **dict(r),
                "stock": float(stock),
                "status": ing_status,
            })
    return result


@router.post("/ingredients")
async def create_ingredient(body: IngredientCreate, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    name = body.name.strip()
    if not name:
        raise HTTPException(status_code=422, detail="name required")
    min_threshold = max(body.min_threshold, Decimal("0"))
    last_cost = max(body.last_cost, Decimal("0"))
    avg_cost = max(body.avg_cost, Decimal("0"))
    supplier_id = body.supplier_id
    with get_conn() as conn:
        if supplier_id:
            sup = conn.execute("SELECT id FROM suppliers WHERE id = %s AND tenant_id = %s", (supplier_id, tid)).fetchone()
            if not sup:
                raise HTTPException(status_code=422, detail="supplier not found")
        row = conn.execute(
            """INSERT INTO ingredients (tenant_id, name, category, unit, min_threshold, supplier_id, last_cost, avg_cost)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, name, category, unit, min_threshold, supplier_id, last_cost, avg_cost""",
            (tid, name, body.category.strip(), body.unit,
             min_threshold, supplier_id, last_cost, avg_cost),
        ).fetchone()
        if supplier_id:
            conn.execute(
                "INSERT INTO supplier_ingredients (supplier_id, ingredient_id) VALUES (%s, %s) ON CONFLICT DO NOTHING",
                (supplier_id, row["id"]),
            )
        log_activity(conn, tid, "ingredient", row["id"], "created", name)
        conn.commit()
    return {**dict(row), "stock": 0, "status": "normal"}


@router.patch("/ingredients/{ingredient_id}")
async def update_ingredient(ingredient_id: int, body: IngredientPatch, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    fields = body.model_dump(exclude_unset=True)
    if not fields:
        raise HTTPException(status_code=422, detail="no fields to update")
    set_parts = [f"{k} = %s" for k in fields]
    params = list(fields.values()) + [ingredient_id, tid]
    with get_conn() as conn:
        row = conn.execute(
            f"""UPDATE ingredients SET {', '.join(set_parts)}
                WHERE id = %s AND tenant_id = %s
                RETURNING id, name, category, unit, min_threshold, supplier_id, last_cost, avg_cost""",
            params,
        ).fetchone()
        if row:
            log_activity(conn, tid, "ingredient", ingredient_id, "updated", str(list(fields.keys())))
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="ingredient not found")
    return dict(row)


@router.delete("/ingredients/{ingredient_id}")
async def delete_ingredient(ingredient_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute("DELETE FROM ingredients WHERE id = %s AND tenant_id = %s RETURNING id", (ingredient_id, tid)).fetchone()
        if row:
            log_activity(conn, tid, "ingredient", ingredient_id, "deleted")
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="ingredient not found")
    return {"deleted": True}


# --- Stock Events ---

@router.get("/stock-events")
async def list_stock_events(
    ingredient_id: int | None = None,
    event_type: str | None = None,
    limit: int = Query(default=100, le=1000),
    offset: int = Query(default=0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id
    clauses = ["se.tenant_id = %s"]
    params: list = [tid]
    if ingredient_id:
        clauses.append("se.ingredient_id = %s")
        params.append(ingredient_id)
    if event_type:
        clauses.append("se.type = %s")
        params.append(event_type)
    where = " AND ".join(clauses)
    params.extend([limit, offset])
    with get_conn() as conn:
        rows = conn.execute(
            f"""SELECT se.id, se.type, se.ingredient_id, se.qty, se.unit,
                       se.date, se.source, se.reference, se.cost,
                       i.name as ingredient_name
                FROM stock_events se
                JOIN ingredients i ON i.id = se.ingredient_id
                WHERE {where}
                ORDER BY se.date DESC, se.id DESC
                LIMIT %s OFFSET %s""",
            params,
        ).fetchall()
    return [dict(r) for r in rows]


@router.post("/stock-events")
@limiter.limit(EXPENSIVE_RATE)
async def create_stock_event(request: Request, body: StockEventCreate, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    event_type = body.type
    if event_type not in ("entrada", "saída", "desperdício", "ajuste"):
        raise HTTPException(status_code=422, detail="type must be entrada/saída/desperdício/ajuste")
    qty_dec = body.qty
    with get_conn() as conn:
        ing = conn.execute(
            "SELECT id, unit FROM ingredients WHERE id = %s AND tenant_id = %s",
            (body.ingredient_id, tid),
        ).fetchone()
        if not ing:
            raise HTTPException(status_code=404, detail="ingredient not found")
        event_unit = body.unit or ing["unit"]
        if event_unit != ing["unit"]:
            conv = conn.execute(
                """SELECT uc.factor FROM unit_conversions uc
                   JOIN unit_families uf ON uf.id = uc.unit_family_id
                   WHERE uc.from_unit = %s AND uc.to_unit = %s AND uf.tenant_id = %s
                   LIMIT 1""",
                (event_unit, ing["unit"], tid),
            ).fetchone()
            if not conv:
                raise HTTPException(
                    status_code=422,
                    detail=f"no conversion from '{event_unit}' to '{ing['unit']}'",
                )
            qty_dec = qty_dec * conv["factor"]
            event_unit = ing["unit"]
        cost_val = body.cost
        row = conn.execute(
            """INSERT INTO stock_events (tenant_id, type, ingredient_id, qty, unit, date, source, reference, cost)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, type, ingredient_id, qty, unit, date, source, reference, cost""",
            (tid, event_type, body.ingredient_id, qty_dec,
             event_unit,
             body.date or datetime.date.today().isoformat(),
             body.source,
             body.reference,
             cost_val),
        ).fetchone()
        if event_type == "entrada" and cost_val is not None:
            conn.execute(
                "UPDATE ingredients SET last_cost = %s WHERE id = %s",
                (cost_val, body.ingredient_id),
            )
        log_activity(conn, tid, "stock_event", row["id"], "created", f"{event_type} {qty_dec}")
        conn.commit()
    return dict(row)


# --- Products ---

@router.get("/products")
async def list_products(
    limit: int = Query(default=200, le=1000),
    offset: int = Query(default=0, ge=0),
    auth: AuthInfo = Depends(require_auth),
):
    tid = auth.tenant_id
    with get_conn() as conn:
        rows = conn.execute(
            """SELECT id, code, name, category, recipe_version,
                      estimated_cost, pvp, margin, active
               FROM products WHERE tenant_id = %s ORDER BY code
               LIMIT %s OFFSET %s""",
            (tid, limit, offset),
        ).fetchall()
        if not rows:
            return []
        prod_ids = [p["id"] for p in rows]
        recipe_rows = conn.execute(
            """SELECT ri.product_id, ri.ingredient_id, ri.qty, ri.unit, ri.wastage_percent,
                      i.name as ingredient_name, i.avg_cost
               FROM recipe_ingredients ri
               JOIN ingredients i ON i.id = ri.ingredient_id
               WHERE ri.product_id = ANY(%s)""",
            (prod_ids,),
        ).fetchall()
        recipe_map: dict[int, list[dict]] = {}
        for r in recipe_rows:
            recipe_map.setdefault(r["product_id"], []).append(dict(r))
        result = []
        for p in rows:
            result.append({
                **dict(p),
                "ingredients": recipe_map.get(p["id"], []),
            })
    return result


@router.post("/products")
async def create_product(body: ProductCreate, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    code = body.code.strip()
    name = body.name.strip()
    if not code or not name:
        raise HTTPException(status_code=422, detail="code and name required")
    pvp_val = max(body.pvp, Decimal("0"))
    ingredients_list = body.ingredients
    with get_conn() as conn:
        estimated_cost = Decimal("0")
        for ri in ingredients_list:
            ing = conn.execute("SELECT avg_cost FROM ingredients WHERE id = %s AND tenant_id = %s", (ri.ingredient_id, tid)).fetchone()
            if not ing:
                raise HTTPException(status_code=400, detail=f"ingredient {ri.ingredient_id} not found")
            waste_mult = 1 + ri.wastage_percent / 100
            estimated_cost += ri.qty * waste_mult * ing["avg_cost"]
        margin = ((pvp_val - estimated_cost) / pvp_val) if pvp_val > 0 else Decimal("0")
        row = conn.execute(
            """INSERT INTO products (tenant_id, code, name, category, recipe_version, estimated_cost, pvp, margin, active)
               VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
               RETURNING id, code, name, category, recipe_version, estimated_cost, pvp, margin, active""",
            (tid, code, name, body.category.strip(), body.recipe_version,
             estimated_cost, pvp_val, margin, body.active),
        ).fetchone()
        for ri in ingredients_list:
            conn.execute(
                """INSERT INTO recipe_ingredients (product_id, ingredient_id, qty, unit, wastage_percent)
                   VALUES (%s, %s, %s, %s, %s)""",
                (row["id"], ri.ingredient_id, ri.qty,
                 ri.unit, ri.wastage_percent),
            )
        log_activity(conn, tid, "product", row["id"], "created", name)
        conn.commit()
    return {**dict(row), "ingredients": [ri.model_dump() for ri in ingredients_list]}


@router.patch("/products/{product_id}")
async def update_product(product_id: int, body: ProductPatch, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    updates = body.model_dump(exclude_unset=True)
    ingredients_input = updates.pop("ingredients", None)
    fields = {k: v for k, v in updates.items()}
    if not fields and ingredients_input is None:
        raise HTTPException(status_code=422, detail="no fields to update")
    with get_conn() as conn:
        if "estimated_cost" in fields:
            pvp = Decimal(str(fields.get("pvp", 0)))
            if pvp <= 0:
                existing = conn.execute("SELECT pvp FROM products WHERE id = %s AND tenant_id = %s", (product_id, tid)).fetchone()
                pvp = existing["pvp"] if existing else Decimal("0")
            fields["margin"] = ((pvp - fields["estimated_cost"]) / pvp) if pvp > 0 else Decimal("0")
        if fields:
            set_parts = [f"{k} = %s" for k in fields]
            params = list(fields.values()) + [product_id, tid]
            conn.execute(
                f"UPDATE products SET {', '.join(set_parts)} WHERE id = %s AND tenant_id = %s",
                params,
            )
        if ingredients_input is not None:
            existing_prod = conn.execute(
                "SELECT id, pvp FROM products WHERE id = %s AND tenant_id = %s", (product_id, tid)
            ).fetchone()
            if not existing_prod:
                raise HTTPException(status_code=404, detail="product not found")
            conn.execute("DELETE FROM recipe_ingredients WHERE product_id = %s", (product_id,))
            estimated_cost = Decimal("0")
            for ri in ingredients_input:
                ing = conn.execute("SELECT avg_cost FROM ingredients WHERE id = %s AND tenant_id = %s", (ri["ingredient_id"], tid)).fetchone()
                if not ing:
                    raise HTTPException(status_code=400, detail=f"ingredient {ri['ingredient_id']} not found")
                conn.execute(
                    """INSERT INTO recipe_ingredients (product_id, ingredient_id, qty, unit, wastage_percent)
                       VALUES (%s, %s, %s, %s, %s)""",
                    (product_id, ri["ingredient_id"], Decimal(str(ri["qty"])),
                     ri.get("unit", "kg"), Decimal(str(ri.get("wastage_percent", 0)))),
                )
                waste_mult = 1 + Decimal(str(ri.get("wastage_percent", 0))) / 100
                estimated_cost += Decimal(str(ri["qty"])) * waste_mult * ing["avg_cost"]
            if ingredients_input:
                pvp = Decimal(str(updates.get("pvp", 0)))
                if pvp <= 0:
                    pvp = existing_prod["pvp"] if existing_prod else Decimal("0")
                margin = ((pvp - estimated_cost) / pvp) if pvp > 0 else Decimal("0")
                conn.execute(
                    "UPDATE products SET estimated_cost = %s, margin = %s WHERE id = %s",
                    (estimated_cost, margin, product_id),
                )
        log_activity(conn, tid, "product", product_id, "updated", str(list(updates.keys())))
        conn.commit()
        row = conn.execute(
            "SELECT id, code, name, category, recipe_version, estimated_cost, pvp, margin, active FROM products WHERE id = %s AND tenant_id = %s",
            (product_id, tid),
        ).fetchone()
    if not row:
        raise HTTPException(status_code=404, detail="product not found")
    return dict(row)


@router.delete("/products/{product_id}")
async def delete_product(product_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        row = conn.execute("DELETE FROM products WHERE id = %s AND tenant_id = %s RETURNING id", (product_id, tid)).fetchone()
        if row:
            log_activity(conn, tid, "product", product_id, "deleted")
        conn.commit()
    if not row:
        raise HTTPException(status_code=404, detail="product not found")
    return {"deleted": True}


@router.get("/products/{product_id}/cost")
async def get_product_cost(product_id: int, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        prod = conn.execute(
            "SELECT id, pvp FROM products WHERE id = %s AND tenant_id = %s", (product_id, tid),
        ).fetchone()
        if not prod:
            raise HTTPException(status_code=404, detail="product not found")
        recipe = conn.execute(
            """SELECT ri.ingredient_id, ri.qty, ri.wastage_percent,
                      i.name, i.avg_cost, i.unit
               FROM recipe_ingredients ri
               JOIN ingredients i ON i.id = ri.ingredient_id AND i.tenant_id = %s
               WHERE ri.product_id = %s""",
            (tid, product_id),
        ).fetchall()
        total_cost = Decimal("0")
        breakdown = []
        for r in recipe:
            waste_mult = 1 + r["wastage_percent"] / 100
            line_cost = r["qty"] * waste_mult * r["avg_cost"]
            total_cost += line_cost
            breakdown.append({
                "ingredient_id": r["ingredient_id"],
                "name": r["name"],
                "qty": float(r["qty"]),
                "wastage_percent": float(r["wastage_percent"]),
                "avg_cost": float(r["avg_cost"]),
                "line_cost": float(line_cost),
            })
        pvp = prod["pvp"]
        margin = float((pvp - total_cost) / pvp) if pvp > 0 else 0
    return {"total_cost": float(total_cost), "margin": margin, "breakdown": breakdown}


@router.post("/products/{product_id}/produce")
@limiter.limit(EXPENSIVE_RATE)
async def produce_product(request: Request, product_id: int, body: ProduceBody, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    qty_to_produce = body.qty
    with get_conn() as conn:
        prod = conn.execute(
            "SELECT id, name, code FROM products WHERE id = %s AND tenant_id = %s",
            (product_id, tid),
        ).fetchone()
        if not prod:
            raise HTTPException(status_code=404, detail="product not found")
        recipe = conn.execute(
            "SELECT ingredient_id, qty, unit, wastage_percent FROM recipe_ingredients WHERE product_id = %s",
            (product_id,),
        ).fetchall()
        if not recipe:
            raise HTTPException(status_code=422, detail="product has no recipe")
        ing_ids = [ri["ingredient_id"] for ri in recipe]
        conn.execute(
            "SELECT id FROM ingredients WHERE id = ANY(%s) AND tenant_id = %s FOR UPDATE",
            (ing_ids, tid),
        )
        stock_map = _get_batch_stock(conn, ing_ids, tid)
        for ri in recipe:
            waste_mult = 1 + ri["wastage_percent"] / 100
            needed = ri["qty"] * waste_mult * qty_to_produce
            if stock_map.get(ri["ingredient_id"], Decimal("0")) < needed:
                raise HTTPException(status_code=422, detail=f"insufficient stock for ingredient {ri['ingredient_id']}")
        events_created = []
        for ri in recipe:
            waste_mult = 1 + ri["wastage_percent"] / 100
            total_qty = ri["qty"] * waste_mult * qty_to_produce
            row = conn.execute(
                """INSERT INTO stock_events (tenant_id, type, ingredient_id, qty, unit, date, source, reference)
                   VALUES (%s, 'saída', %s, %s, %s, %s, 'produção', %s)
                   RETURNING id, type, ingredient_id, qty, unit, date, source, reference""",
                (tid, ri["ingredient_id"], total_qty, ri["unit"],
                 datetime.date.today().isoformat(), f"{prod['code']} x{qty_to_produce}"),
            ).fetchone()
            events_created.append(dict(row))
        log_activity(conn, tid, "product", product_id, "produced", f"x{qty_to_produce}")
        conn.commit()
    return {"produced": qty_to_produce, "product": prod["name"], "events": events_created}


@router.get("/products/{product_id}/stock-impact")
async def get_stock_impact(product_id: int, qty: int = 1, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        prod = conn.execute(
            "SELECT id FROM products WHERE id = %s AND tenant_id = %s", (product_id, tid),
        ).fetchone()
        if not prod:
            raise HTTPException(status_code=404, detail="product not found")
        recipe = conn.execute(
            """SELECT ri.ingredient_id, ri.qty, ri.unit, ri.wastage_percent,
                      i.name, i.min_threshold
               FROM recipe_ingredients ri
               JOIN ingredients i ON i.id = ri.ingredient_id AND i.tenant_id = %s
               WHERE ri.product_id = %s""",
            (tid, product_id),
        ).fetchall()
        impact = []
        sufficient = True
        for ri in recipe:
            current_stock = _get_current_stock(conn, ri["ingredient_id"], tid)
            waste_mult = 1 + ri["wastage_percent"] / 100
            needed = ri["qty"] * waste_mult * qty
            after = current_stock - needed
            is_ok = after >= 0
            if not is_ok:
                sufficient = False
            impact.append({
                "ingredient_id": ri["ingredient_id"],
                "name": ri["name"],
                "current_stock": float(current_stock),
                "needed": float(needed),
                "after": float(after),
                "unit": ri["unit"],
                "sufficient": is_ok,
            })
    return {"qty": qty, "sufficient": sufficient, "impact": impact}


# --- Inventory Stats & Shopping List ---

@router.get("/inventory/stats")
async def inventory_stats(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        total = conn.execute(
            "SELECT COUNT(*) as count FROM ingredients WHERE tenant_id = %s", (tid,),
        ).fetchone()
        ingredients = conn.execute(
            "SELECT id, min_threshold, avg_cost FROM ingredients WHERE tenant_id = %s", (tid,),
        ).fetchall()
        rutura_count = 0
        baixo_count = 0
        stock_value = Decimal("0")
        stock_map = _get_batch_stock(conn, [i["id"] for i in ingredients], tid)
        for ing in ingredients:
            stock = stock_map.get(ing["id"], Decimal("0"))
            status = _get_ingredient_status(stock, ing["min_threshold"])
            if status == "rutura":
                rutura_count += 1
            elif status == "baixo":
                baixo_count += 1
            stock_value += stock * ing["avg_cost"]
        entradas = conn.execute(
            "SELECT COUNT(*) as count FROM stock_events WHERE tenant_id = %s AND type = 'entrada' AND date >= CURRENT_DATE - INTERVAL '30 days'",
            (tid,),
        ).fetchone()
        saidas = conn.execute(
            "SELECT COUNT(*) as count FROM stock_events WHERE tenant_id = %s AND type IN ('saída', 'desperdício') AND date >= CURRENT_DATE - INTERVAL '30 days'",
            (tid,),
        ).fetchone()
    return {
        "total_ingredients": total["count"],
        "rutura_count": rutura_count,
        "baixo_count": baixo_count,
        "stock_value": float(stock_value),
        "recent_entradas": entradas["count"],
        "recent_saidas": saidas["count"],
    }


@router.get("/inventory/shopping-list")
async def shopping_list(auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    with get_conn() as conn:
        ingredients = conn.execute(
            """SELECT i.id, i.name, i.unit, i.min_threshold, i.supplier_id,
                      i.last_cost, i.avg_cost, s.name as supplier_name
               FROM ingredients i
               LEFT JOIN suppliers s ON s.id = i.supplier_id
               WHERE i.tenant_id = %s AND i.min_threshold > 0
               ORDER BY i.name""",
            (tid,),
        ).fetchall()
        items = []
        stock_map = _get_batch_stock(conn, [i["id"] for i in ingredients], tid)
        for ing in ingredients:
            stock = stock_map.get(ing["id"], Decimal("0"))
            if stock >= ing["min_threshold"]:
                continue
            suggested_qty = float(ing["min_threshold"] * 2 - stock)
            if stock <= 0:
                urgency = "urgente"
            elif stock < ing["min_threshold"]:
                urgency = "alta"
            else:
                urgency = "normal"
            items.append({
                "ingredient_id": ing["id"],
                "name": ing["name"],
                "current_stock": float(stock),
                "threshold": float(ing["min_threshold"]),
                "suggested_qty": suggested_qty,
                "unit": ing["unit"],
                "supplier_id": ing["supplier_id"],
                "supplier_name": ing.get("supplier_name"),
                "last_price": float(ing["last_cost"]),
                "avg_price": float(ing["avg_cost"]),
                "urgency": urgency,
            })
    return items


# --- Price History ---

@router.post("/price-history")
@limiter.limit(EXPENSIVE_RATE)
async def add_price_point(request: Request, body: PricePointCreate, auth: AuthInfo = Depends(require_auth)):
    tid = auth.tenant_id
    price_dec = body.price
    with get_conn() as conn:
        if not conn.execute("SELECT id FROM ingredients WHERE id = %s AND tenant_id = %s", (body.ingredient_id, tid)).fetchone():
            raise HTTPException(status_code=404, detail="ingredient not found")
        if not conn.execute("SELECT id FROM suppliers WHERE id = %s AND tenant_id = %s", (body.supplier_id, tid)).fetchone():
            raise HTTPException(status_code=404, detail="supplier not found")
        row = conn.execute(
            """INSERT INTO price_history (tenant_id, ingredient_id, supplier_id, price, date)
               VALUES (%s, %s, %s, %s, %s)
               RETURNING id, ingredient_id, supplier_id, price, date""",
            (tid, body.ingredient_id, body.supplier_id, price_dec,
             body.date or datetime.date.today().isoformat()),
        ).fetchone()
        avg = conn.execute(
            "SELECT AVG(price) as avg_price FROM price_history WHERE ingredient_id = %s AND tenant_id = %s",
            (body.ingredient_id, tid),
        ).fetchone()
        if avg and avg["avg_price"]:
            conn.execute(
                "UPDATE ingredients SET avg_cost = %s, last_cost = %s WHERE id = %s",
                (avg["avg_price"], price_dec, body.ingredient_id),
            )
        log_activity(conn, tid, "price_history", row["id"], "created", f"ing={body.ingredient_id} sup={body.supplier_id}")
        conn.commit()
    return dict(row)


# ── Bulk Import ───────────────────────────────────────────────────────

MAX_IMPORT_BYTES = 5 * 1024 * 1024  # 5 MB
MAX_IMPORT_ROWS = 5000

INGREDIENTS_REQUIRED_COLS = {"nome", "unidade"}
INGREDIENTS_OPTIONAL_COLS = {"categoria", "stock_minimo", "custo"}

PRODUCTS_REQUIRED_COLS = {"codigo", "nome", "pvp"}
PRODUCTS_OPTIONAL_COLS = {"categoria", "ativo"}


def _parse_csv_text(content: bytes) -> tuple[str, list[str]]:
    """Decode bytes and detect delimiter. Returns (text, fieldnames or [])."""
    text = content.decode("utf-8-sig")
    # Detect delimiter: semicolon or comma
    first_line = text.split("\n", 1)[0]
    delimiter = ";" if ";" in first_line else ","
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    fieldnames = [f.strip().lower() for f in (reader.fieldnames or [])]
    return text, fieldnames


def _read_csv_rows(text: str, delimiter: str) -> list[dict[str, str]]:
    reader = csv.DictReader(io.StringIO(text), delimiter=delimiter)
    rows: list[dict[str, str]] = []
    for row in reader:
        normalized = {k.strip().lower(): v.strip() for k, v in row.items() if k}
        rows.append(normalized)
    return rows


def _parse_decimal(value: str, field_name: str, line_num: int) -> Decimal:
    value = value.replace(",", ".").strip()
    if not value:
        return Decimal("0")
    try:
        d = Decimal(value)
        if d < 0:
            raise ValueError(f"Linha {line_num}: {field_name} não pode ser negativo")
        return d
    except (InvalidOperation, ValueError) as e:
        if isinstance(e, ValueError):
            raise
        raise ValueError(f"Linha {line_num}: {field_name} inválido '{value}'") from e


@router.post("/ingredients/import")
@limiter.limit(UPLOAD_RATE)
async def import_ingredients_csv(request: Request, file: UploadFile, auth: AuthInfo = Depends(require_auth)):
    content = await file.read()
    if len(content) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail=f"Ficheiro demasiado grande (máx {MAX_IMPORT_BYTES // (1024*1024)} MB)")

    text, fieldnames = _parse_csv_text(content)
    if not fieldnames:
        raise HTTPException(status_code=422, detail="Ficheiro CSV vazio ou sem cabeçalho")

    missing = INGREDIENTS_REQUIRED_COLS - set(fieldnames)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Colunas obrigatórias em falta: {', '.join(sorted(missing))}. "
                   f"Colunas encontradas: {', '.join(fieldnames)}. "
                   f"Formato esperado: nome;unidade;categoria;stock_minimo;custo",
        )

    delimiter = ";" if ";" in text.split("\n", 1)[0] else ","
    rows = _read_csv_rows(text, delimiter)
    if not rows:
        raise HTTPException(status_code=422, detail="Ficheiro CSV sem dados (apenas cabeçalho)")
    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(status_code=422, detail=f"Máximo de {MAX_IMPORT_ROWS} linhas permitido")

    tid = auth.tenant_id
    imported = 0
    errors: list[str] = []

    with get_conn() as conn:
        for line_num, row in enumerate(rows, start=2):
            name = row.get("nome", "").strip()
            if not name:
                errors.append(f"Linha {line_num}: nome vazio")
                continue

            unit = row.get("unidade", "kg").strip() or "kg"
            category = row.get("categoria", "").strip()

            try:
                min_threshold = _parse_decimal(row.get("stock_minimo", "0"), "stock_minimo", line_num)
                cost = _parse_decimal(row.get("custo", "0"), "custo", line_num)
            except ValueError as e:
                errors.append(str(e))
                continue

            r = conn.execute(
                """INSERT INTO ingredients (tenant_id, name, category, unit, min_threshold, supplier_id, last_cost, avg_cost)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (tid, name, category, unit, min_threshold, None, cost, cost),
            ).fetchone()
            log_activity(conn, tid, "ingredient", r["id"], "created", f"import: {name}")
            imported += 1

        conn.commit()

    if imported == 0 and errors:
        raise HTTPException(status_code=422, detail="Nenhuma linha importada. Erros: " + "; ".join(errors[:10]))

    return {"imported": imported, "errors": errors[:20], "total_rows": len(rows)}


@router.post("/products/import")
@limiter.limit(UPLOAD_RATE)
async def import_products_csv(request: Request, file: UploadFile, auth: AuthInfo = Depends(require_auth)):
    content = await file.read()
    if len(content) > MAX_IMPORT_BYTES:
        raise HTTPException(status_code=413, detail=f"Ficheiro demasiado grande (máx {MAX_IMPORT_BYTES // (1024*1024)} MB)")

    text, fieldnames = _parse_csv_text(content)
    if not fieldnames:
        raise HTTPException(status_code=422, detail="Ficheiro CSV vazio ou sem cabeçalho")

    missing = PRODUCTS_REQUIRED_COLS - set(fieldnames)
    if missing:
        raise HTTPException(
            status_code=422,
            detail=f"Colunas obrigatórias em falta: {', '.join(sorted(missing))}. "
                   f"Colunas encontradas: {', '.join(fieldnames)}. "
                   f"Formato esperado: codigo;nome;pvp;categoria;ativo",
        )

    delimiter = ";" if ";" in text.split("\n", 1)[0] else ","
    rows = _read_csv_rows(text, delimiter)
    if not rows:
        raise HTTPException(status_code=422, detail="Ficheiro CSV sem dados (apenas cabeçalho)")
    if len(rows) > MAX_IMPORT_ROWS:
        raise HTTPException(status_code=422, detail=f"Máximo de {MAX_IMPORT_ROWS} linhas permitido")

    tid = auth.tenant_id
    imported = 0
    skipped = 0
    errors: list[str] = []

    with get_conn() as conn:
        # Pre-load existing product codes to skip duplicates
        existing_rows = conn.execute(
            "SELECT code FROM products WHERE tenant_id = %s", (tid,),
        ).fetchall()
        existing_codes = {r["code"].lower() for r in existing_rows}

        for line_num, row in enumerate(rows, start=2):
            code = row.get("codigo", "").strip()
            name = row.get("nome", "").strip()
            if not code:
                errors.append(f"Linha {line_num}: código vazio")
                continue
            if not name:
                errors.append(f"Linha {line_num}: nome vazio")
                continue

            if code.lower() in existing_codes:
                skipped += 1
                continue

            try:
                pvp = _parse_decimal(row.get("pvp", "0"), "pvp", line_num)
            except ValueError as e:
                errors.append(str(e))
                continue

            category = row.get("categoria", "").strip()
            active_raw = row.get("ativo", "sim").strip().lower()
            active = active_raw not in ("não", "nao", "false", "0", "n", "inativo")

            margin = Decimal("0")  # No recipe yet → margin = 0
            conn.execute(
                """INSERT INTO products (tenant_id, code, name, category, recipe_version, estimated_cost, pvp, margin, active)
                   VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
                   RETURNING id""",
                (tid, code, name, category, "v1", Decimal("0"), pvp, margin, active),
            ).fetchone()
            existing_codes.add(code.lower())
            imported += 1

        conn.commit()

    if imported == 0 and errors and skipped == 0:
        raise HTTPException(status_code=422, detail="Nenhuma linha importada. Erros: " + "; ".join(errors[:10]))

    return {"imported": imported, "skipped": skipped, "errors": errors[:20], "total_rows": len(rows)}
