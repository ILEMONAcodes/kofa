from datetime import date, datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.schemas.auth import StrictModel
from app.schemas.knowledge import PublicSupport
from app.schemas.property_admin import PageMeta

Reason = Literal[
    "out_of_scope",
    "low_confidence",
    "user_requested",
    "sensitive_topic",
    "repeated_failure",
    "service_unavailable",
]


class MessageInput(StrictModel):
    content: str = Field(min_length=1, max_length=1000)

    @field_validator("content")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Enter a question")
        return value.strip()


class HandoffInput(StrictModel):
    summary: str | None = Field(None, max_length=500)


class FeedbackInput(StrictModel):
    helpful: bool = Field(strict=True)
    comment: str = Field(default="", max_length=500)


class ReviewInput(StrictModel):
    version: int = Field(strict=True, ge=1)
    flagged: bool = Field(strict=True)
    review_note: str = Field(default="", max_length=2000)


class Source(BaseModel):
    type: Literal["article", "property"]
    id: str
    title: str
    url: str


class Message(BaseModel):
    id: UUID
    role: Literal["user", "assistant"]
    content: str
    created_at: datetime
    sources: list[Source]


class Option(BaseModel):
    type: Literal["call", "message_team", "report_listing"]
    phone: str | None = None
    display_phone: str | None = None
    hours_text: str | None = None
    is_open_now: bool | None = None
    requires_login: bool | None = None
    url: str | None = None


class Handoff(BaseModel):
    required: Literal[True] = True
    reason: Reason
    message: str
    options: list[Option]


class Start(BaseModel):
    id: UUID
    token: str | None = None
    greeting: str
    disclosure: str
    support: PublicSupport


class StartEnvelope(BaseModel):
    data: Start


class Turn(BaseModel):
    message: Message
    handoff: Handoff | None


class TurnEnvelope(BaseModel):
    data: Turn


class History(BaseModel):
    id: UUID
    status: str
    messages: list[Message]
    handoff: Handoff | None
    inquiry_id: UUID | None


class HistoryEnvelope(BaseModel):
    data: History


class HandoffReceipt(BaseModel):
    inquiry_id: UUID


class HandoffEnvelope(BaseModel):
    data: HandoffReceipt


class FeedbackReceipt(BaseModel):
    recorded: bool = True


class FeedbackEnvelope(BaseModel):
    data: FeedbackReceipt


class ReviewSummary(BaseModel):
    id: UUID
    status: str
    handoff_reason: Reason | None
    flagged: bool
    version: int
    created_at: datetime
    updated_at: datetime


class ReviewDetail(ReviewSummary):
    messages: list[Message]
    review_note: str
    inquiry_id: UUID | None


class ReviewEnvelope(BaseModel):
    data: ReviewDetail


class ReviewPage(BaseModel):
    data: list[ReviewSummary]
    meta: PageMeta


class Usage(BaseModel):
    day: date
    timezone: Literal["Africa/Lagos"] = "Africa/Lagos"
    enabled: bool
    provider_ready: bool
    provider: str
    model: str
    token_limit: int
    request_limit: int
    reserved_tokens: int
    requests: int
    tokens_in: int
    tokens_out: int
    unknown_usage_requests: int
    remaining_tokens: int
    remaining_requests: int


class UsageEnvelope(BaseModel):
    data: Usage
