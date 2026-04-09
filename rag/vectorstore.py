"""FAISS vector store for medical knowledge retrieval."""

import os

from langchain_community.vectorstores import FAISS

import config
from rag.embeddings import get_embeddings
from rag.ingest import (
    build_vectorstore,
    compute_sources_signature,
    ensure_manifest_from_sources,
    load_manifest,
    load_all_documents,
)
from rag.retriever import HybridRetriever
from utils.logger import get_logger, agent_log

logger = get_logger()

_vectorstore_instance = None
_source_documents_instance = None


def get_index_status() -> dict:
    """Report whether the FAISS index exists and matches current sources."""
    manifest = load_manifest()
    exists = os.path.exists(config.FAISS_INDEX_DIR)
    if not exists:
        return {
            "exists": False,
            "stale": False,
            "manifest_present": bool(manifest),
            "reason": "missing_index",
        }

    if not manifest:
        if exists:
            try:
                manifest = ensure_manifest_from_sources()
            except Exception as exc:
                agent_log(
                    logger,
                    "rag",
                    f"Unable to bootstrap missing RAG manifest: {exc}",
                    "load",
                    "warning",
                )
        return {
            "exists": True,
            "stale": True if not manifest else manifest.get("signature") != compute_sources_signature().get("signature"),
            "manifest_present": bool(manifest),
            "reason": "missing_manifest" if not manifest else "ready",
            "document_count": manifest.get("document_count", 0) if manifest else 0,
            "source_breakdown": manifest.get("source_breakdown", {}) if manifest else {},
        }

    current_signature = compute_sources_signature()
    stale = manifest.get("signature") != current_signature.get("signature")
    return {
        "exists": True,
        "stale": stale,
        "manifest_present": True,
        "reason": "source_mismatch" if stale else "ready",
        "document_count": manifest.get("document_count", 0),
        "source_breakdown": manifest.get("source_breakdown", {}),
    }


def get_vectorstore() -> FAISS | None:
    """Get or create the FAISS vector store singleton."""
    global _vectorstore_instance
    if _vectorstore_instance is None:
        status = get_index_status()
        if status["exists"]:
            if status.get("stale"):
                agent_log(
                    logger,
                    "rag",
                    f"FAISS index appears stale ({status.get('reason')}). Rebuild recommended.",
                    "load",
                    "warning",
                )
                if config.AUTO_REBUILD_STALE_INDEX:
                    agent_log(logger, "rag", "Auto-rebuilding stale FAISS index", "load", "warning")
                    _vectorstore_instance = build_vectorstore()
                    return _vectorstore_instance
            try:
                embeddings = get_embeddings()
                agent_log(logger, "rag", f"Loading FAISS index from {config.FAISS_INDEX_DIR}", "load")
                _vectorstore_instance = FAISS.load_local(
                    config.FAISS_INDEX_DIR, embeddings, allow_dangerous_deserialization=True
                )
            except Exception as exc:
                agent_log(
                    logger,
                    "rag",
                    f"Vector index present but dense embeddings unavailable; continuing with lexical retrieval only: {exc}",
                    "load",
                    "warning",
                )
                _vectorstore_instance = None
        else:
            agent_log(logger, "rag", "No FAISS index found — building from scratch", "load")
            _vectorstore_instance = build_vectorstore()
    return _vectorstore_instance


def get_source_documents():
    """Get the source documents used to build the RAG corpus."""
    global _source_documents_instance
    if _source_documents_instance is None:
        _source_documents_instance = load_all_documents()
    return _source_documents_instance


def get_retriever(k: int | None = None):
    """Get a retriever from the vector store."""
    vs = get_vectorstore()
    docs = get_source_documents()
    return HybridRetriever(vs, docs, k or config.RETRIEVER_K)
