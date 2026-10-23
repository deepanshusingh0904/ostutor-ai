"""Start-up jobs: index the course material that ships with the app and repair gaps in the search index.

Why this exists: on hosts with a temporary disk (e.g. Render's free plan) the database and vector store can
come back empty after a restart. Files in COURSE_DOCS_DIR live in the code repository, so they are simply
indexed again. Everything here is safe to run on every start: finished work is skipped.
"""
from __future__ import annotations

import logging
import threading
from pathlib import Path

from app.core.config import get_settings
from app.core.database import SessionLocal
from app.models import Document, User
from app.rag.loaders import SUPPORTED_EXTENSIONS
from app.rag.pipeline import ingest_document
from app.rag.vectorstore import get_vector_store

logger = logging.getLogger("ostutor.bootstrap")
_lock = threading.Lock()


def _title_for(path: Path) -> str:
    return path.stem.replace("_", " ").replace("-", " ").strip()


def seed_course_docs() -> int:
    """Register every file in COURSE_DOCS_DIR that is not yet in the library and index it. Returns how many."""
    settings = get_settings()
    folder = Path(settings.course_docs_dir)
    if not settings.auto_ingest_course_docs or not folder.is_dir():
        return 0
    files = sorted(p for p in folder.iterdir() if p.is_file() and p.suffix.lower() in SUPPORTED_EXTENSIONS)
    added: list[int] = []
    with SessionLocal() as db:
        admin = db.query(User).filter(User.role == "admin").order_by(User.id).first()
        known = {d.filename for d in db.query(Document).all()}
        for path in files:
            if path.name in known:
                continue
            ext = path.suffix.lower()
            document = Document(
                title=_title_for(path), filename=path.name, stored_path=str(path),
                file_type=ext.lstrip(".").replace("markdown", "md"), subject=settings.course_docs_subject,
                size_bytes=path.stat().st_size, uploaded_by=admin.id if admin else None, status="processing",
            )
            db.add(document)
            db.commit()
            added.append(document.id)
    for document_id in added:
        with SessionLocal() as db:
            result = ingest_document(db, document_id)
            logger.info("Course material '%s': %s (%s chunks)", result.title, result.status, result.chunk_count)
    return len(added)


def heal_index() -> int:
    """Re-index documents the library lists as ready but whose vectors are missing. Returns how many were repaired."""
    repaired = 0
    store = get_vector_store()
    with SessionLocal() as db:
        ready = db.query(Document).filter(Document.status == "ready").all()
        missing = [d.id for d in ready if not store.has_document(d.id)]
    for document_id in missing:
        with SessionLocal() as db:
            document = db.get(Document, document_id)
            if document is None:
                continue
            if not Path(document.stored_path).exists():
                document.status = "failed"
                document.error = "The original file is no longer on the server. Upload it again."
                db.commit()
                continue
            ingest_document(db, document_id)
            repaired += 1
    return repaired


def run_startup_jobs() -> None:
    if not _lock.acquire(blocking=False):  # another start-up job is already running
        return
    try:
        added = seed_course_docs()
        repaired = heal_index()
        if added or repaired:
            logger.info("Start-up indexing finished: %s new, %s repaired", added, repaired)
    except Exception:  # noqa: BLE001 - never take the API down because of indexing
        logger.exception("Start-up indexing failed")
    finally:
        _lock.release()


def start_in_background() -> threading.Thread:
    thread = threading.Thread(target=run_startup_jobs, name="ostutor-bootstrap", daemon=True)
    thread.start()
    return thread
