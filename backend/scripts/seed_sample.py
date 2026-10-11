"""Ingest the bundled sample course notes so the app has something to teach from.

Usage (from the backend folder):  python -m scripts.seed_sample
"""
import shutil
from pathlib import Path

from app.core.config import get_settings
from app.core.database import SessionLocal, init_db
from app.models import Document
from app.rag.pipeline import ingest_document

SAMPLE = Path(__file__).resolve().parents[1] / "sample_docs" / "operating_systems_basics.md"


def main() -> None:
    settings = get_settings()
    init_db()
    with SessionLocal() as db:
        if db.query(Document).filter(Document.filename == SAMPLE.name).first():
            print("Sample document already ingested.")
            return
        target = settings.upload_dir / SAMPLE.name
        shutil.copy(SAMPLE, target)
        doc = Document(
            title="Operating Systems Basics", filename=SAMPLE.name, stored_path=str(target), file_type="md",
            subject="Operating Systems", size_bytes=target.stat().st_size,
        )
        db.add(doc)
        db.commit()
        ingest_document(db, doc.id)
        print(f"Ingested '{doc.title}': {doc.chunk_count} chunks, status={doc.status}")


if __name__ == "__main__":
    main()
