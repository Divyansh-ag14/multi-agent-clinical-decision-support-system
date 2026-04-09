"""Ingest structured and document-based medical knowledge into FAISS."""

from __future__ import annotations

import json
import os
from pathlib import Path
import sys
from hashlib import sha256

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from pypdf import PdfReader

import config
from rag.embeddings import get_embeddings
from utils.logger import agent_log, get_logger

logger = get_logger()


def compute_sources_signature() -> dict:
    """Build a lightweight manifest of the configured RAG sources."""
    sources: list[dict] = []

    if config.ENABLE_JSON_KNOWLEDGE and os.path.exists(config.MEDICAL_KNOWLEDGE_FILE):
        path = Path(config.MEDICAL_KNOWLEDGE_FILE)
        stat = path.stat()
        sources.append(
            {
                "type": "json",
                "path": str(path.relative_to(config.PROJECT_ROOT)),
                "size": stat.st_size,
                "mtime": int(stat.st_mtime),
            }
        )

    for source_root, source_type, patterns in (
        (Path(config.PDF_SOURCES_DIR), "pdf", ("*.pdf",)),
        (Path(config.TEXT_SOURCES_DIR), "text", ("*.txt", "*.md")),
    ):
        if not source_root.exists():
            continue
        for pattern in patterns:
            for file_path in sorted(source_root.rglob(pattern)):
                stat = file_path.stat()
                sources.append(
                    {
                        "type": source_type,
                        "path": str(file_path.relative_to(config.PROJECT_ROOT)),
                        "size": stat.st_size,
                        "mtime": int(stat.st_mtime),
                    }
                )

    payload = {
        "chunk_size": config.RAG_CHUNK_SIZE,
        "chunk_overlap": config.RAG_CHUNK_OVERLAP,
        "embedding_model": config.EMBEDDING_MODEL,
        "sources": sources,
    }
    signature = sha256(json.dumps(payload, sort_keys=True).encode("utf-8")).hexdigest()
    payload["signature"] = signature
    return payload


def write_manifest(document_count: int, source_breakdown: dict[str, int]) -> None:
    """Persist a manifest describing the current FAISS build."""
    manifest = compute_sources_signature()
    manifest.update(
        {
            "document_count": document_count,
            "source_breakdown": source_breakdown,
        }
    )
    with open(config.RAG_MANIFEST_FILE, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2)
    agent_log(logger, "rag", f"Saved RAG manifest to {config.RAG_MANIFEST_FILE}", "ingest")


def ensure_manifest_from_sources() -> dict:
    """Create a best-effort manifest even when the FAISS index already exists."""
    documents = load_all_documents()
    source_breakdown = {
        "json": len([doc for doc in documents if doc.metadata.get("source_type") == "json"]),
        "pdf": len([doc for doc in documents if doc.metadata.get("source_type") == "pdf"]),
        "text": len(
            [
                doc
                for doc in documents
                if doc.metadata.get("source_type") not in {"json", "pdf"}
            ]
        ),
    }
    write_manifest(len(documents), source_breakdown)
    return load_manifest() or {}


def load_manifest() -> dict | None:
    """Load the RAG manifest if present."""
    if not os.path.exists(config.RAG_MANIFEST_FILE):
        return None
    with open(config.RAG_MANIFEST_FILE, "r", encoding="utf-8") as f:
        return json.load(f)


def get_text_splitter() -> RecursiveCharacterTextSplitter:
    """Create the default splitter for source documents."""
    return RecursiveCharacterTextSplitter(
        chunk_size=config.RAG_CHUNK_SIZE,
        chunk_overlap=config.RAG_CHUNK_OVERLAP,
    )


def clean_text(text: str) -> str:
    """Normalize whitespace from raw document extraction."""
    normalized = text.replace("\u00a0", " ").replace("\t", " ")
    normalized = normalized.replace("-\n", "")
    lines = [line.strip() for line in normalized.splitlines()]

    cleaned_lines: list[str] = []
    previous = None
    for line in lines:
        if not line:
            continue
        line = " ".join(line.split())
        if previous == line:
            continue
        cleaned_lines.append(line)
        previous = line

    return "\n".join(cleaned_lines).strip()


