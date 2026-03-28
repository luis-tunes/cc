"""Tests for monitoring module."""
import time

from app.monitoring import MetricsStore, RequestSample, _normalize_path


def test_normalize_path_collapses_ids():
    assert _normalize_path("/api/documents/42") == "/api/documents/{id}"
    assert _normalize_path("/api/documents") == "/api/documents"
    assert _normalize_path("/api/products/7/cost") == "/api/products/{id}/cost"


def test_normalize_path_strips_query():
    assert _normalize_path("/api/documents?limit=10") == "/api/documents"


def test_record_and_get_stats():
    store = MetricsStore()
    now = time.time()
    for i in range(10):
        store.record(RequestSample(
            timestamp=now - i,
            method="GET",
            path="/api/documents",
            status_code=200,
            duration_ms=50 + i * 10,
            tenant_id="t1",
            user_id="u1",
            request_id=f"req-{i}",
        ))
    stats = store.get_endpoint_stats(window_seconds=60)
    assert len(stats) == 1
    ep = stats[0]
    assert ep["endpoint"] == "/api/documents"
    assert ep["requests"] == 10
    assert ep["errors"] == 0
    assert ep["p50_ms"] > 0
    assert ep["p95_ms"] >= ep["p50_ms"]


def test_record_tracks_errors():
    store = MetricsStore()
    now = time.time()
    store.record(RequestSample(
        timestamp=now, method="POST", path="/api/upload",
        status_code=500, duration_ms=100, tenant_id="t1",
        user_id="u1", request_id="err-1",
    ))
    stats = store.get_endpoint_stats(window_seconds=60)
    assert stats[0]["errors"] == 1
    assert stats[0]["error_rate"] == 1.0

    errors = store.get_error_log()
    assert len(errors) == 1
    assert errors[0]["status"] == 500


def test_tenant_activity():
    store = MetricsStore()
    now = time.time()
    store.record(RequestSample(
        timestamp=now, method="GET", path="/api/documents",
        status_code=200, duration_ms=10, tenant_id="t1",
        user_id="u1", request_id="r1",
    ))
    store.record(RequestSample(
        timestamp=now, method="GET", path="/api/documents",
        status_code=200, duration_ms=10, tenant_id="t1",
        user_id="u1", request_id="r2",
    ))
    activity = store.get_tenant_activity()
    assert "t1" in activity
    assert activity["t1"]["request_count"] == 2


def test_global_summary():
    store = MetricsStore()
    now = time.time()
    for i in range(5):
        store.record(RequestSample(
            timestamp=now, method="GET", path=f"/api/ep{i}",
            status_code=200, duration_ms=20, tenant_id=f"t{i}",
            user_id=f"u{i}", request_id=f"r{i}",
        ))
    summary = store.get_global_summary(window_seconds=60)
    assert summary["total_requests"] == 5
    assert summary["active_tenants"] == 5
    assert summary["total_errors"] == 0
    assert summary["uptime_seconds"] >= 0


def test_flush_tenant_activity():
    store = MetricsStore()
    store.record(RequestSample(
        timestamp=time.time(), method="GET", path="/api/x",
        status_code=200, duration_ms=5, tenant_id="t1",
        user_id="u1", request_id="r1",
    ))
    data = store.flush_tenant_activity()
    assert "t1" in data
