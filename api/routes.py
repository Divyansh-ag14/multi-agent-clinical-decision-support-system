"""FastAPI routes — SSE streaming diagnosis endpoint and memory retrieval."""

import json
import uuid
import asyncio
import traceback
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import StreamingResponse
from slowapi import Limiter
from slowapi.util import get_remote_address

import config
from api.models import DiagnoseRequest, InterviewRequest, MemoryResponse
from auth.dependencies import get_current_user
from graph.state import ClinicalState
from memory.long_term import LongTermMemory
from utils.logger import get_logger, agent_log

router = APIRouter()
memory_store = LongTermMemory()
logger = get_logger("api")
limiter = Limiter(key_func=get_remote_address)


def _request_id(request: Request | None) -> str:
    if request is None:
        return uuid.uuid4().hex[:8]
    return getattr(request.state, "request_id", "") or uuid.uuid4().hex[:8]


@router.post("/interview")
@limiter.limit("10/minute")
async def interview(body: InterviewRequest, request: Request, user: dict = Depends(get_current_user)):
    """Generate follow-up interview questions for the patient."""
    clinician_id = user["sub"]
    request_id = _request_id(request)
    agent_log(
        logger,
        "api",
        f"Interview request: patient={body.patient_id}, symptoms={body.symptoms}",
        "interview",
        request_id=request_id,
    )
    from agents.interviewer import InterviewerAgent

    agent = InterviewerAgent()

    # Load patient memory for context
    patient_memory = []
    try:
        patient_memory = await memory_store.get_history(body.patient_id, clinician_id=clinician_id)
    except Exception as e:
        agent_log(logger, "api", f"Failed to load patient memory: {e}", "interview", "warning", request_id=request_id)

    result = agent.generate_questions(body.symptoms, patient_memory or None)
    agent_log(
        logger,
        "api",
        f"Generated {len(result.get('follow_up_questions', []))} questions",
        "interview",
        request_id=request_id,
    )
    return result


async def _run_diagnosis_stream(body: DiagnoseRequest, request_id: str, clinician_id: str = None):
    """Run the diagnosis workflow and yield SSE events."""
    # Lazy import to avoid circular imports at module level
    from graph.workflow import graph

    started = datetime.now(timezone.utc)
    agent_log(logger, "api", f"Diagnosis request: patient={body.patient_id}, symptoms={body.symptoms}, "
              f"answers={len(body.interview_answers)}, critic={body.critic_enabled}, "
              f"max_iter={body.max_iterations}", "diagnose", request_id=request_id)

    # Build conversation entries from interview answers
    conversation = []
    for ans in body.interview_answers:
        conversation.append({
            "role": "user",
            "agent": "interviewer",
            "question": ans.question,
            "content": ans.answer,
        })

    if conversation:
        agent_log(logger, "api", f"Injected {len(conversation)} interview answers into conversation", "diagnose", request_id=request_id)

    initial_state: ClinicalState = {
        "patient_id": body.patient_id,
        "clinician_id": clinician_id or "",
        "request_id": request_id,
        "symptoms": body.symptoms,
        "conversation": conversation,
        "hypotheses": [],
        "evidence": [],
        "critic_feedback": {},
        "iterations": 0,
        "max_iterations": body.max_iterations,
        "critic_threshold": body.critic_threshold,
        "critic_enabled": body.critic_enabled,
        "final_diagnosis": [],
        "clinical_summary": "",
        "caveats": [],
        "patient_memory": [],
        "current_agent": "",
        "agent_outputs": [],
    }

    # Load patient history
    try:
        history = await memory_store.get_history(body.patient_id, clinician_id=clinician_id)
        initial_state["patient_memory"] = history
        agent_log(logger, "api", f"Loaded {len(history)} past visits for {body.patient_id}", "diagnose", request_id=request_id)
    except Exception as e:
        agent_log(logger, "api", f"Failed to load patient memory: {e}", "diagnose", "warning", request_id=request_id)

    # Send initial event
    start_event = {
        "type": "start",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_id": request_id,
        "session_id": request_id,
        "patient_id": body.patient_id,
        "symptoms": body.symptoms,
        "critic_enabled": body.critic_enabled,
        "max_iterations": body.max_iterations,
        "critic_threshold": body.critic_threshold,
    }
    yield f"event: start\ndata: {json.dumps(start_event)}\n\n"

    # Stream graph execution
    try:
        async for event in graph.astream(initial_state, stream_mode="updates"):
            for node_name, node_output in event.items():
                agent_log(logger, "api", f"Node '{node_name}' completed, keys: {list(node_output.keys())}", "stream", request_id=request_id)

                agent_outputs = node_output.get("agent_outputs", [])
                for agent_output in agent_outputs:
                    sse_data = {
                        "type": "agent_update",
                        "agent": agent_output.get("agent", node_name),
                        "node": node_name,
                        "timestamp": agent_output.get("timestamp", datetime.now(timezone.utc).isoformat()),
                        "output": agent_output.get("output", {}),
                        "iteration": node_output.get("iterations", 0),
                    }
                    yield f"event: agent_update\ndata: {json.dumps(sse_data)}\n\n"

                # Send node-level state updates
                state_update = {
                    "type": "state_update",
                    "node": node_name,
                    "timestamp": datetime.now(timezone.utc).isoformat(),
                }

                if "hypotheses" in node_output:
                    state_update["hypotheses"] = node_output["hypotheses"]
                if "evidence" in node_output:
                    state_update["evidence"] = node_output["evidence"]
                if "critic_feedback" in node_output:
                    state_update["critic_feedback"] = node_output["critic_feedback"]
                if "final_diagnosis" in node_output:
                    state_update["final_diagnosis"] = node_output["final_diagnosis"]
                    agent_log(logger, "api", f"Sending final_diagnosis with {len(node_output['final_diagnosis'])} entries", "stream", request_id=request_id)
                if "patient_memory" in node_output:
                    state_update["patient_memory"] = node_output["patient_memory"]
                if "iterations" in node_output:
                    state_update["iterations"] = node_output["iterations"]
                if "symptoms" in node_output:
                    state_update["symptoms"] = node_output["symptoms"]
                if "clinical_summary" in node_output:
                    state_update["clinical_summary"] = node_output["clinical_summary"]
                if "caveats" in node_output:
                    state_update["caveats"] = node_output["caveats"]

                yield f"event: state_update\ndata: {json.dumps(state_update)}\n\n"

                # Small delay for frontend rendering
                await asyncio.sleep(0.05)

    except Exception as e:
        agent_log(logger, "api", f"Workflow error: {e}\n{traceback.format_exc()}", "stream", "error", request_id=request_id)
        error_event = {
            "type": "error",
            "message": "An error occurred during diagnosis. Please try again.",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "request_id": request_id,
        }
        yield f"event: error\ndata: {json.dumps(error_event)}\n\n"
        return

    # Send completion event
    agent_log(logger, "api", "Diagnosis workflow completed successfully", "diagnose", request_id=request_id)
    complete_event = {
        "type": "complete",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "request_id": request_id,
        "duration_ms": round((datetime.now(timezone.utc) - started).total_seconds() * 1000, 1),
    }
    yield f"event: complete\ndata: {json.dumps(complete_event)}\n\n"


