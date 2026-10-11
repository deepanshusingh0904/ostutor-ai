"""ChromaDB vector store wrapper (cosine similarity)."""
from __future__ import annotations

import re
import threading
from dataclasses import dataclass
from functools import lru_cache

import chromadb
from chromadb.config import Settings as ChromaSettings

from app.core.config import get_settings
from app.rag.chunking import Chunk
from app.rag.embeddings import get_embedder


@dataclass
class VectorHit:
    document_id: int
    document_name: str
    page: int
    chunk_index: int
    text: str
    score: float


def _collection_name(embedder_name: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "_", embedder_name).strip("_")[-40:] or "default"
    return f"ostutor_{slug}"


class VectorStore:
    def __init__(self) -> None:
        settings = get_settings()
        self._client = chromadb.PersistentClient(
            path=str(settings.chroma_dir), settings=ChromaSettings(anonymized_telemetry=False)
        )
        self._lock = threading.Lock()
        self._collection = self._client.get_or_create_collection(
            name=_collection_name(get_embedder().name), metadata={"hnsw:space": "cosine"}
        )

    @property
    def collection_name(self) -> str:
        return self._collection.name

    def count(self) -> int:
        return self._collection.count()

    def add_chunks(self, document_id: int, document_name: str, chunks: list[Chunk], embeddings: list[list[float]]) -> None:
        if not chunks:
            return
        with self._lock:
            batch = 128
            for start in range(0, len(chunks), batch):
                part = chunks[start : start + batch]
                self._collection.upsert(
                    ids=[f"doc{document_id}-c{c.index}" for c in part],
                    embeddings=embeddings[start : start + batch],
                    documents=[c.text for c in part],
                    metadatas=[
                        {"document_id": document_id, "document_name": document_name, "page": c.page, "chunk_index": c.index}
                        for c in part
                    ],
                )

    def delete_document(self, document_id: int) -> None:
        with self._lock:
            self._collection.delete(where={"document_id": document_id})

    def query(self, embedding: list[float], top_k: int, document_ids: list[int] | None = None) -> list[VectorHit]:
        total = self._collection.count()
        if total == 0:
            return []
        where = None
        if document_ids:
            where = {"document_id": {"$in": document_ids}}
        result = self._collection.query(
            query_embeddings=[embedding], n_results=min(top_k, total), where=where,
            include=["documents", "metadatas", "distances"],
        )
        hits: list[VectorHit] = []
        docs = result["documents"][0]
        metas = result["metadatas"][0]
        dists = result["distances"][0]
        for text, meta, dist in zip(docs, metas, dists):
            hits.append(
                VectorHit(
                    document_id=int(meta["document_id"]),
                    document_name=str(meta["document_name"]),
                    page=int(meta["page"]),
                    chunk_index=int(meta["chunk_index"]),
                    text=text,
                    score=round(max(0.0, 1.0 - float(dist)), 4),
                )
            )
        return hits


@lru_cache
def get_vector_store() -> VectorStore:
    return VectorStore()
