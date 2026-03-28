import logging
import os
import uuid
from contextlib import asynccontextmanager

import sentry_sdk
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.auth import check_auth_config
from app.billing import init_billing_db
from app.billing import router as billing_router
from app.db import close_pool, init_db
from app.limiter import limiter
from app.routes import router

# ── Structured logging ─────────────────────────────────────────────────
_log_format = os.environ.get("LOG_FORMAT", "text")  # "json" or "text"
if _log_format == "json":
    from pythonjsonlogger.json import JsonFormatter
    _handler = logging.StreamHandler()
    _handler.setFormatter(JsonFormatter(fmt="%(asctime)s %(name)s %(levelname)s %(message)s", rename_fields={"asctime": "timestamp", "levelname": "level"}))
    logging.root.handlers = [_handler]
    logging.root.setLevel(logging.INFO)
else:
    logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

# ── Sentry (optional) ─────────────────────────────────────────────────
_sentry_dsn = os.environ.get("SENTRY_DSN", "")
if _sentry_dsn:
    _traces_rate = float(os.environ.get("SENTRY_TRACES_SAMPLE_RATE", "0.1"))
    sentry_sdk.init(dsn=_sentry_dsn, traces_sample_rate=_traces_rate, profiles_sample_rate=_traces_rate, enable_tracing=True)
    logger.info("startup: Sentry initialized")


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("startup: PAPERLESS_URL=%s", os.environ.get("PAPERLESS_URL", "(not set)"))
    logger.info("startup: PAPERLESS_TOKEN=%s", "set" if os.environ.get("PAPERLESS_TOKEN") else "EMPTY")
    logger.info("startup: AUTH_DISABLED=%s", os.environ.get("AUTH_DISABLED", "0"))
    logger.info("startup: DATABASE_URL=%s", "set" if os.environ.get("DATABASE_URL") else "EMPTY")
    check_auth_config()
    if not os.environ.get("PAPERLESS_TOKEN"):
        logger.warning("startup: PAPERLESS_TOKEN is empty — OCR will fall back to pdftotext/vision")
    init_db()
    init_billing_db()
    logger.info("startup: DB initialized OK")
    yield
    close_pool()

app = FastAPI(title="xtim.ai — Contabilidade Inteligente", lifespan=lifespan)

# ── CORS (needed for local frontend dev with Vite proxy) ───────────────
_cors_origins = os.environ.get("CORS_ORIGINS", "http://localhost:3000,http://localhost:5173").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _cors_origins],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Rate limiting ──────────────────────────────────────────────────────
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)  # type: ignore[arg-type]


# ── Security headers middleware ────────────────────────────────────────
@app.middleware("http")
async def security_headers_middleware(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
    return response


# ── Request ID middleware ──────────────────────────────────────────────
@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid.uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

@app.get("/health")
async def health():
    return {"status": "ok"}

# All API routes under /api
app.include_router(router, prefix="/api")
app.include_router(billing_router, prefix="/api")

# Backward-compat: Paperless post-consume calls /webhook without /api prefix
@app.post("/webhook")
async def webhook_compat(request: Request, payload: dict):
    from app.routes import WebhookRequest, paperless_webhook
    return await paperless_webhook(request, WebhookRequest(**payload))

_web_dir = os.environ.get("WEB_DIR", "/opt/tim/web")
if os.path.isdir(_web_dir):
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(_web_dir, "assets")), name="assets")

    # SPA fallback — serve index.html for all non-API, non-asset routes
    _real_web_dir = os.path.realpath(_web_dir)

    @app.api_route("/{path:path}", methods=["GET"], include_in_schema=False)
    async def spa_fallback(request: Request, path: str):
        # If the file exists on disk, serve it (favicon, etc.)
        file_path = os.path.realpath(os.path.join(_web_dir, path))
        if os.path.isfile(file_path) and file_path.startswith(_real_web_dir + os.sep):
            return FileResponse(file_path)
        # Otherwise serve the SPA
        return FileResponse(os.path.join(_web_dir, "index.html"))
