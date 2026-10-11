"""OSTutor AI - FastAPI application entrypoint."""
from __future__ import annotations

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.middleware.gzip import GZipMiddleware
from fastapi.responses import JSONResponse

from app.core.config import get_settings
from app.core.database import SessionLocal, init_db
from app.core.security import hash_password
from app.middleware import RateLimitMiddleware, RequestContextMiddleware
from app.models import DEFAULT_SETTINGS, User
from app.routers import admin, auth, bookmarks, chat, documents, flashcards, progress, quiz, search, study, users, viva

settings = get_settings()
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")
logger = logging.getLogger("ostutor")


def seed_admin() -> None:
    with SessionLocal() as db:
        if db.query(User).filter(User.email == settings.admin_email.lower()).first():
            return
        db.add(User(
            email=settings.admin_email.lower(), full_name=settings.admin_name,
            hashed_password=hash_password(settings.admin_password), role="admin", settings=dict(DEFAULT_SETTINGS),
        ))
        db.commit()
        logger.info("Seeded admin account %s", settings.admin_email)


@asynccontextmanager
async def lifespan(_: FastAPI):
    init_db()
    seed_admin()
    if settings.is_production and settings.secret_key.startswith("change-me"):
        logger.warning("SECRET_KEY is still the default value - set a strong secret in production!")
    yield


app = FastAPI(
    title=f"{settings.app_name} API", version="1.0.0",
    description="Retrieval-augmented AI professor for university courses.", lifespan=lifespan,
)

app.add_middleware(GZipMiddleware, minimum_size=1024)
app.add_middleware(RateLimitMiddleware, per_minute=settings.rate_limit_per_minute)
app.add_middleware(RequestContextMiddleware)
app.add_middleware(
    CORSMiddleware, allow_origins=settings.cors_origin_list, allow_credentials=True,
    allow_methods=["*"], allow_headers=["*"], expose_headers=["X-Request-ID"],
)

for module in (auth, users, documents, chat, quiz, viva, flashcards, progress, bookmarks, study, search, admin):
    app.include_router(module.router)


@app.get("/api/health", tags=["system"])
def health():
    from app.services.llm import get_llm

    return {"status": "ok", "app": settings.app_name, "llm_configured": get_llm().configured}


@app.get("/", include_in_schema=False)
def root():
    return {"name": settings.app_name, "docs": "/docs"}


@app.exception_handler(RequestValidationError)
async def validation_handler(_: Request, exc: RequestValidationError):
    messages = [f"{'.'.join(str(p) for p in e['loc'][1:])}: {e['msg']}" if len(e["loc"]) > 1 else e["msg"] for e in exc.errors()]
    return JSONResponse(status_code=422, content={"detail": "; ".join(messages)})


@app.exception_handler(Exception)
async def unhandled_handler(_: Request, exc: Exception):
    logger.exception("Unhandled error: %s", exc)
    return JSONResponse(status_code=500, content={"detail": "Internal server error"})
