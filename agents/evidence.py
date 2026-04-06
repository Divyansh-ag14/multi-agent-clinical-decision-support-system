"""Evidence Agent — retrieves and evaluates medical evidence using RAG."""

import json

from langchain_core.messages import SystemMessage, HumanMessage

import config
from agents.base import BaseAgent
from graph.state import ClinicalState

SYSTEM_PROMPT = """You are a medical evidence specialist. Your role is to evaluate diagnostic hypotheses
against retrieved medical knowledge and determine how well the evidence supports or refutes each diagnosis.

You will receive:
1. Patient symptoms
2. Diagnostic hypotheses
3. Retrieved medical evidence from a knowledge base

For each hypothesis, you must:
- Evaluate how well the retrieved evidence supports it
- Identify evidence that contradicts it
- Assess the strength of the evidence (strong/moderate/weak)
- Note any critical information gaps

Respond in this exact JSON format:
{
    "evidence_analysis": [
        {
            "hypothesis": "diagnosis name",
            "support_level": "strong|moderate|weak",
            "supporting_evidence": ["evidence points that support"],
            "contradicting_evidence": ["evidence points that contradict"],
            "relevance_score": 0.85,
            "key_findings": "summary of most important evidence"
        }
    ],
    "overall_assessment": "brief overall assessment of evidence quality",
    "evidence_gaps": ["important missing evidence"]
}"""


