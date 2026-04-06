"""Memory Agent — stores and retrieves patient history across sessions."""

import json
from datetime import datetime, timezone

from agents.base import BaseAgent
from graph.state import ClinicalState
from memory.long_term import LongTermMemory
from utils.logger import get_logger, agent_log

logger = get_logger()


class MemoryAgent(BaseAgent):
    name = "memory"
    description = "Stores and retrieves patient history"

    def __init__(self, **kwargs):
        super().__init__(**kwargs)
        self.memory = LongTermMemory()

    async def save_and_retrieve(self, state: ClinicalState) -> dict:
        """Async method — called directly by the workflow's memory_node."""
        self._log("Updating patient memory", "begin")

        patient_id = state.get("patient_id", "unknown")
        clinician_id = state.get("clinician_id", None)
        symptoms = state.get("symptoms", [])
        final_diagnosis = state.get("final_diagnosis", [])
        iterations = state.get("iterations", 1)

        visit_record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "symptoms": symptoms,
            "diagnoses": final_diagnosis,
            "iterations": iterations,
            "critic_score": state.get("critic_feedback", {}).get("score", 0),
        }

        try:
            await self.memory.save_visit(patient_id, visit_record, state, clinician_id=clinician_id)
        except Exception as e:
            agent_log(logger, "memory", f"Failed to save visit: {e}", "error", "error")

        history = state.get("patient_memory", [])
        total_visits = len(history)
        try:
            history = await self.memory.get_history(patient_id, clinician_id=clinician_id)
            total_visits = await self.memory.get_visit_count(patient_id, clinician_id=clinician_id)
        except Exception as e:
            agent_log(logger, "memory", f"Failed to retrieve history, using previous state: {e}", "error", "warning")

        self._log(f"Saved visit. Patient has {total_visits} total visits.", "complete")

        output = self._make_output({
            "visit_saved": visit_record,
            "total_visits": total_visits,
            "patient_history": history,
        })

        return {
            "patient_memory": history,
            "current_agent": "memory",
            "agent_outputs": [output],
        }

    def run(self, state: ClinicalState) -> dict:
        """Sync wrapper — workflow normally calls save_and_retrieve() directly."""
        import asyncio
        self._log("Sync run() called, delegating to save_and_retrieve()", "run")
        return asyncio.run(self.save_and_retrieve(state))
