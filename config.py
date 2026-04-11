"""Centralized configuration loaded from environment variables."""

from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv

load_dotenv()


def env_bool(name: str, default: bool) -> bool:
    return os.getenv(name, str(default)).strip().lower() in {"1", "true", "yes", "on"}


def env_int(name: str, default: int) -> int:
    return int(os.getenv(name, str(default)))


def env_float(name: str, default: float) -> float:
    return float(os.getenv(name, str(default)))


PROJECT_ROOT = Path(__file__).resolve().parent

# --- LLM ---
OPENAI_API_KEY = os.getenv("OPENAI_API_KEY", "")
LLM_MODEL = os.getenv("LLM_MODEL", "gpt-4o")
LLM_TEMPERATURE = env_float("LLM_TEMPERATURE", 0.3)

# --- Paths ---
DATA_DIR = os.getenv("DATA_DIR", str(PROJECT_ROOT / "data"))
LOG_DIR = os.getenv("LOG_DIR", str(PROJECT_ROOT / "logs"))
# --- Supabase ---
SUPABASE_URL = os.getenv("SUPABASE_URL", "")
SUPABASE_SERVICE_ROLE_KEY = os.getenv("SUPABASE_SERVICE_ROLE_KEY", "")
SUPABASE_JWT_SECRET = os.getenv("SUPABASE_JWT_SECRET", "")
FAISS_INDEX_DIR = os.path.join(DATA_DIR, "faiss_index")
RAG_MANIFEST_FILE = os.path.join(DATA_DIR, "faiss_index_manifest.json")
MEDICAL_KNOWLEDGE_FILE = os.path.join(DATA_DIR, "medical_knowledge.json")
SOURCE_DOCS_DIR = os.getenv("SOURCE_DOCS_DIR", os.path.join(DATA_DIR, "source_docs"))
PDF_SOURCES_DIR = os.getenv("PDF_SOURCES_DIR", os.path.join(SOURCE_DOCS_DIR, "pdfs"))
TEXT_SOURCES_DIR = os.getenv("TEXT_SOURCES_DIR", os.path.join(SOURCE_DOCS_DIR, "text"))
MODEL_CACHE_DIR = os.getenv("MODEL_CACHE_DIR", os.path.join(DATA_DIR, "model_cache"))
ENABLE_JSON_KNOWLEDGE = env_bool("ENABLE_JSON_KNOWLEDGE", False)

# --- API ---
API_PORT = env_int("API_PORT", 8000)
FRONTEND_URLS = [
    origin.strip()
    for origin in os.getenv(
        "FRONTEND_URLS",
        "http://localhost:3000,http://127.0.0.1:3000",
    ).split(",")
    if origin.strip()
]
REQUEST_ID_HEADER = os.getenv("REQUEST_ID_HEADER", "X-Request-ID")

# --- RAG ---
EMBEDDING_MODEL = os.getenv("EMBEDDING_MODEL", "all-MiniLM-L6-v2")
EMBEDDINGS_LOCAL_ONLY = env_bool("EMBEDDINGS_LOCAL_ONLY", True)
RETRIEVER_K = env_int("RETRIEVER_K", 5)
RAG_CHUNK_SIZE = env_int("RAG_CHUNK_SIZE", 1000)
RAG_CHUNK_OVERLAP = env_int("RAG_CHUNK_OVERLAP", 150)
HYBRID_RETRIEVER_K = env_int("HYBRID_RETRIEVER_K", 12)
HYBRID_RRF_K = env_int("HYBRID_RRF_K", 60)
LEXICAL_WEIGHT = env_float("LEXICAL_WEIGHT", 1.0)
DENSE_WEIGHT = env_float("DENSE_WEIGHT", 1.0)
RERANK_TOP_N = env_int("RERANK_TOP_N", 8)
MAX_CITATIONS_PER_HYPOTHESIS = env_int("MAX_CITATIONS_PER_HYPOTHESIS", 3)
RERANKER_MODEL = os.getenv("RERANKER_MODEL", "")
RERANKER_LOCAL_ONLY = env_bool("RERANKER_LOCAL_ONLY", True)
AUTO_REBUILD_STALE_INDEX = env_bool("AUTO_REBUILD_STALE_INDEX", False)

# --- Workflow defaults ---
DEFAULT_MAX_ITERATIONS = env_int("DEFAULT_MAX_ITERATIONS", 3)
DEFAULT_CRITIC_THRESHOLD = env_float("DEFAULT_CRITIC_THRESHOLD", 0.7)

# --- LLM resilience ---
LLM_TIMEOUT = env_int("LLM_TIMEOUT", 120)
LLM_MAX_RETRIES = env_int("LLM_MAX_RETRIES", 2)

# --- Evidence ---
MAX_EVIDENCE_DOCS = env_int("MAX_EVIDENCE_DOCS", 20)

# --- Logging ---
LOG_LEVEL = os.getenv("LOG_LEVEL", "DEBUG")
LOG_FILE = os.path.join(LOG_DIR, "clinical_system.log")
LOG_MAX_BYTES = env_int("LOG_MAX_BYTES", 10_485_760)
LOG_BACKUP_COUNT = env_int("LOG_BACKUP_COUNT", 5)
