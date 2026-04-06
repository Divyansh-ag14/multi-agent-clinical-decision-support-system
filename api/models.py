"""Pydantic request/response models for the API."""

import re
from pydantic import BaseModel, Field, field_validator


# Patient ID must be alphanumeric, underscores, or hyphens (3-64 chars)
_PATIENT_ID_PATTERN = re.compile(r"^[a-zA-Z0-9_\-]{3,64}$")


class InterviewRequest(BaseModel):
    patient_id: str = Field(default="anonymous", description="Patient identifier")
    symptoms: list[str] = Field(..., min_length=1, max_length=30, description="List of symptoms")

    @field_validator("patient_id")
    @classmethod
    def validate_patient_id(cls, v: str) -> str:
        if not _PATIENT_ID_PATTERN.match(v):
            raise ValueError("patient_id must be 3-64 alphanumeric characters, underscores, or hyphens")
        return v

    @field_validator("symptoms")
    @classmethod
    def validate_symptoms(cls, v: list[str]) -> list[str]:
        cleaned = []
        for s in v:
            s = s.strip()
            if not s:
                continue
            if len(s) > 500:
                raise ValueError("Each symptom must be under 500 characters")
            cleaned.append(s)
        if not cleaned:
            raise ValueError("At least one non-empty symptom is required")
        return cleaned


class InterviewAnswer(BaseModel):
    question_id: str = Field(..., max_length=20, description="Question ID (e.g. q1)")
    question: str = Field(..., max_length=500, description="The question that was asked")
    answer: str = Field(..., max_length=2000, description="Patient's answer")


class DiagnoseRequest(BaseModel):
    patient_id: str = Field(default="anonymous", description="Patient identifier")
    symptoms: list[str] = Field(..., min_length=1, max_length=30, description="List of symptoms")
    critic_enabled: bool = Field(default=True, description="Enable critic agent")
    max_iterations: int = Field(default=3, ge=1, le=5, description="Max refinement iterations")
    critic_threshold: float = Field(default=0.3, ge=0.0, le=1.0, description="Critic score threshold for looping")
    interview_answers: list[InterviewAnswer] = Field(default=[], max_length=10, description="Patient answers to interview questions")

    @field_validator("patient_id")
    @classmethod
    def validate_patient_id(cls, v: str) -> str:
        if not _PATIENT_ID_PATTERN.match(v):
            raise ValueError("patient_id must be 3-64 alphanumeric characters, underscores, or hyphens")
        return v

    @field_validator("symptoms")
    @classmethod
    def validate_symptoms(cls, v: list[str]) -> list[str]:
        cleaned = []
        for s in v:
            s = s.strip()
            if not s:
                continue
            if len(s) > 500:
                raise ValueError("Each symptom must be under 500 characters")
            cleaned.append(s)
        if not cleaned:
            raise ValueError("At least one non-empty symptom is required")
        return cleaned


class MemoryResponse(BaseModel):
    patient_id: str
    visits: list[dict]
    total_visits: int
