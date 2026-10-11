import logging
import uuid
from pathlib import Path

from fastapi import APIRouter, BackgroundTasks, Depends, File, Form, HTTPException, UploadFile, status
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import SessionLocal, get_db
from app.core.deps import get_current_user, require_admin
from app.models import Document, User
from app.rag.loaders import SUPPORTED_EXTENSIONS
from app.rag.pipeline import ingest_document, remove_document_vectors
from app.schemas import DocumentOut

router = APIRouter(prefix="/api/documents", tags=["documents"])
logger = logging.getLogger("ostutor.documents")
settings = get_settings()


def _ingest_job(document_id: int) -> None:
    with SessionLocal() as db:
        ingest_document(db, document_id)


@router.get("", response_model=list[DocumentOut])
def list_documents(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(Document).order_by(Document.created_at.desc()).all()


@router.post("", response_model=DocumentOut, status_code=status.HTTP_201_CREATED)
async def upload_document(
    background: BackgroundTasks,
    file: UploadFile = File(...),
    title: str = Form(""),
    subject: str = Form(""),
    admin: User = Depends(require_admin),
    db: Session = Depends(get_db),
):
    original = Path(file.filename or "upload").name
    ext = Path(original).suffix.lower()
    if ext not in SUPPORTED_EXTENSIONS:
        raise HTTPException(
            status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            f"Unsupported file type '{ext}'. Upload PDF, DOCX, TXT, PPTX or Markdown.",
        )
    limit = settings.max_upload_mb * 1024 * 1024
    stored = settings.upload_dir / f"{uuid.uuid4().hex}{ext}"
    size = 0
    try:
        with stored.open("wb") as out:
            while chunk := await file.read(1024 * 1024):
                size += len(chunk)
                if size > limit:
                    raise HTTPException(status.HTTP_413_REQUEST_ENTITY_TOO_LARGE, f"File exceeds {settings.max_upload_mb} MB")
                out.write(chunk)
    except HTTPException:
        stored.unlink(missing_ok=True)
        raise
    if size == 0:
        stored.unlink(missing_ok=True)
        raise HTTPException(status.HTTP_400_BAD_REQUEST, "The uploaded file is empty")
    document = Document(
        title=title.strip() or Path(original).stem.replace("_", " ").replace("-", " ").title(),
        filename=original, stored_path=str(stored), file_type=ext.lstrip(".").replace("markdown", "md"),
        subject=subject.strip(), size_bytes=size, uploaded_by=admin.id, status="processing",
    )
    db.add(document)
    db.commit()
    db.refresh(document)
    background.add_task(_ingest_job, document.id)
    return document


@router.get("/{document_id}", response_model=DocumentOut)
def get_document(document_id: int, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(404, "Document not found")
    return document


@router.post("/{document_id}/reindex", response_model=DocumentOut)
def reindex(document_id: int, background: BackgroundTasks, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(404, "Document not found")
    document.status = "processing"
    db.commit()
    background.add_task(_ingest_job, document.id)
    db.refresh(document)
    return document


@router.get("/{document_id}/download")
def download(document_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    document = db.get(Document, document_id)
    if document is None or not Path(document.stored_path).exists():
        raise HTTPException(404, "File not found")
    return FileResponse(document.stored_path, filename=document.filename)


@router.delete("/{document_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_document(document_id: int, _: User = Depends(require_admin), db: Session = Depends(get_db)):
    document = db.get(Document, document_id)
    if document is None:
        raise HTTPException(404, "Document not found")
    try:
        remove_document_vectors(document.id)
    except Exception:  # noqa: BLE001
        logger.exception("Could not remove vectors for document %s", document_id)
    Path(document.stored_path).unlink(missing_ok=True)
    db.delete(document)
    db.commit()
