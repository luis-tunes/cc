"""
Request monitoring — access logs, latency tracking, tenant activity.

Stores per-endpoint metrics in-memory (ring buffer) and flushes
tenant last_active timestamps to PostgreSQL periodically.
"""

import logging
import threading
import time
from collections import defaultdict, deque
from dataclasses import dataclass, field
from datetime import UTC, datetime

logger = logging.getLogger(__name__)

# ── In-memory metrics store ────────────────────────────────────────────

MAX_SAMPLES = 1000  # per endpoint


@dataclass(slots=True)
class RequestSample:
    timestamp: float
    method: str
    path: str
    status_code: int
    duration_ms: float
    tenant_id: str
    user_id: str
    request_id: str


@dataclass
class EndpointStats:
    samples: deque = field(default_factory=lambda: deque(maxlen=MAX_SAMPLES))
    total_requests: int = 0
    total_errors: int = 0  # 5xx
    total_client_errors: int = 0  # 4xx


class MetricsStore:
    """Thread-safe in-memory metrics. No external dependencies."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._endpoints: dict[str, EndpointStats] = defaultdict(EndpointStats)
        self._tenant_last_seen: dict[str, float] = {}
        self._tenant_request_counts: dict[str, int] = defaultdict(int)
        self._error_log: deque[dict] = deque(maxlen=500)
        self._start_time = time.monotonic()

    def record(self, sample: RequestSample) -> None:
        # Normalize path — strip query params and IDs for grouping
        route = _normalize_path(sample.path)
        with self._lock:
            stats = self._endpoints[route]
            stats.samples.append(sample)
            stats.total_requests += 1
            if sample.status_code >= 500:
                stats.total_errors += 1
            elif sample.status_code >= 400:
                stats.total_client_errors += 1

            if sample.tenant_id:
                self._tenant_last_seen[sample.tenant_id] = sample.timestamp
                self._tenant_request_counts[sample.tenant_id] += 1

            if sample.status_code >= 500:
                self._error_log.append({
                    "timestamp": datetime.fromtimestamp(sample.timestamp, tz=UTC).isoformat(),
                    "method": sample.method,
                    "path": sample.path,
                    "status": sample.status_code,
                    "duration_ms": sample.duration_ms,
                    "tenant_id": sample.tenant_id,
                    "user_id": sample.user_id,
                    "request_id": sample.request_id,
                })

    def get_endpoint_stats(self, window_seconds: int = 300) -> list[dict]:
        """Return per-endpoint stats for the last N seconds."""
        cutoff = time.time() - window_seconds
        result = []
        with self._lock:
            for route, stats in sorted(self._endpoints.items()):
                recent = [s for s in stats.samples if s.timestamp >= cutoff]
                if not recent:
                    continue
                durations = [s.duration_ms for s in recent]
                durations.sort()
                errors = sum(1 for s in recent if s.status_code >= 500)
                result.append({
                    "endpoint": route,
                    "requests": len(recent),
                    "errors": errors,
                    "error_rate": round(errors / len(recent), 4) if recent else 0,
                    "p50_ms": round(durations[len(durations) // 2], 1),
                    "p95_ms": round(durations[int(len(durations) * 0.95)], 1) if len(durations) >= 2 else round(durations[0], 1),
                    "p99_ms": round(durations[int(len(durations) * 0.99)], 1) if len(durations) >= 2 else round(durations[0], 1),
                    "avg_ms": round(sum(durations) / len(durations), 1),
                    "total_all_time": stats.total_requests,
                    "errors_all_time": stats.total_errors,
                })
        return result

    def get_error_log(self, limit: int = 100) -> list[dict]:
        with self._lock:
            return list(self._error_log)[-limit:]

    def get_tenant_activity(self) -> dict[str, dict]:
        with self._lock:
            return {
                tid: {
                    "last_seen": datetime.fromtimestamp(ts, tz=UTC).isoformat(),
                    "request_count": self._tenant_request_counts.get(tid, 0),
                }
                for tid, ts in self._tenant_last_seen.items()
            }

    def get_global_summary(self, window_seconds: int = 300) -> dict:
        cutoff = time.time() - window_seconds
        with self._lock:
            all_recent: list[RequestSample] = []
            for stats in self._endpoints.values():
                all_recent.extend(s for s in stats.samples if s.timestamp >= cutoff)

        total = len(all_recent)
        errors = sum(1 for s in all_recent if s.status_code >= 500)
        durations = sorted([s.duration_ms for s in all_recent])
        active_tenants = len({s.tenant_id for s in all_recent if s.tenant_id})

        return {
            "window_seconds": window_seconds,
            "total_requests": total,
            "total_errors": errors,
            "error_rate": round(errors / total, 4) if total else 0,
            "active_tenants": active_tenants,
            "p50_ms": round(durations[len(durations) // 2], 1) if durations else 0,
            "p95_ms": round(durations[int(len(durations) * 0.95)], 1) if len(durations) >= 2 else 0,
            "uptime_seconds": round(time.monotonic() - self._start_time),
        }

    def flush_tenant_activity(self) -> dict[str, float]:
        """Return and clear tenant last-seen data for DB persistence."""
        with self._lock:
            data = dict(self._tenant_last_seen)
        return data


# Singleton
metrics = MetricsStore()


def _normalize_path(path: str) -> str:
    """Collapse IDs to {id} for grouping: /api/documents/42 → /api/documents/{id}"""
    parts = path.split("?")[0].rstrip("/").split("/")
    normalized = []
    for part in parts:
        if part.isdigit():
            normalized.append("{id}")
        else:
            normalized.append(part)
    return "/".join(normalized)
