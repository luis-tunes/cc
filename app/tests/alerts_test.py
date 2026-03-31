"""Tests for the alerts module — IVA deadline computation and compliance alerts."""
import base64
import datetime
import json
import sys
from unittest.mock import patch

from app.alerts import _iva_deadline, generate_compliance_alerts


def _conftest():
    return sys.modules["tests.conftest"]


def _jwt_headers(tenant_id: str, user_id: str = "user-1") -> dict:
    payload = {"sub": user_id, "org_id": tenant_id, "email": f"{user_id}@test.pt"}
    header = base64.urlsafe_b64encode(json.dumps({"alg": "none", "typ": "JWT"}).encode()).rstrip(b"=").decode()
    body = base64.urlsafe_b64encode(json.dumps(payload).encode()).rstrip(b"=").decode()
    return {"Authorization": f"Bearer {header}.{body}."}


_T1 = _jwt_headers("t1")
_T2 = _jwt_headers("t2")


class TestIvaDeadline:
    def test_no_deadline_far_from_any(self):
        # June 20 — next deadline Aug 20 is 61 days away (>30)
        assert _iva_deadline(datetime.date(2025, 6, 20)) is None

    def test_q1_deadline_approaching(self):
        # April 20 — May 20 is 30 days away
        result = _iva_deadline(datetime.date(2025, 4, 20))
        assert result is not None
        deadline, period = result
        assert deadline == datetime.date(2025, 5, 20)
        assert period == "T1 2025"

    def test_q2_deadline_approaching(self):
        # July 25 — Aug 20 is 26 days away
        result = _iva_deadline(datetime.date(2025, 7, 25))
        assert result is not None
        deadline, period = result
        assert deadline == datetime.date(2025, 8, 20)
        assert period == "T2 2025"

    def test_q3_deadline_approaching(self):
        # Oct 25 — Nov 20 is 26 days away
        result = _iva_deadline(datetime.date(2025, 10, 25))
        assert result is not None
        deadline, period = result
        assert deadline == datetime.date(2025, 11, 20)
        assert period == "T3 2025"

    def test_q4_deadline_approaching_year_boundary(self):
        # Jan 25 2026 — Feb 20 2026 is 26 days away (T4 2025)
        result = _iva_deadline(datetime.date(2026, 1, 25))
        assert result is not None
        deadline, period = result
        assert deadline == datetime.date(2026, 2, 20)
        assert period == "T4 2025"

    def test_deadline_day_itself_returns_none(self):
        # On the deadline day (0 days left), no alert
        assert _iva_deadline(datetime.date(2025, 5, 20)) is None

    def test_day_after_deadline_returns_none(self):
        assert _iva_deadline(datetime.date(2025, 5, 21)) is None

    def test_exactly_30_days_before(self):
        # 30 days before May 20 = April 20
        result = _iva_deadline(datetime.date(2025, 4, 20))
        assert result is not None
        assert result[0] == datetime.date(2025, 5, 20)

    def test_31_days_before_returns_none(self):
        # 31 days before May 20 = April 19
        assert _iva_deadline(datetime.date(2025, 4, 19)) is None

    def test_works_for_any_year(self):
        result = _iva_deadline(datetime.date(2030, 4, 20))
        assert result is not None
        assert result[0] == datetime.date(2030, 5, 20)
        assert result[1] == "T1 2030"


class TestGenerateComplianceAlerts:
    """Test generate_compliance_alerts with a mocked DB."""

    def _make_conn(self, doc_count=5, pending_count=0, old_unreconciled=0, gap_months=None):
        """Builds a mock conn that returns controlled query results."""
        from app.tests.conftest import FakeConn
        conn = FakeConn.__new__(FakeConn)
        conn.committed = False
        conn.last_sql = None
        conn.autocommit = False

        call_count = [0]

        class FakeResult:
            def __init__(self, rows):
                self._rows = rows

            def fetchone(self):
                return self._rows[0] if self._rows else None

            def fetchall(self):
                return self._rows

        original_results = [
            # 1. doc count
            [{"cnt": doc_count}],
            # 2. DELETE old alerts
            [],
            # 3. old unreconciled count
            [{"cnt": old_unreconciled}],
        ]
        if old_unreconciled > 0:
            original_results.append([])  # INSERT unreconciled alert
        # 4. pending count
        original_results.append([{"cnt": pending_count}])
        if pending_count > 5:
            original_results.append([])  # INSERT pending alert
        # 5. gap months
        original_results.append(gap_months or [])
        if gap_months:
            original_results.append([])  # INSERT gap alert

        def fake_execute(sql, params=None):
            idx = call_count[0]
            call_count[0] += 1
            if idx < len(original_results):
                return FakeResult(original_results[idx])
            return FakeResult([])

        conn.execute = fake_execute
        conn.commit = lambda: None
        return conn

    def test_no_documents_returns_zero(self):
        """Fresh tenant with no documents — should return 0 alerts."""
        from app.tests.conftest import FakeConn
        conn = FakeConn.__new__(FakeConn)
        conn.committed = False
        conn.autocommit = False

        call_count = [0]

        class FakeResult:
            def __init__(self, rows):
                self._rows = rows
            def fetchone(self):
                return self._rows[0] if self._rows else None
            def fetchall(self):
                return self._rows

        results = [
            [{"cnt": 0}],  # doc_count = 0
            [],  # DELETE alerts
        ]

        def fake_execute(sql, params=None):
            idx = call_count[0]
            call_count[0] += 1
            if idx < len(results):
                return FakeResult(results[idx])
            return FakeResult([])

        conn.execute = fake_execute
        conn.commit = lambda: None

        with patch("app.alerts.get_conn") as mock_get:
            mock_get.return_value.__enter__ = lambda s: conn
            mock_get.return_value.__exit__ = lambda s, *a: None
            result = generate_compliance_alerts("test-tenant")
        assert result == 0


# ── Alerts CRUD (from operations_test.py) ─────────────────────────────


class TestAlertsCRUD:
    def _seed_alert(self, client=None, tenant="t1", severity="urgente", title="Teste"):
        c = _conftest()
        c._seq["alerts"] += 1
        alert = {
            "id": c._seq["alerts"],
            "tenant_id": tenant,
            "type": "unreconciled",
            "severity": severity,
            "title": title,
            "description": "desc",
            "action_url": "/reconciliacao",
            "read": False,
            "created_at": None,
        }
        c._tables["alerts"].append(alert)
        return alert

    def test_list_alerts_empty(self, client):
        r = client.get("/api/alerts", headers=_T1)
        assert r.status_code == 200
        assert r.json() == []

    def test_list_alerts_returns_seeded(self, client):
        self._seed_alert(client, title="Documentos não reconciliados")
        r = client.get("/api/alerts", headers=_T1)
        assert r.status_code == 200
        assert len(r.json()) == 1

    def test_mark_alert_read(self, client):
        alert = self._seed_alert(client)
        r = client.patch(f"/api/alerts/{alert['id']}", headers=_T1)
        assert r.status_code == 200
        assert r.json()["read"] is True

    def test_mark_alert_nonexistent_404(self, client):
        r = client.patch("/api/alerts/9999", headers=_T1)
        assert r.status_code == 404

    def test_tenant_isolation(self, client):
        self._seed_alert(client, tenant="t1")
        r = client.get("/api/alerts", headers=_T2)
        assert r.json() == []

    def test_generate_alerts_endpoint(self, client):
        """POST /alerts/generate should call the engine and return count."""
        r = client.post("/api/alerts/generate", headers=_T1)
        assert r.status_code == 200
        assert "generated" in r.json()
