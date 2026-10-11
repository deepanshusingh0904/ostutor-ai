"""Chunking with page-level provenance."""
from __future__ import annotations

from dataclasses import dataclass

from langchain_text_splitters import RecursiveCharacterTextSplitter

from app.core.config import get_settings
from app.rag.loaders import PageText

MIN_CHUNK_CHARS = 40


@dataclass
class Chunk:
    index: int
    page: int
    text: str


def chunk_pages(pages: list[PageText], chunk_size: int | None = None, overlap: int | None = None) -> list[Chunk]:
    settings = get_settings()
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size or settings.chunk_size,
        chunk_overlap=overlap if overlap is not None else settings.chunk_overlap,
        separators=["\n\n", "\n", ". ", " ", ""],
    )
    chunks: list[Chunk] = []
    for page in pages:
        for piece in splitter.split_text(page.text):
            piece = piece.strip()
            if len(piece) >= MIN_CHUNK_CHARS:
                chunks.append(Chunk(index=len(chunks), page=page.page, text=piece))
    return chunks
