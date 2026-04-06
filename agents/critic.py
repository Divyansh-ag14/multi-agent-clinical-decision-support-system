"""Critic Agent — challenges reasoning, identifies gaps, and scores diagnostic quality."""

import json

from langchain_core.messages import SystemMessage, HumanMessage

from agents.base import BaseAgent
from graph.state import ClinicalState

SYSTEM_PROMPT = """You are a rigorous medical critic evaluating a symptom-based clinical decision support system.

IMPORTANT SCOPE: This system performs PRE-DIAGNOSIS triage from patient-reported symptoms.
It generates a ranked differential and recommends which tests the clinician should order.
It does NOT have access to lab results, imaging, ECG, vitals, or physical exam findings.
Do NOT penalize for missing data that has not been collected yet — the system's job is to
tell the clinician WHICH tests to order, not to interpret results.

Evaluate ONLY within this scope:
1. DIFFERENTIAL COVERAGE: Are important alternative diagnoses being missed given the symptoms?
2. SYMPTOM ACCOUNTING: Are all reported symptoms explained by the differential?
3. EVIDENCE ALIGNMENT: Does the retrieved medical evidence actually support the proposed diagnoses?
4. REASONING CONSISTENCY: Is the clinical logic sound? Any contradictions between hypotheses and evidence?
5. TEST RECOMMENDATIONS: Are the recommended tests appropriate and complete for the differential?

Do NOT penalize for:
- Missing lab results, imaging, ECG, or vitals (these haven't been collected yet)
- Missing physical exam findings
- Lack of patient demographics beyond what was provided
- Not having a definitive single diagnosis (a ranked differential IS the correct output)

Assign a critique score from 0.0 to 1.0:
- 0.00–0.15 = Excellent: tight differential, strong evidence alignment, appropriate tests recommended
- 0.15–0.30 = Good: minor gaps (e.g. one uncommon alternative not listed), but sound reasoning
- 0.30–0.50 = Moderate: missed differential the symptoms support, weak evidence links, or inconsistent logic
- 0.50–0.70 = Poor: important differentials missing, contradictions between evidence and conclusions
- 0.70–1.00 = Critical: fundamentally flawed reasoning, diagnosis contradicts the symptoms

CALIBRATION RULES:
- A textbook presentation with a clear differential should score 0.05–0.15
- An ambiguous case with overlapping symptoms should score 0.20–0.40
- Score should decrease across iterations as issues are addressed
- Only score above 0.50 for genuine reasoning flaws, not for missing external data

Respond in this exact JSON format:
{
    "score": 0.15,
    "issues": [
        {
            "severity": "high|medium|low",
            "category": "differential|symptoms|evidence|reasoning|tests",
            "description": "clear description of the issue"
        }
    ],
    "missing_data": ["only data the PATIENT could provide but didn't — never lab/imaging results"],
    "contradictions": ["specific contradictions found"],
    "recommendations": ["specific actionable improvements within the system's scope"],
    "strengths": ["what the reasoning got right"],
    "summary": "overall critique summary"
}"""


class CriticAgent(BaseAgent):
    name = "critic"
    description = "Challenges reasoning and scores diagnostic quality"

    def run(self, state: ClinicalState) -> dict:
        iteration = state.get("iterations", 1)
        self._log(f"Critiquing diagnostic reasoning (iteration {iteration})", "begin")

        symptoms = state.get("symptoms", [])
        hypotheses = state.get("hypotheses", [])
        evidence = state.get("evidence", [])

        user_msg = (
            f"CURRENT ITERATION: {iteration}\n\n"
            f"Patient symptoms: {', '.join(symptoms)}\n\n"
            f"Diagnostic hypotheses:\n{json.dumps(hypotheses, indent=2)}\n\n"
            f"Evidence analysis:\n{json.dumps(evidence, indent=2)}"
        )

        previous_feedback = state.get("critic_feedback", {})
        if previous_feedback and previous_feedback.get("score", 0) > 0:
            user_msg += f"\n\nPrevious critique (iteration {iteration - 1}):\n{json.dumps(previous_feedback, indent=2)}"
            user_msg += "\n\nEvaluate whether previous issues have been addressed."

        content = self._timed_invoke([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ])

        result = self._parse_json_response(content, {
            "score": 0.3,
            "issues": [],
            "missing_data": [],
            "contradictions": [],
            "recommendations": [],
            "strengths": [],
            "summary": content,
        })

        score = float(result.get("score", 0.5))

        # Clamp score to valid range
        score = max(0.0, min(1.0, score))

        self._log(f"Critique score: {score:.2f} ({len(result.get('issues', []))} issues)", "complete")

        output = self._make_output({
            "score": score,
            "issues": result.get("issues", []),
            "missing_data": result.get("missing_data", []),
            "contradictions": result.get("contradictions", []),
            "recommendations": result.get("recommendations", []),
            "strengths": result.get("strengths", []),
            "summary": result.get("summary", ""),
            "iteration": iteration,
        })

        return {
            "critic_feedback": {
                "score": score,
                "issues": result.get("issues", []),
                "missing_data": result.get("missing_data", []),
                "contradictions": result.get("contradictions", []),
                "recommendations": result.get("recommendations", []),
                "strengths": result.get("strengths", []),
                "summary": result.get("summary", ""),
            },
            "current_agent": "critic",
            "conversation": [
                {"role": "assistant", "content": json.dumps(result, indent=2), "agent": "critic"},
            ],
            "agent_outputs": [output],
        }
