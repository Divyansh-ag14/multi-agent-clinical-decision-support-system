"""Hypothesis Agent — generates and refines differential diagnoses."""

import json

from langchain_core.messages import SystemMessage, HumanMessage

from agents.base import BaseAgent
from graph.state import ClinicalState

SYSTEM_PROMPT = """You are an expert diagnostician specializing in differential diagnosis.
Your role is to generate the most likely diagnoses based on the presented symptoms and evidence.

You must:
1. Consider all presented symptoms holistically
2. Consider the patient's visit history if provided — recurring conditions, chronic diagnoses,
   and prior presentations should inform your differential
3. Generate 3-5 ranked differential diagnoses
4. Assign a qualitative suspicion level for each diagnosis based on how well symptoms fit
5. Provide clear clinical reasoning for each hypothesis

Suspicion levels (use ONLY these exact values):
- "strong"   — classic presentation, most symptoms align, high clinical concern
- "moderate" — partial symptom fit, plausible but not definitive
- "low"      — possible but limited supporting symptoms, or significant findings argue against it

Do NOT assign numeric confidence scores. Use the qualitative levels above.

If patient visit history is provided:
- A diagnosis that appeared in prior visits is MORE likely if the patient presents with similar symptoms again
- Chronic conditions from history should be considered as ongoing differentials
- Note when current symptoms differ significantly from prior presentations — this may suggest a NEW condition
- Do NOT blindly repeat prior diagnoses; only elevate suspicion when the current symptoms support it

If you receive critic feedback from a previous iteration, you MUST:
- Address each issue raised by the critic
- Adjust suspicion levels based on critique
- Add or remove diagnoses as warranted
- Explain what changed and why

Respond in this exact JSON format:
{
    "hypotheses": [
        {
            "rank": 1,
            "diagnosis": "condition name",
            "suspicion_level": "strong",
            "reasoning": "clinical reasoning explaining why",
            "key_symptoms": ["matching symptoms"],
            "against": ["symptoms that don't fit well"]
        }
    ],
    "iteration_notes": "what changed from previous iteration (if applicable)"
}"""


class HypothesisAgent(BaseAgent):
    name = "hypothesis"
    description = "Generates top 3-5 differential diagnoses"

    def run(self, state: ClinicalState) -> dict:
        iteration = state.get("iterations", 0) + 1
        self._log(f"Generating hypotheses (iteration {iteration})", "begin")

        symptoms = state.get("symptoms", [])
        critic_feedback = state.get("critic_feedback", {})
        patient_memory = state.get("patient_memory", [])

        user_msg = f"Patient symptoms: {', '.join(symptoms)}"

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
            user_msg += f"\n\n--- PATIENT VISIT HISTORY (last {len(recent_visits)} visits) ---"
            user_msg += f"\n{json.dumps(history_summary, indent=2)}"
            user_msg += "\nConsider this history when forming your differential."

        if critic_feedback and critic_feedback.get("score", 0) > 0:
            user_msg += f"\n\n--- CRITIC FEEDBACK (iteration {iteration - 1}) ---"
            user_msg += f"\nCritique score: {critic_feedback.get('score', 'N/A')}"
            user_msg += f"\nIssues: {json.dumps(critic_feedback.get('issues', []))}"
            user_msg += f"\nMissing data: {json.dumps(critic_feedback.get('missing_data', []))}"
            user_msg += f"\nContradictions: {json.dumps(critic_feedback.get('contradictions', []))}"
            user_msg += f"\nRecommendations: {json.dumps(critic_feedback.get('recommendations', []))}"
            user_msg += "\n\nPlease refine your hypotheses based on this feedback."

        previous_hypotheses = state.get("hypotheses", [])
        if previous_hypotheses:
            user_msg += f"\n\nPrevious hypotheses:\n{json.dumps(previous_hypotheses, indent=2)}"

        content = self._timed_invoke([
            SystemMessage(content=SYSTEM_PROMPT),
            HumanMessage(content=user_msg),
        ])

        result = self._parse_json_response(content, {
            "hypotheses": [],
            "iteration_notes": content,
        })

        hypotheses = result.get("hypotheses", [])
        self._log(f"Generated {len(hypotheses)} hypotheses", "complete")

        output = self._make_output({
            "hypotheses": hypotheses,
            "iteration": iteration,
            "iteration_notes": result.get("iteration_notes", ""),
        })

        return {
            "hypotheses": hypotheses,
            "iterations": iteration,
            "current_agent": "hypothesis",
            "conversation": [
                {"role": "assistant", "content": json.dumps(result, indent=2), "agent": "hypothesis"},
            ],
            "agent_outputs": [output],
        }
