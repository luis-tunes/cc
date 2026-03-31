"""Accounting routes tests — seed, accounts, journals, entries, reports."""
from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app, raise_server_exceptions=False)


# ═══════════════════════════════════════════════════════════════════════
# ── Helpers ───────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def _seed():
    r = client.post("/api/accounting/seed")
    assert r.status_code == 200, r.text
    return r.json()


def _create_account(code="9999", name="Test account", type_="expense"):
    body = {"code": code, "name": name, "type": type_}
    r = client.post("/api/accounts", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _create_period(name="2024", start="2024-01-01", end="2024-12-31"):
    body = {"name": name, "start_date": start, "end_date": end}
    r = client.post("/api/fiscal-periods", json=body)
    assert r.status_code == 200, r.text
    return r.json()


def _create_entry(journal_id, period_id, lines, **kwargs):
    body = {
        "journal_id": journal_id,
        "period_id": period_id,
        "entry_date": kwargs.get("entry_date", "2024-06-15"),
        "description": kwargs.get("description", "Test entry"),
        "lines": lines,
    }
    r = client.post("/api/journal-entries", json=body)
    return r


# ═══════════════════════════════════════════════════════════════════════
# ── Seed ──────────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_seed_accounting():
    data = _seed()
    assert data["accounts_seeded"] > 0
    assert data["journals_seeded"] > 0


def test_seed_idempotent():
    _seed()
    data = _seed()
    # Second seed should still succeed (ON CONFLICT DO NOTHING)
    assert data["accounts_seeded"] >= 0


# ═══════════════════════════════════════════════════════════════════════
# ── Accounts ──────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_list_accounts_empty():
    r = client.get("/api/accounts")
    assert r.status_code == 200
    assert r.json() == []


def test_create_account():
    acc = _create_account()
    assert acc["code"] == "9999"
    assert acc["name"] == "Test account"


def test_list_accounts_after_create():
    _create_account()
    r = client.get("/api/accounts")
    assert r.status_code == 200
    assert len(r.json()) >= 1


def test_patch_account():
    acc = _create_account()
    r = client.patch(f"/api/accounts/{acc['id']}", json={"name": "Updated"})
    assert r.status_code == 200
    assert r.json()["name"] == "Updated"


# ═══════════════════════════════════════════════════════════════════════
# ── Fiscal Periods ────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_list_fiscal_periods_empty():
    r = client.get("/api/fiscal-periods")
    assert r.status_code == 200
    assert r.json() == []


def test_create_fiscal_period():
    p = _create_period()
    assert p["name"] == "2024"
    assert p["status"] == "open"


def test_close_fiscal_period():
    p = _create_period()
    r = client.post(f"/api/fiscal-periods/{p['id']}/close")
    assert r.status_code == 200
    assert r.json()["status"] == "closed"


# ═══════════════════════════════════════════════════════════════════════
# ── Journals ──────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_list_journals_empty():
    r = client.get("/api/accounting-journals")
    assert r.status_code == 200
    assert r.json() == []


def test_list_journals_after_seed():
    _seed()
    r = client.get("/api/accounting-journals")
    assert r.status_code == 200
    assert len(r.json()) > 0


# ═══════════════════════════════════════════════════════════════════════
# ── Journal Entries ───────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_create_journal_entry():
    _seed()
    period = _create_period()
    journals = client.get("/api/accounting-journals").json()
    jid = journals[0]["id"]
    accounts = client.get("/api/accounts").json()
    c1 = accounts[0]["code"]
    c2 = accounts[1]["code"]
    lines = [
        {"account_code": c1, "debit": "100", "credit": "0", "description": "Debit"},
        {"account_code": c2, "debit": "0", "credit": "100", "description": "Credit"},
    ]
    r = _create_entry(jid, period["id"], lines)
    assert r.status_code == 200, r.text
    entry = r.json()
    assert entry["id"] > 0


def test_create_journal_entry_unbalanced():
    _seed()
    period = _create_period()
    journals = client.get("/api/accounting-journals").json()
    jid = journals[0]["id"]
    accounts = client.get("/api/accounts").json()
    c1 = accounts[0]["code"]
    lines = [
        {"account_code": c1, "debit": "100", "credit": "0", "description": "Debit only"},
    ]
    r = _create_entry(jid, period["id"], lines)
    assert r.status_code == 400


def test_list_journal_entries():
    _seed()
    period = _create_period()
    journals = client.get("/api/accounting-journals").json()
    jid = journals[0]["id"]
    accounts = client.get("/api/accounts").json()
    c1, c2 = accounts[0]["code"], accounts[1]["code"]
    lines = [
        {"account_code": c1, "debit": "50", "credit": "0"},
        {"account_code": c2, "debit": "0", "credit": "50"},
    ]
    _create_entry(jid, period["id"], lines)
    r = client.get("/api/journal-entries")
    assert r.status_code == 200
    data = r.json()
    assert len(data) >= 1


def test_get_journal_entry():
    _seed()
    period = _create_period()
    journals = client.get("/api/accounting-journals").json()
    jid = journals[0]["id"]
    accounts = client.get("/api/accounts").json()
    c1, c2 = accounts[0]["code"], accounts[1]["code"]
    lines = [
        {"account_code": c1, "debit": "200", "credit": "0"},
        {"account_code": c2, "debit": "0", "credit": "200"},
    ]
    r = _create_entry(jid, period["id"], lines)
    eid = r.json()["id"]
    r2 = client.get(f"/api/journal-entries/{eid}")
    assert r2.status_code == 200
    assert r2.json()["id"] == eid


# ═══════════════════════════════════════════════════════════════════════
# ── Reports ───────────────────────────────────────────────────────────
# ═══════════════════════════════════════════════════════════════════════

def test_trial_balance_empty():
    r = client.get("/api/reports/trial-balance")
    assert r.status_code == 200
    data = r.json()
    assert "accounts" in data or "total_debit" in data


def test_trial_balance_with_entries():
    _seed()
    period = _create_period()
    journals = client.get("/api/accounting-journals").json()
    jid = journals[0]["id"]
    accounts = client.get("/api/accounts").json()
    c1, c2 = accounts[0]["code"], accounts[1]["code"]
    lines = [
        {"account_code": c1, "debit": "1000", "credit": "0"},
        {"account_code": c2, "debit": "0", "credit": "1000"},
    ]
    _create_entry(jid, period["id"], lines)
    r = client.get("/api/reports/trial-balance")
    assert r.status_code == 200
    data = r.json()
    assert "accounts" in data or "total_debit" in data


def test_general_ledger():
    _seed()
    accounts = client.get("/api/accounts").json()
    code = accounts[0]["code"]
    r = client.get(f"/api/reports/general-ledger/{code}")
    assert r.status_code == 200


def test_balance_sheet():
    r = client.get("/api/reports/balance-sheet")
    assert r.status_code == 200
    bs = r.json()
    assert isinstance(bs, dict)


def test_profit_loss():
    r = client.get("/api/reports/profit-loss")
    assert r.status_code == 200
    pl = r.json()
    assert "rendimentos" in pl or "revenue" in pl
    assert "gastos" in pl or "expenses" in pl


def test_iva_declaration():
    r = client.get("/api/reports/iva-declaration?year=2024")
    assert r.status_code == 200
