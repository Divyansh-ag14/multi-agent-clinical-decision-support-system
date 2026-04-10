"""Structured logging for the clinical decision support system."""

from __future__ import annotations

import contextvars
import logging
import os
import sys
from datetime import datetime, timezone
from logging.handlers import RotatingFileHandler

import config


os.makedirs(config.LOG_DIR, exist_ok=True)
_request_id_var: contextvars.ContextVar[str] = contextvars.ContextVar("request_id", default="")


def set_request_id(request_id: str) -> None:
    _request_id_var.set(request_id or "")


def get_request_id() -> str:
    return _request_id_var.get("")


def clear_request_id() -> None:
    _request_id_var.set("")


class AgentFormatter(logging.Formatter):
    """Custom formatter that includes component, agent, and request context."""

    COLORS = {
        "DEBUG": "\033[36m",
        "INFO": "\033[32m",
        "WARNING": "\033[33m",
        "ERROR": "\033[31m",
        "CRITICAL": "\033[31m",
        "RESET": "\033[0m",
    }

    def __init__(self, use_color: bool = True):
        super().__init__()
        self.use_color = use_color

    def format(self, record):
        color = self.COLORS.get(record.levelname, "") if self.use_color else ""
        reset = self.COLORS["RESET"] if self.use_color else ""
        agent = getattr(record, "agent", "system")
        component = getattr(record, "component", record.name)
        step = getattr(record, "step", "")
        request_id = getattr(record, "request_id", "") or get_request_id()
        timestamp = datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S.%f")[:-3]

        step_str = f" [{step}]" if step else ""
        req_str = f" req={request_id}" if request_id else ""
        return (
            f"{color}{timestamp} | {record.levelname:<8} | "
            f"{component:<14} | {agent:<15}{step_str}{req_str} | "
            f"{record.getMessage()}{reset}"
        )


def get_logger(name: str = "clinical_system") -> logging.Logger:
    """Get a configured logger instance with console and rotating file handlers."""
    logger = logging.getLogger(name)

    if logger.handlers:
        return logger

    logger.propagate = False
    logger.setLevel(getattr(logging, config.LOG_LEVEL.upper(), logging.DEBUG))

    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(AgentFormatter(use_color=True))
    logger.addHandler(console_handler)

    file_handler = RotatingFileHandler(
        config.LOG_FILE,
        mode="a",
        maxBytes=config.LOG_MAX_BYTES,
        backupCount=config.LOG_BACKUP_COUNT,
        encoding="utf-8",
    )
    file_handler.setFormatter(AgentFormatter(use_color=False))
    logger.addHandler(file_handler)

    return logger


def agent_log(
    logger: logging.Logger,
    agent: str,
    message: str,
    step: str = "",
    level: str = "info",
    request_id: str = "",
):
    """Log a message with agent context and optional request ID."""
    extra = {
        "agent": agent,
        "step": step,
        "request_id": request_id,
        "component": logger.name,
    }
    getattr(logger, level)(message, extra=extra)