class EvidenceAgent(BaseAgent):
    name = "evidence"
    description = "Retrieves and evaluates medical evidence using RAG"

    def __init__(self, retriever=None, **kwargs):
        super().__init__(**kwargs)
        self.retriever = retriever

    @staticmethod
    def _normalize_name(name: str) -> str:
        return (name or "").strip().lower()

    @staticmethod
    def _chunk_key(chunk: dict) -> str:
        return "|".join(
            [
                str(chunk.get("source_path", chunk.get("source", "unknown"))),
                str(chunk.get("page", "")),
                str(chunk.get("chunk_index", "")),
                str(hash(chunk.get("content", ""))),
            ]
        )

    def _build_chunk(self, doc, diagnosis: str, query: str) -> dict:
        content = (doc.page_content or "").strip()
        metadata = doc.metadata or {}
        return {
            "source": metadata.get("source", "medical_knowledge_base"),
            "source_title": metadata.get("source_title", metadata.get("source", "medical_knowledge_base")),
            "source_path": metadata.get("source_path", metadata.get("source", "medical_knowledge_base")),
            "source_type": metadata.get("source_type", "unknown"),
            "document_type": metadata.get("document_type", metadata.get("source_type", "unknown")),
            "condition": metadata.get("condition", diagnosis or "unknown"),
            "section": metadata.get("section", "general"),
            "page": metadata.get("page"),
            "chunk_index": metadata.get("chunk_index"),
            "retrieval_strategy": metadata.get("retrieval_strategy", "dense"),
            "retrieval_query": metadata.get("retrieval_query", query),
            "hybrid_score": metadata.get("hybrid_score"),
            "rerank_score": metadata.get("rerank_score"),
            "content": content,
        }

    def _retrieve_evidence(
        self, hypotheses: list[dict], symptoms: list[str]
    ) -> tuple[list[dict], dict[str, list[dict]]]:
        """Retrieve evidence from vector store for each hypothesis."""
        if not self.retriever:
            self._log("No retriever configured — skipping evidence retrieval", "warning")
            return [], {}

        all_evidence = []
        seen_global = set()
        evidence_by_hypothesis: dict[str, list[dict]] = {}

        for hyp in hypotheses:
            diagnosis = hyp.get("diagnosis", "")
            diagnosis_key = self._normalize_name(diagnosis)
            evidence_by_hypothesis[diagnosis_key] = []
            seen_local = set()
            queries = [
                f"{diagnosis} symptoms diagnosis criteria",
                f"{diagnosis} differential diagnosis {' '.join(symptoms[:3])}",
                f"clinical presentation {diagnosis}",
            ]

            for query in queries:
                try:
                    docs = self.retriever.invoke(query)
                except Exception as e:
                    self._log(f"Retrieval failed for query '{query[:50]}': {e}", "warning")
                    continue

                for doc in docs:
                    chunk = self._build_chunk(doc, diagnosis, query)
                    if not chunk["content"]:
                        continue

                    key = self._chunk_key(chunk)
                    if key not in seen_global:
                        seen_global.add(key)
                        all_evidence.append(chunk)

                    if key not in seen_local:
                        seen_local.add(key)
                        evidence_by_hypothesis[diagnosis_key].append(chunk)

        return all_evidence, evidence_by_hypothesis

    def run(self, state: ClinicalState) -> dict:
        self._log("Retrieving and evaluating evidence", "begin")

        symptoms = state.get("symptoms", [])
        hypotheses = state.get("hypotheses", [])

        rag_available = self.retriever is not None
        retrieved_docs, retrieved_by_hypothesis = self._retrieve_evidence(hypotheses, symptoms)
        self._log(f"Retrieved {len(retrieved_docs)} unique evidence chunks (RAG {'available' if rag_available else 'UNAVAILABLE'})", "retrieval")

        max_docs = config.MAX_EVIDENCE_DOCS
        evidence_text = json.dumps(retrieved_docs[:max_docs], indent=2)
        hypotheses_text = json.dumps(hypotheses, indent=2)

        rag_note = ""
        if not rag_available:
            rag_note = ("\n\nIMPORTANT: The medical knowledge retrieval system (RAG) is currently unavailable. "
                        "Provide your best analysis based on general medical knowledge, but note this limitation.\n")

        user_msg = (
            f"Patient symptoms: {', '.join(symptoms)}\n\n"
            f"Diagnostic hypotheses:\n{hypotheses_text}\n\n"
            f"Retrieved medical evidence:\n{evidence_text}"
            f"{rag_note}"
        )

        content = self._timed_invoke([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ])

        result = self._parse_json_response(content, {
            "evidence_analysis": [],
            "overall_assessment": content,
            "evidence_gaps": [],
        })

        evidence_entries = []
        for analysis in result.get("evidence_analysis", []):
            hypothesis_name = analysis.get("hypothesis", "")
            hypothesis_key = self._normalize_name(hypothesis_name)
            citations = retrieved_by_hypothesis.get(hypothesis_key, [])

            # Flag diagnoses with no retrieved evidence
            has_evidence = len(citations) > 0
            support_level = analysis.get("support_level", "unknown")
            if not has_evidence:
                support_level = "insufficient_evidence"

            evidence_entries.append({
                "hypothesis": hypothesis_name,
                "support_level": support_level,
                "supporting_evidence": analysis.get("supporting_evidence", []),
                "contradicting_evidence": analysis.get("contradicting_evidence", []),
                "relevance_score": analysis.get("relevance_score", 0.0),
                "key_findings": analysis.get("key_findings", "") if has_evidence else "No relevant evidence was retrieved from the knowledge base for this diagnosis. Clinical judgment required.",
                "citations": citations[: config.MAX_CITATIONS_PER_HYPOTHESIS],
                "has_evidence": has_evidence,
            })

        self._log(f"Analyzed evidence for {len(evidence_entries)} hypotheses", "complete")

        output = self._make_output({
            "evidence_analysis": evidence_entries,
            "retrieved_chunks": retrieved_docs[:max_docs],
            "rag_available": rag_available,
            "overall_assessment": result.get("overall_assessment", ""),
            "evidence_gaps": result.get("evidence_gaps", []),
        })

        return {
            "evidence": evidence_entries,
            "current_agent": "evidence",
            "conversation": [
                {"role": "assistant", "content": json.dumps(result, indent=2), "agent": "evidence"},
            ],
            "agent_outputs": [output],
        }
