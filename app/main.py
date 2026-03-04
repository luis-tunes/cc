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
app.mount("/", StaticFiles(directory="/opt/cc/web", html=True), name="web")
