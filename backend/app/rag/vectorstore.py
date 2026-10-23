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


def _make_client(settings):
    """Chroma Cloud when CHROMA_API_KEY is set (data survives restarts and redeploys), else a local folder."""
    if settings.uses_chroma_cloud:
        kwargs = {"api_key": settings.chroma_api_key}
        if settings.chroma_tenant:
            kwargs["tenant"] = settings.chroma_tenant
        if settings.chroma_database:
            kwargs["database"] = settings.chroma_database
        return chromadb.CloudClient(**kwargs), "cloud"
    return chromadb.PersistentClient(
        path=str(settings.chroma_dir), settings=ChromaSettings(anonymized_telemetry=False)
    ), "local"


class VectorStore:
    def __init__(self) -> None:
        settings = get_settings()
        self._client, self.backend = _make_client(settings)
        self._lock = threading.Lock()
        name = _collection_name(get_embedder().name)
        try:  # chromadb >= 1.0 takes the distance function as configuration
            self._collection = self._client.get_or_create_collection(name=name, configuration={"hnsw": {"space": "cosine"}})
        except TypeError:  # older chromadb
            self._collection = self._client.get_or_create_collection(name=name, metadata={"hnsw:space": "cosine"})

    def has_document(self, document_id: int) -> bool:
        found = self._collection.get(where={"document_id": document_id}, limit=1, include=[])
        return bool(found.get("ids"))

    def keyword_hits(self, terms: list[str], embedding: list[float], document_ids: list[int] | None = None,
                     per_term: int = 15) -> list[VectorHit]:
        """Passages that literally contain one of the terms (rescues rare words that meaning-search ranks low)."""
        found: dict[str, VectorHit] = {}
        for term in terms:
            variants = list(dict.fromkeys([term, term.capitalize(), term.upper()]))  # Chroma matching is case-sensitive
            condition = {"$contains": variants[0]} if len(variants) == 1 else {"$or": [{"$contains": v} for v in variants]}
            result = self._collection.get(
                where_document=condition, where={"document_id": {"$in": document_ids}} if document_ids else None,
                limit=per_term, include=["documents", "metadatas", "embeddings"],
            )
            ids = result.get("ids") or []
            vectors = result.get("embeddings")
            for i, chunk_id in enumerate(ids):
                if chunk_id in found:
                    continue
                meta = result["metadatas"][i]
                vector = vectors[i] if vectors is not None and len(vectors) > i else None
                score = float(sum(float(a) * float(b) for a, b in zip(vector, embedding))) if vector is not None else 0.0
                found[chunk_id] = VectorHit(
                    document_id=int(meta["document_id"]), document_name=str(meta["document_name"]),
                    page=int(meta["page"]), chunk_index=int(meta["chunk_index"]),
                    text=result["documents"][i], score=round(max(0.0, score), 4),
                )
        return list(found.values())

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
