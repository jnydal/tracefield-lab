"""BGE embedding model for semantic entity resolution."""
from __future__ import annotations

import logging
import os
from typing import TYPE_CHECKING

import numpy as np

if TYPE_CHECKING:
    from sentence_transformers import SentenceTransformer

log = logging.getLogger("resolver.embedding")

_EMBEDDINGS_MODEL = os.environ.get("EMBEDDINGS_MODEL", "BAAI/bge-small-en-v1.5")
_model: "SentenceTransformer | None" = None


def _get_model() -> "SentenceTransformer":
    global _model
    if _model is None:
        from sentence_transformers import SentenceTransformer

        log.info("Loading embedding model: %s", _EMBEDDINGS_MODEL)
        _model = SentenceTransformer(_EMBEDDINGS_MODEL)
    return _model


def embed(texts: list[str]) -> np.ndarray:
    """Embed a list of texts. Returns (N, dim) float32 array. Empty strings yield zero vector."""
    if not texts:
        return np.zeros((0, 0), dtype=np.float32)
    model = _get_model()
    normalized = [t.strip() if t else "" for t in texts]
    vectors = model.encode(normalized, normalize_embeddings=True, show_progress_bar=False)
    return np.atleast_2d(np.asarray(vectors, dtype=np.float32))