@router.post("/diagnose")
@limiter.limit("5/minute")
async def diagnose(body: DiagnoseRequest, request: Request, user: dict = Depends(get_current_user)):
    """Run the full clinical diagnosis workflow with SSE streaming."""
    request_id = _request_id(request)
    clinician_id = user["sub"]
    return StreamingResponse(
        _run_diagnosis_stream(body, request_id, clinician_id=clinician_id),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
            config.REQUEST_ID_HEADER: request_id,
        },
    )


@router.post("/diagnose/compare")
@limiter.limit("3/minute")
async def diagnose_compare(body: DiagnoseRequest, request: Request, user: dict = Depends(get_current_user)):
    """Run diagnosis with and without critic for comparison."""
    from graph.workflow import graph

    clinician_id = user["sub"]
    request_id = _request_id(request)
    agent_log(logger, "api", f"Compare request: patient={body.patient_id}", "compare", request_id=request_id)

    async def run_single(critic_enabled: bool) -> dict:
        state: ClinicalState = {
            "patient_id": body.patient_id,
            "clinician_id": clinician_id,
            "request_id": request_id,
            "symptoms": body.symptoms,
            "conversation": [],
            "hypotheses": [],
            "evidence": [],
            "critic_feedback": {},
            "iterations": 0,
            "max_iterations": body.max_iterations,
            "critic_threshold": body.critic_threshold,
            "critic_enabled": critic_enabled,
            "final_diagnosis": [],
            "clinical_summary": "",
            "caveats": [],
            "patient_memory": [],
            "current_agent": "",
            "agent_outputs": [],
        }

        result = await graph.ainvoke(state)
        return {
            "critic_enabled": critic_enabled,
            "final_diagnosis": result.get("final_diagnosis", []),
            "iterations": result.get("iterations", 0),
            "critic_feedback": result.get("critic_feedback", {}),
            "agent_outputs": result.get("agent_outputs", []),
        }

    try:
        with_critic, without_critic = await asyncio.gather(
            asyncio.wait_for(run_single(True), timeout=300),
            asyncio.wait_for(run_single(False), timeout=300),
        )
    except asyncio.TimeoutError:
        agent_log(logger, "api", "Compare request timed out after 300s", "compare", "error", request_id=request_id)
        raise HTTPException(status_code=504, detail="Comparison timed out. Please try again.")

    return {
        "with_critic": with_critic,
        "without_critic": without_critic,
    }


@router.get("/memory/{patient_id}", response_model=MemoryResponse)
@limiter.limit("20/minute")
async def get_memory(patient_id: str, request: Request, user: dict = Depends(get_current_user)):
    """Retrieve patient visit history."""
    clinician_id = user["sub"]
    request_id = _request_id(request)
    history = await memory_store.get_history(patient_id, clinician_id=clinician_id)
    total_visits = await memory_store.get_visit_count(patient_id, clinician_id=clinician_id)
    agent_log(logger, "api", f"Memory lookup returned {len(history)} visits ({total_visits} total)", "memory", request_id=request_id)
    return MemoryResponse(
        patient_id=patient_id,
        visits=history,
        total_visits=total_visits,
    )
