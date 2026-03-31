"""Tests for app/assets.py — depreciation calculations."""

import base64
import datetime
import json
from decimal import Decimal

import pytest

from app.assets import compute_current_value, depreciation_schedule


def _jwt_headers(tenant_id: str, user_id: str = "user-1") -> dict:
    payload = {"sub": user_id, "org_id": tenant_id, "email": f"{user_id}@test.pt"}
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    return {"Authorization": f"Bearer {header}.{body}."}


_T1 = _jwt_headers("t1")
_T2 = _jwt_headers("t2")


def _make_asset(**overrides):
    base = {
        "acquisition_cost": "10000",
        "depreciation_method": "linha-reta",
        "useful_life_years": 5,
        "acquisition_date": "2020-01-01",
        "status": "ativo",
    }
    base.update(overrides)
    return base


class TestComputeCurrentValue:
    def test_straight_line_fully_depreciated(self):
        asset = _make_asset(acquisition_date="2015-01-01", useful_life_years=5)
        value = compute_current_value(asset)
        assert value == Decimal("0")

    def test_straight_line_partial(self):
        # Set acquisition date to 1 year ago (approximately)
        one_year_ago = (datetime.date.today() - datetime.timedelta(days=365)).isoformat()
        asset = _make_asset(acquisition_date=one_year_ago, useful_life_years=10)
        value = compute_current_value(asset)
        # After 1 year of 10-year life, ~90% remaining
        assert Decimal("8900") < value < Decimal("9100")

    def test_no_depreciation_method(self):
        asset = _make_asset(depreciation_method="não-definido")
        value = compute_current_value(asset)
        assert value == Decimal("10000")

    def test_zero_useful_life(self):
        asset = _make_asset(useful_life_years=0)
        value = compute_current_value(asset)
        assert value == Decimal("10000")

    def test_inactive_asset(self):
        asset = _make_asset(status="vendido")
        value = compute_current_value(asset)
        assert value == Decimal("10000")

    def test_future_acquisition_date(self):
        future = (datetime.date.today() + datetime.timedelta(days=30)).isoformat()
        asset = _make_asset(acquisition_date=future)
        value = compute_current_value(asset)
        assert value == Decimal("10000")

    def test_date_object_instead_of_string(self):
        old = datetime.date(2015, 1, 1)
        asset = _make_asset(acquisition_date=old, useful_life_years=5)
        value = compute_current_value(asset)
        assert value == Decimal("0")

    def test_declining_balance_partial(self):
        one_year_ago = (datetime.date.today() - datetime.timedelta(days=365)).isoformat()
        asset = _make_asset(
            acquisition_date=one_year_ago,
            depreciation_method="quotas-decrescentes",
            useful_life_years=5,
        )
        value = compute_current_value(asset)
        # Declining balance depreciates more aggressively at first
        assert Decimal("5000") < value < Decimal("7500")

    def test_declining_balance_fully_depreciated(self):
        asset = _make_asset(
            acquisition_date="2010-01-01",
            depreciation_method="quotas-decrescentes",
            useful_life_years=5,
        )
        value = compute_current_value(asset)
        assert value >= Decimal("0")

    def test_unknown_method_returns_cost(self):
        asset = _make_asset(depreciation_method="unknown-method")
        value = compute_current_value(asset)
        assert value == Decimal("10000")


class TestDepreciationSchedule:
    def test_straight_line_schedule_length(self):
        asset = _make_asset(useful_life_years=5)
        schedule = depreciation_schedule(asset)
        assert len(schedule) == 5

    def test_straight_line_schedule_values(self):
        asset = _make_asset(acquisition_cost="10000", useful_life_years=5)
        schedule = depreciation_schedule(asset)
        # Each year should depreciate 2000
        for entry in schedule:
            assert abs(entry["annual_depreciation"] - 2000.0) < 0.01
        # Last entry should be fully depreciated
        assert abs(schedule[-1]["net_book_value"]) < 0.01

    def test_straight_line_years_correct(self):
        asset = _make_asset(acquisition_date="2020-01-01", useful_life_years=3)
        schedule = depreciation_schedule(asset)
        assert [e["year"] for e in schedule] == [2020, 2021, 2022]

    def test_declining_balance_schedule(self):
        asset = _make_asset(depreciation_method="quotas-decrescentes", useful_life_years=5)
        schedule = depreciation_schedule(asset)
        assert len(schedule) == 5
        # First year depreciation should be higher than last
        assert schedule[0]["annual_depreciation"] >= schedule[-1]["annual_depreciation"]

    def test_no_schedule_for_undefined_method(self):
        asset = _make_asset(depreciation_method="não-definido")
        schedule = depreciation_schedule(asset)
        assert schedule == []

    def test_no_schedule_for_zero_life(self):
        asset = _make_asset(useful_life_years=0)
        schedule = depreciation_schedule(asset)
        assert schedule == []

    def test_accumulated_is_monotonic(self):
        asset = _make_asset(useful_life_years=10)
        schedule = depreciation_schedule(asset)
        accumulated = [e["accumulated_depreciation"] for e in schedule]
        assert accumulated == sorted(accumulated)

    def test_net_book_value_is_monotonic_decreasing(self):
        asset = _make_asset(useful_life_years=10)
        schedule = depreciation_schedule(asset)
        nbv = [e["net_book_value"] for e in schedule]
        # Should be monotonically decreasing
        for i in range(1, len(nbv)):
            assert nbv[i] <= nbv[i - 1]


