"""Ingestion pipeline: load -> extract -> clean -> chunk -> embed -> store in ChromaDB."""
from __future__ import annotations

import logging
from pathlib import Path

from sqlalchemy.orm import Session

from app.models import Document
from app.rag.chunking import chunk_pages
from app.rag.cleaning import clean_pages
from app.rag.embeddings import get_embedder
from app.rag.loaders import load_document
from app.rag.vectorstore import get_vector_store

logger = logging.getLogger("ostutor.rag")


def ingest_document(db: Session, document_id: int) -> Document:
    document = db.get(Document, document_id)
    if document is None:
        raise ValueError(f"Document {document_id} not found")
    document.status = "processing"
    document.error = ""
    db.commit()
    try:
        store = get_vector_store()
        store.delete_document(document.id)
        raw_pages = load_document(Path(document.stored_path))
        pages = clean_pages(raw_pages, document.file_type)
        if not pages:
            raise ValueError("No extractable text found in this file (is it a scanned image?).")
        chunks = chunk_pages(pages)
        if not chunks:
            raise ValueError("The document is too short to index.")
        embeddings = get_embedder().embed_documents([c.text for c in chunks])
        store.add_chunks(document.id, document.title, chunks, embeddings)
        document.page_count = len(raw_pages)
        document.chunk_count = len(chunks)
        document.status = "ready"
    except Exception as exc:  # noqa: BLE001 - surface any failure to the admin UI
        logger.exception("Ingestion failed for document %s", document_id)
        document.status = "failed"
        document.error = str(exc)[:500]
    db.commit()
    db.refresh(document)
    return document


def remove_document_vectors(document_id: int) -> None:
    get_vector_store().delete_document(document_id)