def load_and_chunk_medical_data() -> list[Document]:
    """Load the structured medical knowledge JSON and chunk into documents."""
    if not config.ENABLE_JSON_KNOWLEDGE:
        agent_log(logger, "rag", "Structured JSON knowledge source disabled by config", "ingest")
        return []

    if not os.path.exists(config.MEDICAL_KNOWLEDGE_FILE):
        agent_log(
            logger,
            "rag",
            f"Structured medical knowledge file not found at {config.MEDICAL_KNOWLEDGE_FILE}",
            "ingest",
        )
        return []

    with open(config.MEDICAL_KNOWLEDGE_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)

    documents: list[Document] = []

    for condition in data.get("conditions", []):
        name = condition["name"]
        base_metadata = {
            "condition": name,
            "source": "medical_knowledge_base",
            "source_title": "medical_knowledge_base",
            "source_type": "json",
            "document_type": "json",
        }

        symptoms_text = (
            f"Condition: {name}\n"
            f"Category: {condition.get('category', 'General')}\n"
            f"Description: {condition.get('description', '')}\n\n"
            f"Common Symptoms:\n"
            + "\n".join(f"- {s}" for s in condition.get("symptoms", []))
        )
        documents.append(
            Document(
                page_content=symptoms_text,
                metadata={**base_metadata, "section": "symptoms"},
            )
        )

        risk_factors = condition.get("risk_factors", [])
        if risk_factors:
            rf_text = f"Risk Factors for {name}:\n" + "\n".join(f"- {r}" for r in risk_factors)
            documents.append(
                Document(
                    page_content=rf_text,
                    metadata={**base_metadata, "section": "risk_factors"},
                )
            )

        criteria = condition.get("diagnostic_criteria", "")
        if criteria:
            documents.append(
                Document(
                    page_content=f"Diagnostic Criteria for {name}:\n{criteria}",
                    metadata={**base_metadata, "section": "diagnostic_criteria"},
                )
            )

        differentials = condition.get("differential_diagnosis", [])
        if differentials:
            dd_text = (
                f"Differential Diagnosis for {name}:\n"
                f"Consider these alternative diagnoses:\n"
                + "\n".join(f"- {d}" for d in differentials)
            )
            documents.append(
                Document(
                    page_content=dd_text,
                    metadata={**base_metadata, "section": "differential_diagnosis"},
                )
            )

        treatment = condition.get("treatment", "")
        if treatment:
            documents.append(
                Document(
                    page_content=f"Treatment for {name}:\n{treatment}",
                    metadata={**base_metadata, "section": "treatment"},
                )
            )

        epidemiology = condition.get("epidemiology", "")
        if epidemiology:
            documents.append(
                Document(
                    page_content=f"Epidemiology of {name}:\n{epidemiology}",
                    metadata={**base_metadata, "section": "epidemiology"},
                )
            )

    return documents


def split_source_text(
    text: str,
    *,
    source_name: str,
    source_type: str,
    source_path: str,
    extra_metadata: dict | None = None,
) -> list[Document]:
    """Split arbitrary source text into Documents with shared metadata."""
    cleaned = clean_text(text)
    if not cleaned:
        return []

    splitter = get_text_splitter()
    chunks = splitter.split_text(cleaned)
    metadata = {
        "source": source_name,
        "source_type": source_type,
        "source_path": source_path,
    }
    if extra_metadata:
        metadata.update(extra_metadata)

    documents: list[Document] = []
    for chunk_index, chunk in enumerate(chunks, start=1):
        documents.append(
            Document(
                page_content=chunk,
                metadata={**metadata, "chunk_index": chunk_index},
            )
        )
    return documents


