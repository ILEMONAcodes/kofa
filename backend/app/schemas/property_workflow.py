"""Strict staff workflow bodies; identity and publication decisions are server-owned."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.schemas.auth import StrictModel
from app.schemas.submission import Price

Action = Literal[
    "start_review",
    "request_changes",
    "approve",
    "publish",
    "unpublish",
    "reject",
    "archive",
    "reopen",
]
CheckCode = Literal["identity", "ownership_docs", "location", "price", "features", "availability"]


class Versioned(StrictModel):
    version: int | None = Field(default=None, strict=True, ge=1)


class Transition(StrictModel):
    action: Action
    reason: str | None = Field(default=None, max_length=2000)
    version: int = Field(strict=True, ge=1)

    @field_validator("reason")
    @classmethod
    def trimmed(cls, value):
        return value.strip() or None if value else None


class CheckInput(StrictModel):
    code: CheckCode
    result: Literal["pass", "fail", "na"]
    note: str | None = Field(default=None, max_length=2000)
    evidence_document_id: UUID | None = None

    @model_validator(mode="after")
    def note_for_na(self):
        if self.result == "na" and not (self.note or "").strip():
            raise ValueError("Not-applicable checks need an explanatory note")
        return self


class VerificationInput(Versioned):
    method: Literal["desk_review", "physical_inspection", "both"]
    scope_summary: str = Field(min_length=1, max_length=2000)
    checks: list[CheckInput] = Field(max_length=6)

    @model_validator(mode="after")
    def unique_checks(self):
        if len({check.code for check in self.checks}) != len(self.checks):
            raise ValueError("Checklist codes must be unique")
        if not self.scope_summary.strip():
            raise ValueError("Describe the verification scope")
        return self


class Completion(Versioned):
    outcome: Literal["passed", "failed"]


class ApprovalInput(Versioned):
    approved_price: Price
    description_approved: Literal[True]
    method: Literal["phone", "whatsapp", "email", "in_person"]
    note: str | None = Field(default=None, max_length=2000)
    approved_at: datetime