# ── Asset CRUD endpoints (from operations_test.py) ───────────────────


class TestAssetsCRUD:
    _payload = {
        "name": "Servidor Dell PowerEdge",
        "category": "informático",
        "acquisition_date": "2022-01-15",
        "acquisition_cost": "5000.00",
        "useful_life_years": 4,
        "depreciation_method": "linha-reta",
        "status": "ativo",
    }

    def test_list_empty(self, client):
        r = client.get("/api/assets", headers=_T1)
        assert r.status_code == 200
        assert r.json() == []

    def test_create_asset(self, client):
        r = client.post("/api/assets", json=self._payload, headers=_T1)
        assert r.status_code == 201
        data = r.json()
        assert data["name"] == "Servidor Dell PowerEdge"
        assert data["category"] == "informático"
        assert data["id"] is not None

    def test_list_after_create(self, client):
        client.post("/api/assets", json=self._payload, headers=_T1)
        r = client.get("/api/assets", headers=_T1)
        assert len(r.json()) == 1

    def test_create_invalid_category_422(self, client):
        bad = {**self._payload, "category": "carro-de-corrida"}
        r = client.post("/api/assets", json=bad, headers=_T1)
        assert r.status_code == 422

    def test_create_invalid_method_422(self, client):
        bad = {**self._payload, "depreciation_method": "magico"}
        r = client.post("/api/assets", json=bad, headers=_T1)
        assert r.status_code == 422

    def test_get_asset_by_id(self, client):
        create = client.post("/api/assets", json=self._payload, headers=_T1)
        asset_id = create.json()["id"]
        r = client.get(f"/api/assets/{asset_id}", headers=_T1)
        assert r.status_code == 200
        assert r.json()["id"] == asset_id

    def test_get_asset_not_found(self, client):
        r = client.get("/api/assets/9999", headers=_T1)
        assert r.status_code == 404

    def test_assets_summary(self, client):
        client.post("/api/assets", json=self._payload, headers=_T1)
        r = client.get("/api/assets/summary", headers=_T1)
        assert r.status_code == 200
        data = r.json()
        assert data["total_assets"] == 1
        assert data["total_acquisition_value"] == pytest.approx(5000.0, abs=1)

    def test_delete_asset(self, client):
        create = client.post("/api/assets", json=self._payload, headers=_T1)
        asset_id = create.json()["id"]
        dr = client.delete(f"/api/assets/{asset_id}", headers=_T1)
        assert dr.status_code == 204
        assert client.get("/api/assets", headers=_T1).json() == []

    def test_delete_nonexistent_404(self, client):
        r = client.delete("/api/assets/9999", headers=_T1)
        assert r.status_code == 404

    def test_tenant_isolation(self, client):
        client.post("/api/assets", json=self._payload, headers=_T1)
        r = client.get("/api/assets", headers=_T2)
        assert r.json() == []

    def test_patch_asset_status(self, client):
        create = client.post("/api/assets", json=self._payload, headers=_T1)
        asset_id = create.json()["id"]
        r = client.patch(
            f"/api/assets/{asset_id}",
            json={"status": "vendido"},
            headers=_T1,
        )
        assert r.status_code == 200
        assert r.json()["status"] == "vendido"

    def test_patch_invalid_status_422(self, client):
        create = client.post("/api/assets", json=self._payload, headers=_T1)
        asset_id = create.json()["id"]
        r = client.patch(
            f"/api/assets/{asset_id}",
            json={"status": "inventado"},
            headers=_T1,
        )
        assert r.status_code == 422


def test_export_assets_csv(client):
    client.post(
        "/api/assets",
        json={
            "name": "Impressora",
            "category": "informático",
            "acquisition_date": "2023-01-01",
            "acquisition_cost": "800.00",
            "useful_life_years": 3,
            "depreciation_method": "linha-reta",
            "status": "ativo",
        },
        headers=_T1,
    )
    r = client.get("/api/export/assets/csv", headers=_T1)
    assert r.status_code == 200
    assert "text/csv" in r.headers.get("content-type", "")
    assert b"name" in r.content
