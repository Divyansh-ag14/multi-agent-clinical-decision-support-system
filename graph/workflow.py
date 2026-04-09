"""LangGraph workflow assembly — wires all agents into a stateful graph."""

from langgraph.graph import StateGraph, END

from graph.state import ClinicalState
from agents.interviewer import InterviewerAgent
from agents.hypothesis import HypothesisAgent
from agents.evidence import EvidenceAgent
from agents.critic import CriticAgent
from agents.decision import DecisionAgent
from agents.memory_agent import MemoryAgent
from utils.logger import get_logger, agent_log

logger = get_logger()

# Initialize agents (retriever loaded lazily to avoid slow torch import at startup)
interviewer = InterviewerAgent()
hypothesis_agent = HypothesisAgent()
evidence_agent = EvidenceAgent(retriever=None)
critic = CriticAgent()
decision = DecisionAgent()
memory_agent = MemoryAgent()

_retriever_loaded = False


def _ensure_retriever():
    """Lazy-load the RAG retriever on first use."""
    global _retriever_loaded
    if _retriever_loaded:
        return
    _retriever_loaded = True
    try:
        from rag.vectorstore import get_retriever
        evidence_agent.retriever = get_retriever()
        agent_log(logger, "workflow", "RAG retriever loaded", "init")
    except Exception as e:
        agent_log(logger, "workflow", f"RAG retriever unavailable: {e}", "init", "warning")


# --- Node functions ---

def interviewer_node(state: ClinicalState) -> dict:
    agent_log(logger, "workflow", "Entering INTERVIEWER node", "node", request_id=state.get("request_id", ""))
    return interviewer.run(state)


def hypothesis_node(state: ClinicalState) -> dict:
    agent_log(logger, "workflow", "Entering HYPOTHESIS node", "node", request_id=state.get("request_id", ""))
    return hypothesis_agent.run(state)


def evidence_node(state: ClinicalState) -> dict:
    agent_log(logger, "workflow", "Entering EVIDENCE node", "node", request_id=state.get("request_id", ""))
    _ensure_retriever()
    return evidence_agent.run(state)


def critic_node(state: ClinicalState) -> dict:
    agent_log(logger, "workflow", "Entering CRITIC node", "node", request_id=state.get("request_id", ""))
    return critic.run(state)


def decision_node(state: ClinicalState) -> dict:
    agent_log(logger, "workflow", "Entering DECISION node", "node", request_id=state.get("request_id", ""))
    return decision.run(state)


async def memory_node(state: ClinicalState) -> dict:
    agent_log(logger, "workflow", "Entering MEMORY node", "node", request_id=state.get("request_id", ""))
    return await memory_agent.save_and_retrieve(state)


def skip_critic_node(state: ClinicalState) -> dict:
    """Bypass critic and go straight to decision when critic is disabled."""
    agent_log(logger, "workflow", "Critic DISABLED — skipping to decision", "bypass", request_id=state.get("request_id", ""))
    return {
        "critic_feedback": {
            "score": 0.0,
            "issues": [],
            "missing_data": [],
            "contradictions": [],
            "recommendations": [],
            "strengths": ["Critic evaluation skipped by user"],
            "summary": "Critic agent was disabled for this run.",
        },
        "current_agent": "critic",
        "agent_outputs": [{
            "agent": "critic",
            "timestamp": "",
            "output": {"score": 0.0, "summary": "Critic disabled — skipped"},
        }],
    }


# --- Conditional edge: should the system loop? ---

def should_continue(state: ClinicalState) -> str:
    """Determine whether to loop back to hypothesis or proceed to decision."""
    critic_feedback = state.get("critic_feedback", {})
    score = critic_feedback.get("score", 0.0)
    iterations = state.get("iterations", 1)
    max_iterations = state.get("max_iterations", 3)
    threshold = state.get("critic_threshold", 0.3)

    agent_log(
        logger, "workflow",
        f"Loop check: score={score:.2f}, threshold={threshold}, "
        f"iteration={iterations}/{max_iterations}",
        "conditional",
        request_id=state.get("request_id", ""),
    )

    if score >= threshold and iterations < max_iterations:
        agent_log(logger, "workflow", f"LOOPING back to hypothesis (score {score:.2f} >= {threshold})", "loop", request_id=state.get("request_id", ""))
        return "hypothesis"
    else:
        reason = "score below threshold" if score < threshold else "max iterations reached"
        agent_log(logger, "workflow", f"Proceeding to decision ({reason})", "decision", request_id=state.get("request_id", ""))
        return "decision"


def should_use_critic(state: ClinicalState) -> str:
    """Check if critic is enabled."""
    if state.get("critic_enabled", True):
        return "critic"
    return "skip_critic"


# --- Build the graph ---

def build_workflow() -> StateGraph:
    """Construct and compile the LangGraph workflow."""
    workflow = StateGraph(ClinicalState)

    # Add nodes
    workflow.add_node("interviewer", interviewer_node)
    workflow.add_node("hypothesis", hypothesis_node)
    workflow.add_node("evidence", evidence_node)
    workflow.add_node("critic", critic_node)
    workflow.add_node("skip_critic", skip_critic_node)
    workflow.add_node("decision", decision_node)
    workflow.add_node("memory_update", memory_node)

    # Set entry point
    workflow.set_entry_point("interviewer")

    # Linear edges
    workflow.add_edge("interviewer", "hypothesis")
    workflow.add_edge("hypothesis", "evidence")

    # Conditional: critic enabled?
    workflow.add_conditional_edges(
        "evidence",
        should_use_critic,
        {"critic": "critic", "skip_critic": "skip_critic"},
    )

    # Conditional: loop or decide?
    workflow.add_conditional_edges(
        "critic",
        should_continue,
        {"hypothesis": "hypothesis", "decision": "decision"},
    )

    # Skip critic always goes to decision
    workflow.add_edge("skip_critic", "decision")

    # After decision, update memory then end
    workflow.add_edge("decision", "memory_update")
    workflow.add_edge("memory_update", END)

    return workflow.compile()


# Compiled graph singleton
graph = build_workflow()
