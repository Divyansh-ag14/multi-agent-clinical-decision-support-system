"""Local sentence-transformers embeddings for the RAG system."""

from __future__ import annotations

import os

from langchain_huggingface import HuggingFaceEmbeddings

import config
from utils.logger import agent_log, get_logger

logger = get_logger("rag")
_embeddings_instance = None


def get_embeddings() -> HuggingFaceEmbeddings:
    """Get or create a singleton HuggingFace embeddings instance."""
    global _embeddings_instance
    if _embeddings_instance is not None:
        return _embeddings_instance

    os.makedirs(config.MODEL_CACHE_DIR, exist_ok=True)

    try:
        _embeddings_instance = HuggingFaceEmbeddings(
            model_name=config.EMBEDDING_MODEL,
            cache_folder=config.MODEL_CACHE_DIR,
            model_kwargs={
                "device": "cpu",
                "local_files_only": config.EMBEDDINGS_LOCAL_ONLY,
            },
            encode_kwargs={"normalize_embeddings": True},
        )
        agent_log(
            logger,
            "rag",
            (
                f"Embedding model ready: {config.EMBEDDING_MODEL} "
                f"(local_only={config.EMBEDDINGS_LOCAL_ONLY})"
            ),
            "embeddings",
        )
    except Exception as exc:
        hint = (
            "The embedding model is not available locally. "
            "Set EMBEDDINGS_LOCAL_ONLY=false temporarily on a networked machine "
            "to download it, or place the model in the cache directory."
        )
        agent_log(logger, "rag", f"Embedding model load failed: {exc}", "embeddings", "error")
        raise RuntimeError(f"Failed to load embedding model '{config.EMBEDDING_MODEL}'. {hint}") from exc

    return _embeddings_instance
