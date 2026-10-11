"""Retriever: embeds the query and returns scored, de-duplicated context chunks."""
from __future__ import annotations

from dataclasses import asdict, dataclass

from app.core.config import get_settings
from app.rag.embeddings import get_embedder
from app.rag.vectorstore import get_vector_store
from app.services.textutils import content_stems, extract_topic


@dataclass
class RetrievedChunk:
    index: int
    document_id: int
    document_name: str
    page: int
    text: str
    score: float

    def to_citation(self) -> dict:
        data = asdict(self)
        return data


def retrieve(query: str, top_k: int | None = None, min_score: float | None = None,
             document_ids: list[int] | None = None) -> list[RetrievedChunk]:
    settings = get_settings()
    top_k = top_k or settings.retrieval_top_k
    min_score = settings.min_similarity if min_score is None else min_score
    if not query.strip():
        return []
    embedder = get_embedder()
    query = extract_topic(query) if len(query.split()) > 2 else query
    # Hashing embeddings are purely lexical, so additionally require a shared content word to avoid chance matches.
    lexical_gate = embedder.name.startswith("hash")
    query_stems = content_stems(query)
    if lexical_gate:
        min_score = min(min_score, 0.04)
    embedding = embedder.embed_query(query)
    hits = get_vector_store().query(embedding, top_k=top_k * 2, document_ids=document_ids)
    results: list[RetrievedChunk] = []
    seen: set[str] = set()
    for hit in hits:
        if hit.score < min_score:
            continue
        if lexical_gate and query_stems and not (query_stems & content_stems(hit.text)):
            continue
        fingerprint = hit.text[:120]
        if fingerprint in seen:
            continue
        seen.add(fingerprint)
        results.append(
            RetrievedChunk(
                index=len(results) + 1, document_id=hit.document_id, document_name=hit.document_name,
                page=hit.page, text=hit.text, score=hit.score,
            )
        )
        if len(results) >= top_k:
            break
    return results


def format_context(chunks: list[RetrievedChunk]) -> str:
    return "\n\n".join(
        f"[{c.index}] (Source: {c.document_name}, page {c.page}, similarity {c.score:.2f})\n{c.text}" for c in chunks
    )
