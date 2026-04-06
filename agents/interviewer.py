"""Interviewer Agent — collects symptoms and asks structured follow-up questions."""

import json

from langchain_core.messages import SystemMessage, HumanMessage

from agents.base import BaseAgent
from graph.state import ClinicalState

QUESTION_PROMPT = """You are an expert clinical interviewer conducting a patient intake assessment.
Your role is to:
1. Analyze the presented symptoms carefully
2. Ask targeted follow-up questions to gather critical missing information

Given the patient's symptoms, generate 3-5 specific follow-up questions that would be
diagnostically valuable. These questions will be shown to the actual patient for them to answer.

Make questions clear and patient-friendly (not overly medical).

Respond in this exact JSON format:
{
    "follow_up_questions": [
        {
            "id": "q1",
            "question": "clear, patient-friendly question",
            "clinical_relevance": "why this matters (shown as hint to patient)",
            "type": "text"
        }
    ],
    "extracted_symptoms": ["symptom1", "symptom2", ...],
    "symptom_summary": "A brief clinical summary of the patient presentation so far"
}"""

SYNTHESIS_PROMPT = """You are an expert clinical interviewer synthesizing patient intake data.

You have the patient's initial symptoms AND their answers to follow-up questions.
Your job is to create a comprehensive, structured symptom profile.

Analyze the answers carefully and extract ALL relevant clinical information:
- New symptoms mentioned in answers
- Severity indicators
- Duration and timeline details
- Relevant medical history
- Risk factors

Respond in this exact JSON format:
{
    "extracted_symptoms": ["complete list of all symptoms and relevant findings"],
    "symptom_summary": "comprehensive clinical summary incorporating all information",
    "key_findings": ["most diagnostically significant findings from the interview"],
    "risk_factors": ["identified risk factors"]
}"""


class InterviewerAgent(BaseAgent):
    name = "interviewer"
    description = "Collects symptoms and asks structured follow-up questions"

    def generate_questions(self, symptoms: list[str], patient_memory: list[dict] = None) -> dict:
        """Phase 1: Generate follow-up questions for the patient to answer."""
        self._log("Generating follow-up questions", "questions")

        user_msg = f"Patient presents with the following symptoms: {', '.join(symptoms)}"
        if patient_memory:
            past_visits = json.dumps(patient_memory[-3:], indent=2)
            user_msg += f"\n\nPrevious visit history:\n{past_visits}"

        content = self._timed_invoke([
            SystemMessage(content=QUESTION_PROMPT),
            HumanMessage(content=user_msg),
        ])

        result = self._parse_json_response(content, {
            "follow_up_questions": [],
            "extracted_symptoms": symptoms,
            "symptom_summary": content,
        })

        self._log(f"Generated {len(result.get('follow_up_questions', []))} questions", "complete")
        return result

    def run(self, state: ClinicalState) -> dict:
        """Phase 2: Process patient answers and synthesize full symptom profile."""
        self._log("Synthesizing patient interview data", "begin")

        symptoms = state.get("symptoms", [])
        conversation = state.get("conversation", [])

        # Look for user answers in the conversation
        user_answers = [
            entry for entry in conversation
            if entry.get("role") == "user" and entry.get("agent") == "interviewer"
        ]

        if user_answers:
            # We have real patient answers — synthesize them
            answers_text = "\n".join(
                f"Q: {a.get('question', 'N/A')}\nA: {a.get('content', 'N/A')}"
                for a in user_answers
            )

            user_msg = (
                f"Initial symptoms: {', '.join(symptoms)}\n\n"
                f"Patient's answers to follow-up questions:\n{answers_text}"
            )

            content = self._timed_invoke([
                SystemMessage(content=SYNTHESIS_PROMPT),
                HumanMessage(content=user_msg),
            ])

            result = self._parse_json_response(content, {
                "extracted_symptoms": symptoms,
                "symptom_summary": content,
            })

            extracted = result.get("extracted_symptoms", [])
            all_symptoms = list(set(symptoms + extracted))

            output = self._make_output({
                "symptom_summary": result.get("symptom_summary", ""),
                "extracted_symptoms": all_symptoms,
                "key_findings": result.get("key_findings", []),
                "risk_factors": result.get("risk_factors", []),
                "patient_answers": [
                    {"question": a.get("question", ""), "answer": a.get("content", "")}
                    for a in user_answers
                ],
            })
        else:
            # No answers — just extract from initial symptoms
            result = self.generate_questions(symptoms)
            extracted = result.get("extracted_symptoms", symptoms)
            all_symptoms = list(set(symptoms + extracted))

            output = self._make_output({
                "symptom_summary": result.get("symptom_summary", ""),
                "extracted_symptoms": all_symptoms,
                "follow_up_questions": result.get("follow_up_questions", []),
            })

        self._log(f"Synthesized {len(all_symptoms)} symptoms", "complete")

        return {
            "symptoms": all_symptoms,
            "current_agent": "interviewer",
            "conversation": [
                {"role": "assistant", "content": json.dumps(result, indent=2), "agent": "interviewer"},
            ],
            "agent_outputs": [output],
        }
