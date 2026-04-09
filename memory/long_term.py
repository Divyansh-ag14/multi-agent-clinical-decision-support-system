"""Long-term patient memory using Supabase PostgreSQL."""

import asyncio
import json

from supabase import create_client, Client

import config
from utils.logger import get_logger, agent_log

logger = get_logger()


class LongTermMemory:
    """Persistent patient memory stored in Supabase PostgreSQL."""

    def __init__(self):
        self._client: Client = create_client(
            config.SUPABASE_URL,
            config.SUPABASE_SERVICE_ROLE_KEY,
        )

    async def init_db(self):
        """No-op — table is managed via Supabase SQL migration."""
        agent_log(logger, "memory", "Supabase memory ready", "init")

    async def save_visit(
        self,
        patient_id: str,
        visit_record: dict,
        full_state: dict = None,
        clinician_id: str = None,
    ):
        """Save a patient visit to Supabase."""
        try:
            diagnoses = visit_record.get("diagnoses", [])
            top_confidence = diagnoses[0].get("confidence", 0) if diagnoses else 0

            serializable_state = None
            if full_state:
                serializable_state = {
                    "symptoms": full_state.get("symptoms", []),
                    "hypotheses": full_state.get("hypotheses", []),
                    "evidence": full_state.get("evidence", []),
                    "critic_feedback": full_state.get("critic_feedback", {}),
                    "final_diagnosis": full_state.get("final_diagnosis", []),
                    "clinical_summary": full_state.get("clinical_summary", ""),
                    "caveats": full_state.get("caveats", []),
                    "iterations": full_state.get("iterations", 0),
                }

            row = {
                "patient_id": patient_id,
                "timestamp": visit_record.get("timestamp", ""),
                "symptoms": visit_record.get("symptoms", []),
                "diagnoses": diagnoses,
                "confidence": top_confidence if isinstance(top_confidence, (int, float)) else 0,
                "iterations": visit_record.get("iterations", 0),
                "critic_score": visit_record.get("critic_score", 0),
                "full_state": serializable_state,
            }
            if clinician_id:
                row["clinician_id"] = clinician_id

            def _insert():
                return self._client.table("visits").insert(row).execute()

            await asyncio.to_thread(_insert)
            agent_log(logger, "memory", f"Saved visit for {patient_id}", "save")
        except Exception as e:
            agent_log(logger, "memory", f"Supabase save error: {e}", "save", "error")
            raise

    async def get_history(
        self,
        patient_id: str,
        clinician_id: str = None,
        limit: int = 20,
    ) -> list[dict]:
        """Retrieve recent visit history for a patient."""
        try:
            def _query():
                q = self._client.table("visits").select(
                    "id, patient_id, timestamp, symptoms, diagnoses, "
                    "confidence, iterations, critic_score, created_at"
                )
                if clinician_id:
                    q = q.eq("clinician_id", clinician_id)
                q = q.eq("patient_id", patient_id)
                q = q.order("created_at", desc=True)
                q = q.limit(limit)
                return q.execute()

            result = await asyncio.to_thread(_query)

            history = []
            for row in result.data:
                history.append({
                    "id": row["id"],
                    "patient_id": row["patient_id"],
                    "timestamp": row["timestamp"],
                    "symptoms": row["symptoms"] if isinstance(row["symptoms"], list) else [],
                    "diagnoses": row["diagnoses"] if isinstance(row["diagnoses"], list) else [],
                    "confidence": row["confidence"],
                    "iterations": row["iterations"],
                    "critic_score": row["critic_score"],
                })
            agent_log(
                logger, "memory",
                f"Loaded {len(history)} visits for {patient_id} (limit={limit})",
                "get_history",
            )
            return history
        except Exception as e:
            agent_log(logger, "memory", f"Supabase read error: {e}", "get_history", "error")
            raise

    async def get_visit_count(
        self,
        patient_id: str,
        clinician_id: str = None,
    ) -> int:
        """Retrieve the total number of stored visits for a patient."""
        try:
            def _query():
                q = self._client.table("visits").select("id", count="exact")
                if clinician_id:
                    q = q.eq("clinician_id", clinician_id)
                q = q.eq("patient_id", patient_id)
                return q.execute()

            result = await asyncio.to_thread(_query)
            total = result.count or 0
            agent_log(logger, "memory", f"Counted {total} visits for {patient_id}", "get_visit_count")
            return total
        except Exception as e:
            agent_log(logger, "memory", f"Supabase count error: {e}", "get_visit_count", "error")
            raise
