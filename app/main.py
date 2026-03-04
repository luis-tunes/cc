import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.db import close_pool, init_db
from app.routes import router

@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    yield
    close_pool()

app = FastAPI(title="cc", lifespan=lifespan)

@app.get("/health")
async def health():
    return {"status": "ok"}

app.include_router(router)

_web_dir = os.environ.get("WEB_DIR", "/opt/cc/web")
if os.path.isdir(_web_dir):
    app.mount("/", StaticFiles(directory=_web_dir, html=True), name="web")
