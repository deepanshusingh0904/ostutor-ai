"""Embedding backends: Sentence Transformers (default) with a deterministic hashing fallback."""
from __future__ import annotations

import hashlib
import logging
import math
import re
from functools import lru_cache
from typing import Protocol

from app.core.config import get_settings

logger = logging.getLogger("ostutor.embeddings")
HASH_DIM = 384
_TOKEN = re.compile(r"[a-z0-9]+")


class Embedder(Protocol):
    name: str

    def embed_documents(self, texts: list[str]) -> list[list[float]]: ...

    def embed_query(self, text: str) -> list[float]: ...


class HashEmbedder:
    """Signed feature-hashing of unigrams + bigrams. Lexical, offline and deterministic."""

    name = "hash-384"

    def _vector(self, text: str) -> list[float]:
        tokens = _TOKEN.findall(text.lower())
        features = tokens + [f"{a}_{b}" for a, b in zip(tokens, tokens[1:])]
        vec = [0.0] * HASH_DIM
        for feature in features:
            digest = hashlib.md5(feature.encode("utf-8")).digest()
            bucket = int.from_bytes(digest[:4], "little") % HASH_DIM
            sign = 1.0 if digest[4] % 2 == 0 else -1.0
            weight = 1.0 if "_" not in feature else 0.7
            vec[bucket] += sign * weight
        norm = math.sqrt(sum(v * v for v in vec)) or 1.0
        return [v / norm for v in vec]

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return [self._vector(t) for t in texts]

    def embed_query(self, text: str) -> list[float]:
        return self._vector(text)


class SentenceTransformerEmbedder:
    def __init__(self, model_name: str) -> None:
        from sentence_transformers import SentenceTransformer

        self._model = SentenceTransformer(model_name)
        self.name = model_name

    def embed_documents(self, texts: list[str]) -> list[list[float]]:
        return self._model.encode(texts, normalize_embeddings=True, show_progress_bar=False).tolist()

    def embed_query(self, text: str) -> list[float]:
        return self._model.encode([text], normalize_embeddings=True, show_progress_bar=False)[0].tolist()


@lru_cache
def get_embedder() -> Embedder:
    settings = get_settings()
    backend = settings.embedding_backend.lower()
    if backend == "hash":
        return HashEmbedder()
    try:
        return SentenceTransformerEmbedder(settings.embedding_model)
    except Exception as exc:  # noqa: BLE001
        if backend == "sentence-transformers":
            raise
        logger.warning("Sentence Transformers unavailable (%s); using hashing embeddings.", exc)
        return HashEmbedder()
