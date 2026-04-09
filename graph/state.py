"""Central state definition for the clinical decision support workflow."""

from typing import TypedDict, Annotated
from operator import add


def replace_value(existing, new):
    """Reducer that replaces the old value with the new one."""
    return new


def merge_dict(existing, new):
    """Reducer that merges dicts, with new values overwriting existing."""
    if existing is None:
        return new
    if new is None:
        return existing
    merged = {**existing}
    merged.update(new)
    return merged


class ClinicalState(TypedDict):
    """Shared state object passed between all agents in the workflow."""

    # Patient / clinician identification
    patient_id: str
    clinician_id: Annotated[str, replace_value]
    request_id: Annotated[str, replace_value]

    # Symptom data collected by interviewer
    symptoms: Annotated[list[str], replace_value]

    # Full conversation log: [{role, content, agent, timestamp}]
    conversation: Annotated[list[dict], add]

    # Hypotheses from hypothesis agent: [{diagnosis, confidence, reasoning}]
    hypotheses: Annotated[list[dict], replace_value]

    # Evidence from RAG: [{source, content, supports, hypothesis, relevance_score}]
    evidence: Annotated[list[dict], replace_value]

    # Critic feedback: {score, issues, missing_data, contradictions, recommendations}
    critic_feedback: Annotated[dict, replace_value]

    # Loop control
    iterations: Annotated[int, replace_value]
    max_iterations: Annotated[int, replace_value]
    critic_threshold: Annotated[float, replace_value]
    critic_enabled: Annotated[bool, replace_value]

    # Final output
    final_diagnosis: Annotated[list[dict], replace_value]
    clinical_summary: Annotated[str, replace_value]
    caveats: Annotated[list[str], replace_value]

    # Memory
    patient_memory: Annotated[list[dict], replace_value]

    # Streaming / UI state
    current_agent: Annotated[str, replace_value]
    agent_outputs: Annotated[list[dict], add]