def load_and_chunk_pdf_sources(pdf_dir: str | None = None) -> list[Document]:
    """Load PDFs from the configured directory and split them into chunks."""
    source_dir = Path(pdf_dir or config.PDF_SOURCES_DIR)
    if not source_dir.exists():
        return []

    documents: list[Document] = []

    for pdf_path in sorted(source_dir.rglob("*.pdf")):
        try:
            reader = PdfReader(str(pdf_path))
        except Exception as exc:
            agent_log(logger, "rag", f"Failed to open PDF {pdf_path.name}: {exc}", "ingest", "warning")
            continue
        relative_path = str(pdf_path.relative_to(config.DATA_DIR))

        for page_number, page in enumerate(reader.pages, start=1):
            try:
                text = page.extract_text() or ""
            except Exception as exc:
                agent_log(
                    logger,
                    "rag",
                    f"Failed to extract page {page_number} from {pdf_path.name}: {exc}",
                    "ingest",
                    "warning",
                )
                continue
            documents.extend(
                split_source_text(
                    text,
                    source_name=pdf_path.name,
                    source_type="pdf",
                    source_path=relative_path,
                    extra_metadata={
                        "page": page_number,
                        "source_title": pdf_path.stem,
                        "document_type": "pdf",
                    },
                )
            )

    return documents


def load_and_chunk_text_sources(text_dir: str | None = None) -> list[Document]:
    """Load plain-text and markdown source files from disk."""
    source_dir = Path(text_dir or config.TEXT_SOURCES_DIR)
    if not source_dir.exists():
        return []

    documents: list[Document] = []

    for pattern in ("*.txt", "*.md"):
        for text_path in sorted(source_dir.rglob(pattern)):
            text = text_path.read_text(encoding="utf-8")
            relative_path = str(text_path.relative_to(config.DATA_DIR))
            documents.extend(
                split_source_text(
                    text,
                    source_name=text_path.name,
                    source_type=text_path.suffix.lstrip(".") or "text",
                    source_path=relative_path,
                    extra_metadata={
                        "source_title": text_path.stem,
                        "document_type": text_path.suffix.lstrip(".") or "text",
                    },
                )
            )

    return documents


def load_all_documents() -> list[Document]:
    """Load all supported RAG source types into a single document list."""
    json_docs = load_and_chunk_medical_data()
    pdf_docs = load_and_chunk_pdf_sources()
    text_docs = load_and_chunk_text_sources()

    agent_log(
        logger,
        "rag",
        (
            f"Loaded {len(json_docs)} JSON chunks, "
            f"{len(pdf_docs)} PDF chunks, "
            f"and {len(text_docs)} text chunks"
        ),
        "ingest",
    )

    all_docs = [*json_docs, *pdf_docs, *text_docs]
    deduped: list[Document] = []
    seen = set()
    for doc in all_docs:
        metadata = doc.metadata or {}
        key = (
            metadata.get("source_path", metadata.get("source", "unknown")),
            metadata.get("page"),
            metadata.get("chunk_index"),
            doc.page_content,
        )
        if key in seen:
            continue
        seen.add(key)
        deduped.append(doc)

    if len(deduped) != len(all_docs):
        agent_log(logger, "rag", f"Deduplicated {len(all_docs) - len(deduped)} repeated chunks", "ingest")

    return deduped


def build_vectorstore() -> FAISS:
    """Build a FAISS index from all configured RAG sources."""
    agent_log(logger, "rag", "Building FAISS vector store from configured sources...", "ingest")
    documents = load_all_documents()
    if not documents:
        raise ValueError(
            "No RAG documents found. Add data to medical_knowledge.json, "
            "data/source_docs/pdfs, or data/source_docs/text first."
        )

    agent_log(logger, "rag", f"Created {len(documents)} document chunks", "ingest")

    embeddings = get_embeddings()
    vectorstore = FAISS.from_documents(documents, embeddings)

    os.makedirs(config.FAISS_INDEX_DIR, exist_ok=True)
    vectorstore.save_local(config.FAISS_INDEX_DIR)
    agent_log(logger, "rag", f"FAISS index saved to {config.FAISS_INDEX_DIR}", "ingest")
    source_breakdown = {
        "json": len([doc for doc in documents if doc.metadata.get("source_type") == "json"]),
        "pdf": len([doc for doc in documents if doc.metadata.get("source_type") == "pdf"]),
        "text": len(
            [
                doc
                for doc in documents
                if doc.metadata.get("source_type") not in {"json", "pdf"}
            ]
        ),
    }
    write_manifest(len(documents), source_breakdown)

    return vectorstore


if __name__ == "__main__":
    build_vectorstore()
