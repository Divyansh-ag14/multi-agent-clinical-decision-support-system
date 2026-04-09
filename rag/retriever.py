"""Hybrid retrieval and reranking for the medical RAG pipeline."""

from __future__ import annotations

import math
import re
from collections import Counter
from dataclasses import dataclass
from typing import Iterable

from langchain_core.documents import Document

import config
from rag.embeddings import get_embeddings
from utils.logger import agent_log, get_logger

logger = get_logger()

TOKEN_RE = re.compile(r"\b[a-zA-Z0-9][a-zA-Z0-9_\-]{1,}\b")
_reranker_model = None
_reranker_load_attempted = False


def tokenize(text: str) -> list[str]:
    """Tokenize text for lexical retrieval."""
    return [match.group(0).lower() for match in TOKEN_RE.finditer(text or "")]


def doc_key(doc: Document) -> str:
    """Build a stable key for a document chunk."""
    metadata = doc.metadata or {}
    return "|".join(
        [
            metadata.get("source_path", metadata.get("source", "unknown")),
            str(metadata.get("page", "")),
            str(metadata.get("chunk_index", "")),
            str(hash(doc.page_content)),
        ]
    )


def get_cross_encoder():
    """Lazy-load an optional cross-encoder reranker."""
    global _reranker_model, _reranker_load_attempted
    if _reranker_load_attempted:
        return _reranker_model

    _reranker_load_attempted = True
    if not config.RERANKER_MODEL:
        return None

    try:
        from sentence_transformers import CrossEncoder

        _reranker_model = CrossEncoder(
            config.RERANKER_MODEL,
            cache_folder=config.MODEL_CACHE_DIR,
            local_files_only=config.RERANKER_LOCAL_ONLY,
        )
        agent_log(
            logger,
            "rag",
            f"Loaded reranker model {config.RERANKER_MODEL}",
            "reranker",
        )
    except Exception as exc:
        agent_log(
            logger,
            "rag",
            f"Falling back to embedding reranker because cross-encoder load failed: {exc}",
            "reranker",
            "warning",
        )
        _reranker_model = None

    return _reranker_model


class LexicalIndex:
    """A lightweight BM25 lexical index over the source documents."""

    def __init__(self, documents: list[Document]):
        self.documents = documents
        self.doc_tokens = [tokenize(doc.page_content) for doc in documents]
        self.doc_lengths = [len(tokens) for tokens in self.doc_tokens]
        self.avg_doc_len = sum(self.doc_lengths) / max(len(self.doc_lengths), 1)
        self.doc_freqs: Counter[str] = Counter()

        for tokens in self.doc_tokens:
            for token in set(tokens):
                self.doc_freqs[token] += 1

    def search(self, query: str, k: int) -> list[tuple[Document, float]]:
        """Return top-k lexical matches using BM25 scoring."""
        query_tokens = tokenize(query)
        if not query_tokens:
            return []

        results: list[tuple[Document, float]] = []
        total_docs = max(len(self.documents), 1)
        k1 = 1.5
        b = 0.75

        for doc, tokens, doc_len in zip(self.documents, self.doc_tokens, self.doc_lengths):
            if not tokens:
                continue

            term_counts = Counter(tokens)
            score = 0.0
            for token in query_tokens:
                tf = term_counts.get(token, 0)
                if tf == 0:
                    continue

                df = self.doc_freqs.get(token, 0)
                idf = math.log(1 + ((total_docs - df + 0.5) / (df + 0.5)))
                denominator = tf + k1 * (1 - b + b * (doc_len / max(self.avg_doc_len, 1)))
                score += idf * ((tf * (k1 + 1)) / max(denominator, 1e-6))

            if score > 0:
                results.append((doc, score))

        results.sort(key=lambda item: item[1], reverse=True)
        return results[:k]


@dataclass
class Candidate:
    """Intermediate hybrid retrieval result."""

    document: Document
    hybrid_score: float = 0.0
    dense_rank: int | None = None
    lexical_rank: int | None = None
    rerank_score: float = 0.0


