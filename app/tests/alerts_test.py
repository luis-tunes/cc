"""Tests for the alerts module — IVA deadline computation and compliance alerts."""
import datetime
from unittest.mock import patch

from app.alerts import _iva_deadline, generate_compliance_alerts


class TestIvaDeadline:
    def test_no_deadline_far_from_any(self):
        # June 20 — next deadline Aug 15 is 56 days away (>30)
        assert _iva_deadline(datetime.date(2025, 6, 20)) is None

    def test_q1_deadline_approaching(self):
        # April 20 — May 15 is 25 days away
        result = _iva_deadline(datetime.date(2025, 4, 20))
        assert result is not None
        deadline, period = result
        assert deadline == datetime.date(2025, 5, 15)
        assert period == "T1 2025"

    def test_q2_deadline_approaching(self):
        # July 20 — Aug 15 is 26 days away
        result = _iva_deadline(datetime.date(2025, 7, 20))
        assert result is not None
        deadline, period = result
        assert deadline == datetime.date(2025, 8, 15)
        assert period == "T2 2025"

    def test_q3_deadline_approaching(self):
        # Oct 20 — Nov 15 is 26 days away
        result = _iva_deadline(datetime.date(2025, 10, 20))
        assert result is not None
        deadline, period = result
        assert deadline == datetime.date(2025, 11, 15)
        assert period == "T3 2025"

    def test_q4_deadline_approaching_year_boundary(self):
        # Jan 20 2026 — Feb 15 2026 is 26 days away (T4 2025)
        result = _iva_deadline(datetime.date(2026, 1, 20))
        assert result is not None
        deadline, period = result
        assert deadline == datetime.date(2026, 2, 15)
        assert period == "T4 2025"

    def test_deadline_day_itself_returns_none(self):
        # On the deadline day (0 days left), no alert
        assert _iva_deadline(datetime.date(2025, 5, 15)) is None

    def test_day_after_deadline_returns_none(self):
        assert _iva_deadline(datetime.date(2025, 5, 16)) is None

    def test_exactly_30_days_before(self):
        # 30 days before May 15 = April 15
        result = _iva_deadline(datetime.date(2025, 4, 15))
        assert result is not None
        assert result[0] == datetime.date(2025, 5, 15)

    def test_31_days_before_returns_none(self):
        # 31 days before May 15 = April 14
        assert _iva_deadline(datetime.date(2025, 4, 14)) is None

    def test_works_for_any_year(self):
        result = _iva_deadline(datetime.date(2030, 4, 20))
        assert result is not None
        assert result[0] == datetime.date(2030, 5, 15)
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
