"""Base agent class with shared LLM and logging infrastructure."""

import time
from abc import ABC, abstractmethod
from datetime import datetime, timezone

from langchain_openai import ChatOpenAI

import config
from graph.state import ClinicalState
from utils.logger import get_logger, agent_log


logger = get_logger()


class BaseAgent(ABC):
    """Base class for all clinical agents."""

    name: str = "base_agent"
    description: str = "Base agent"

    def __init__(self, model: str | None = None, temperature: float | None = None):
        self.llm = ChatOpenAI(
            model=model or config.LLM_MODEL,
            temperature=temperature if temperature is not None else config.LLM_TEMPERATURE,
            request_timeout=config.LLM_TIMEOUT,
        )

    @abstractmethod
    def run(self, state: ClinicalState) -> dict:
        """Execute agent logic and return partial state update."""
        ...

    def _log(self, message: str, step: str = ""):
        agent_log(logger, self.name, message, step)

    def _make_output(self, output_data: dict) -> dict:
        """Create a standardized agent output entry for streaming."""
        return {
            "agent": self.name,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "output": output_data,
        }

    def _parse_json_response(self, response_content: str, fallback: dict) -> dict:
        """Safely parse JSON from LLM response with fallback."""
        import json

        # Try direct parse first
        try:
            return json.loads(response_content)
        except json.JSONDecodeError:
            pass

        # Try extracting JSON from markdown code blocks or surrounding text
        content = response_content
        start = content.find("{")
        end = content.rfind("}") + 1
        if start != -1 and end > start:
            try:
                return json.loads(content[start:end])
            except json.JSONDecodeError:
                pass

        # All parsing failed — log and return fallback
        self._log(f"Failed to parse JSON from LLM response ({len(content)} chars), using fallback", "warning")
        return fallback

    def _timed_invoke(self, messages: list) -> str:
        """Invoke LLM with timing instrumentation and retry on transient errors."""
        max_retries = config.LLM_MAX_RETRIES
        last_err: Exception | None = None

        for attempt in range(1, max_retries + 1):
            try:
                t0 = time.time()
                response = self.llm.invoke(messages)
                elapsed = time.time() - t0
                self._log(f"LLM call completed in {elapsed:.1f}s", "llm")
                return response.content
            except Exception as e:
                last_err = e
                elapsed = time.time() - t0
                if attempt < max_retries:
                    wait = 2 ** attempt
                    self._log(
                        f"LLM call failed after {elapsed:.1f}s (attempt {attempt}/{max_retries}): {e}. "
                        f"Retrying in {wait}s...",
                        "retry",
                    )
                    time.sleep(wait)
                else:
                    self._log(
                        f"LLM call failed after {elapsed:.1f}s (attempt {attempt}/{max_retries}): {e}. "
                        f"No retries left.",
                        "error",
                    )

        raise RuntimeError(
            f"[{self.name}] LLM call failed after {max_retries} attempts: {last_err}"
        ) from last_err
