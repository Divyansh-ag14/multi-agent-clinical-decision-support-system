"""Decision Agent — produces final ranked diagnoses with confidence and explanations."""

import json

from langchain_core.messages import SystemMessage, HumanMessage

from agents.base import BaseAgent
from graph.state import ClinicalState

SYSTEM_PROMPT = """You are a senior clinician making a final diagnostic decision.
You have access to the complete diagnostic workup including symptoms, hypotheses,
evidence analysis, and critic feedback from multiple iterations.

Your role is to:
1. Synthesize ALL available information including patient visit history
2. Produce a final ranked list of the top 3 diagnoses
3. Assign a qualitative confidence level for each diagnosis — this MUST be consistent
   with the evidence support level from the evidence analysis
4. Provide clear, patient-friendly explanations
5. Recommend next steps for each diagnosis
6. Be conservative when evidence is incomplete, weak, or contradictory
7. Factor in patient history — recurring diagnoses with similar symptoms strengthen
   confidence; chronic conditions should be noted in the clinical summary

Confidence levels (use ONLY these exact values):
- "strong"   — classic presentation AND strong evidence support; high clinical concern
- "moderate" — partial symptom fit OR mixed/moderate evidence support
- "low"      — possible but limited evidence, significant gaps, or contradicting findings
- "insufficient_evidence" — no relevant evidence was retrieved for this diagnosis;
  clinical judgment required before acting on this assessment

CRITICAL RULES:
- If the evidence analysis shows "weak" support for a diagnosis, you MUST NOT assign "strong" confidence
- If evidence analysis found contradicting evidence, note it and lower the confidence level
- If no evidence was retrieved for a diagnosis, assign "insufficient_evidence"
- Do NOT invent numeric confidence scores. Use the qualitative levels above.
- If patient history shows the same diagnosis recurring with similar symptoms, mention it
  in the explanation (e.g., "This is the patient's 3rd presentation with similar symptoms")
- Do NOT elevate confidence based on history alone — evidence must still support the diagnosis

Safety requirements:
- Do not overstate certainty
- If evidence is limited, say so clearly in caveats
- Recommend confirmatory testing when available information is insufficient

Respond in this exact JSON format:
{
    "final_diagnoses": [
        {
            "rank": 1,
            "diagnosis": "Primary Diagnosis Name",
            "confidence": "strong",
            "explanation": "Clear explanation of why this is the top diagnosis",
            "key_evidence": ["most important supporting evidence"],
            "recommended_tests": ["recommended confirmatory tests"],
            "urgency": "high|medium|low"
        }
    ],
    "clinical_summary": "comprehensive summary of the diagnostic reasoning process",
    "caveats": ["important limitations or uncertainties"],
    "total_iterations": 2
}"""


class DecisionAgent(BaseAgent):
    name = "decision"
    description = "Produces final ranked diagnoses with confidence scores"

    def run(self, state: ClinicalState) -> dict:
        self._log("Making final diagnostic decision", "begin")

        symptoms = state.get("symptoms", [])
        hypotheses = state.get("hypotheses", [])
        evidence = state.get("evidence", [])
        critic_feedback = state.get("critic_feedback", {})
        iterations = state.get("iterations", 1)
        patient_memory = state.get("patient_memory", [])
        evidence_gaps = []
        if isinstance(critic_feedback, dict):
            evidence_gaps = critic_feedback.get("missing_data", []) or []

        safety_note = (
            "\n\nSAFETY NOTE:\n"
            "- If evidence is incomplete or weak, explicitly mention insufficient evidence in caveats.\n"
            "- If the critic score is high or missing data remains, lower confidence and recommend further evaluation.\n"
        )

        history_section = ""
        if patient_memory:
            recent_visits = patient_memory[-5:]
            history_summary = []
            for visit in recent_visits:
                diagnoses = visit.get("diagnoses", [])
                visit_symptoms = visit.get("symptoms", [])
                timestamp = visit.get("timestamp", "unknown date")
                if isinstance(diagnoses, list):
                    diag_names = [d.get("diagnosis", str(d)) if isinstance(d, dict) else str(d) for d in diagnoses]
                else:
                    diag_names = [str(diagnoses)]
                history_summary.append({
                    "date": timestamp,
                    "diagnoses": diag_names,
                    "symptoms": visit_symptoms if isinstance(visit_symptoms, list) else [str(visit_symptoms)],
                })
            history_section = (
                f"\n\nPATIENT VISIT HISTORY (last {len(recent_visits)} visits):\n"
                f"{json.dumps(history_summary, indent=2)}\n"
                "Consider recurrence patterns and chronic conditions in your decision."
            )

        user_msg = (
            f"TOTAL ITERATIONS COMPLETED: {iterations}\n\n"
            f"Patient symptoms: {', '.join(symptoms)}\n\n"
            f"Final hypotheses:\n{json.dumps(hypotheses, indent=2)}\n\n"
            f"Evidence analysis:\n{json.dumps(evidence, indent=2)}\n\n"
            f"Final critic feedback:\n{json.dumps(critic_feedback, indent=2)}\n\n"
            f"Missing or unresolved data:\n{json.dumps(evidence_gaps, indent=2)}"
            f"{history_section}"
            f"{safety_note}"
        )

        content = self._timed_invoke([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ])

        result = self._parse_json_response(content, {
            "final_diagnoses": [],
            "clinical_summary": content,
            "caveats": [],
            "total_iterations": iterations,
        })

        final_diagnoses = result.get("final_diagnoses", [])
        caveats = result.get("caveats", [])
        if not evidence:
            caveats = ["Evidence retrieval returned no supporting documents. The assessment should be treated as low-confidence until additional evidence is reviewed.", *caveats]
        if evidence_gaps and not any("insufficient" in str(c).lower() or "limited" in str(c).lower() for c in caveats):
            caveats = [
                "Available evidence remains limited and additional clinical evaluation is recommended before treating this as a definitive conclusion.",
                *caveats,
            ]
        self._log(f"Final decision: {len(final_diagnoses)} diagnoses ranked", "complete")

        output = self._make_output({
            "final_diagnoses": final_diagnoses,
            "clinical_summary": result.get("clinical_summary", ""),
            "caveats": caveats,
            "total_iterations": iterations,
        })

        return {
            "final_diagnosis": final_diagnoses,
            "clinical_summary": result.get("clinical_summary", ""),
            "caveats": caveats,
            "current_agent": "decision",
            "conversation": [
                {"role": "assistant", "content": json.dumps(result, indent=2), "agent": "decision"},
            ],
            "agent_outputs": [output],
        }
