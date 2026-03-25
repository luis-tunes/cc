import logging
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from app.auth import check_auth_config
from app.db import close_pool, init_db
from app.routes import router
from app.billing import router as billing_router, init_billing_db

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(name)s %(levelname)s %(message)s")
logger = logging.getLogger(__name__)

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

app = FastAPI(title="TIM — Time is Money", lifespan=lifespan)

@app.get("/health")
async def health():
    return {"status": "ok"}

# All API routes under /api
app.include_router(router, prefix="/api")
app.include_router(billing_router, prefix="/api")

# Backward-compat: Paperless post-consume calls /webhook without /api prefix
@app.post("/webhook")
async def webhook_compat(payload: dict):
    from app.routes import paperless_webhook, WebhookRequest
    return await paperless_webhook(WebhookRequest(**payload))

_web_dir = os.environ.get("WEB_DIR", "/opt/tim/web")
if os.path.isdir(_web_dir):
    # Serve static assets (JS, CSS, images)
    app.mount("/assets", StaticFiles(directory=os.path.join(_web_dir, "assets")), name="assets")

    # SPA fallback — serve index.html for all non-API, non-asset routes
    @app.api_route("/{path:path}", methods=["GET"], include_in_schema=False)
    async def spa_fallback(request: Request, path: str):
        # If the file exists on disk, serve it (favicon, etc.)
        file_path = os.path.join(_web_dir, path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise serve the SPA
        return FileResponse(os.path.join(_web_dir, "index.html"))