class HybridRetriever:
    """Combine dense retrieval, lexical retrieval, and reranking."""

    def __init__(self, vectorstore, documents: list[Document], k: int | None = None):
        self.vectorstore = vectorstore
        self.documents = documents
        self.k = k or config.RETRIEVER_K
        self.candidate_k = max(config.HYBRID_RETRIEVER_K, self.k)
        self.lexical_index = LexicalIndex(documents)
        self.embeddings = None
        try:
            self.embeddings = get_embeddings()
        except Exception as exc:
            agent_log(
                logger,
                "rag",
                f"Embeddings unavailable, retriever will fall back to lexical-only reranking: {exc}",
                "retrieve",
                "warning",
            )

    def _dense_search(self, query: str) -> list[tuple[Document, float]]:
        if self.vectorstore is None:
            return []
        try:
            return self.vectorstore.similarity_search_with_score(query, k=self.candidate_k)
        except Exception:
            docs = self.vectorstore.similarity_search(query, k=self.candidate_k)
            return [(doc, 0.0) for doc in docs]

    def _fuse_results(
        self,
        dense_results: list[tuple[Document, float]],
        lexical_results: list[tuple[Document, float]],
    ) -> list[Candidate]:
        candidates: dict[str, Candidate] = {}

        for rank, (doc, _score) in enumerate(dense_results, start=1):
            key = doc_key(doc)
            candidate = candidates.setdefault(key, Candidate(document=doc))
            candidate.dense_rank = rank
            candidate.hybrid_score += config.DENSE_WEIGHT / (config.HYBRID_RRF_K + rank)

        for rank, (doc, _score) in enumerate(lexical_results, start=1):
            key = doc_key(doc)
            candidate = candidates.setdefault(key, Candidate(document=doc))
            candidate.lexical_rank = rank
            candidate.hybrid_score += config.LEXICAL_WEIGHT / (config.HYBRID_RRF_K + rank)

        fused = list(candidates.values())
        fused.sort(key=lambda item: item.hybrid_score, reverse=True)
        return fused[: self.candidate_k]

    def _embedding_rerank(self, query: str, candidates: list[Candidate]) -> list[Candidate]:
        if self.embeddings is None:
            for candidate in candidates:
                candidate.rerank_score = candidate.hybrid_score
            return candidates

        query_embedding = self.embeddings.embed_query(query)
        document_embeddings = self.embeddings.embed_documents(
            [candidate.document.page_content for candidate in candidates]
        )

        for candidate, embedding in zip(candidates, document_embeddings):
            rerank_score = sum(q * d for q, d in zip(query_embedding, embedding))
            candidate.rerank_score = rerank_score

        return candidates

    def _cross_encoder_rerank(self, query: str, candidates: list[Candidate]) -> list[Candidate]:
        model = get_cross_encoder()
        if model is None:
            return self._embedding_rerank(query, candidates)

        scores = model.predict([(query, candidate.document.page_content) for candidate in candidates])
        for candidate, score in zip(candidates, scores):
            candidate.rerank_score = float(score)
        return candidates

    def _rerank(self, query: str, candidates: list[Candidate]) -> list[Candidate]:
        rerank_pool = candidates[: config.RERANK_TOP_N]
        if not rerank_pool:
            return candidates

        reranked = self._cross_encoder_rerank(query, rerank_pool)
        hybrid_scores = [candidate.hybrid_score for candidate in reranked]
        rerank_scores = [candidate.rerank_score for candidate in reranked]
        min_hybrid, max_hybrid = min(hybrid_scores), max(hybrid_scores)
        min_rerank, max_rerank = min(rerank_scores), max(rerank_scores)

        def normalize(value: float, min_value: float, max_value: float) -> float:
            if max_value == min_value:
                return 1.0
            return (value - min_value) / (max_value - min_value)

        reranked.sort(
            key=lambda candidate: (
                0.75 * normalize(candidate.rerank_score, min_rerank, max_rerank)
                + 0.25 * normalize(candidate.hybrid_score, min_hybrid, max_hybrid)
            ),
            reverse=True,
        )
        return reranked + candidates[config.RERANK_TOP_N :]

    def _annotate_documents(self, candidates: Iterable[Candidate], query: str) -> list[Document]:
        docs: list[Document] = []
        for candidate in candidates:
            metadata = {**candidate.document.metadata}
            metadata.update(
                {
                    "retrieval_strategy": "hybrid_reranked",
                    "retrieval_query": query,
                    "hybrid_score": round(candidate.hybrid_score, 6),
                    "rerank_score": round(candidate.rerank_score, 6),
                    "dense_rank": candidate.dense_rank,
                    "lexical_rank": candidate.lexical_rank,
                }
            )
            docs.append(Document(page_content=candidate.document.page_content, metadata=metadata))
        return docs

    def invoke(self, query: str) -> list[Document]:
        """Retrieve documents for a query."""
        dense_results = self._dense_search(query)
        lexical_results = self.lexical_index.search(query, self.candidate_k)
        fused = self._fuse_results(dense_results, lexical_results)
        reranked = self._rerank(query, fused)
        top_docs = reranked[: self.k]

        agent_log(
            logger,
            "rag",
            (
                f"Hybrid retrieval for '{query[:60]}' returned "
                f"{len(dense_results)} dense, {len(lexical_results)} lexical, "
                f"{len(top_docs)} final docs"
            ),
            "retrieve",
        )

        if not top_docs:
            agent_log(
                logger,
                "rag",
                f"No retrieval results found for query '{query[:80]}'",
                "retrieve",
                "warning",
            )

        return self._annotate_documents(top_docs, query)
