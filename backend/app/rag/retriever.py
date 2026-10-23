"""Retriever: embeds the query and returns scored, de-duplicated context chunks."""
from __future__ import annotations

import math
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


def _rank_candidates(hits, query_stems: set[str]):
    """Order candidates by meaning-similarity plus how many of the question's (rarer) words they contain."""
    if not query_stems:
        return [(hit, 0.0, hit.score) for hit in hits]
    chunk_stems = [content_stems(hit.text) for hit in hits]
    total = len(hits)
    weights = {}
    for stem_ in query_stems:  # words that few candidates contain are more informative (IDF over the candidates)
        df = sum(1 for cs in chunk_stems if stem_ in cs)
        weights[stem_] = math.log((total + 1) / (df + 1)) + 1.0
    scale = sum(weights.values())
    ranked = []
    for hit, cs in zip(hits, chunk_stems):
        matched = sum(weights[w] for w in query_stems & cs) / scale
        ranked.append((hit, matched, hit.score + 0.3 * matched))
    ranked.sort(key=lambda item: -item[2])
    return ranked


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
    store = get_vector_store()
    hits = store.query(embedding, top_k=top_k * 2, document_ids=document_ids)
    vector_ids = {(h.document_id, h.chunk_index) for h in hits}
    # Keyword rescue: a rare word like "deadlock" can sit below common words such as "conditions" in a pure
    # similarity ranking, so also pull in passages that literally contain the question's longest words.
    rare = sorted((w for w in query_stems if len(w) >= 5), key=len, reverse=True)[:3]
    if rare:
        try:
            for extra in store.keyword_hits(rare, embedding, document_ids):
                if (extra.document_id, extra.chunk_index) not in vector_ids:
                    hits.append(extra)
        except Exception:  # noqa: BLE001 - the rescue is an extra, never block the normal search
            pass
    results: list[RetrievedChunk] = []
    seen: set[str] = set()
    for hit, matched, _ in _rank_candidates(hits, query_stems):
        from_vector = (hit.document_id, hit.chunk_index) in vector_ids
        if from_vector:
            if hit.score < min_score:
                continue
        elif matched < 0.5:  # a rescued passage must contain at least half of the question's weighted words
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
