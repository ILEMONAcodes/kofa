import re
from datetime import date, datetime
from html.parser import HTMLParser
from typing import Literal
from uuid import UUID
from zoneinfo import ZoneInfo

from pydantic import EmailStr, Field, field_validator, model_validator
from pydantic_core import PydanticCustomError

from app.schemas.appointment import UtcOutput
from app.schemas.auth import StrictModel

Kind = Literal["suspicious_listing", "dispute", "service_complaint", "other"]
Status = Literal["new", "triage", "investigating", "resolved", "dismissed"]
Reason = Literal[
    "fake_listing",
    "wrong_price",
    "misleading_description",
    "already_let_or_sold",
    "unauthorised_agent",
    "asked_to_pay_outside",
    "other",
]
Outcome = Literal["substantiated", "partially_substantiated", "unsubstantiated", "inconclusive"]
CaseAction = Literal[
    "listing_corrected",
    "listing_unpublished",
    "listing_rejected",
    "landlord_warned",
    "landlord_blocked",
    "client_warned",
    "no_action",
]
Action = Literal[
    "start_triage",
    "start_investigation",
    "resolve",
    "dismiss",
    "reopen",
    "place_hold",
    "release_hold",
]
Dismiss = Literal["duplicate", "spam_or_abuse", "out_of_scope", "insufficient_information"]


class Plain(HTMLParser):
    def __init__(self):
        super().__init__()
        self.parts = []

    def handle_data(self, data):
        self.parts.append(data)


def clean(value):
    if not isinstance(value, str):
        return value
    p = Plain()
    p.feed(value)
    value = "".join(p.parts).strip()
    if re.search(r"(?<!\d)(?:\d[ -]?){12,18}\d(?!\d)", value):
        raise PydanticCustomError(
            "sensitive_data", "Remove card, bank or identity-document numbers."
        )
    return value


class TextInput(StrictModel):
    @field_validator("*", mode="before")
    @classmethod
    def plain(cls, v, info):
        return v if info.field_name in {"phone", "email", "property_slug"} else clean(v)


class Reporter(TextInput):
    name: str | None = Field(default=None, min_length=2, max_length=150)
    email: EmailStr | None = None
    phone: str | None = Field(default=None, pattern=r"^\+[1-9]\d{7,14}$")


class Report(TextInput):
    property_slug: str = Field(min_length=1, max_length=200)
    reason: Reason
    description: str = Field(min_length=20, max_length=2000)
    reporter: Reporter = Field(default_factory=Reporter)
    website: str = Field(default="", max_length=500)


class Subject(StrictModel):
    type: Literal["general", "property", "appointment"]
    id: UUID | None = None

    @model_validator(mode="after")
    def subject(self):
        if (self.type == "general") != (self.id is None):
            raise ValueError("Choose a valid subject.")
        return self


class Create(TextInput):
    kind: Literal["dispute", "service_complaint", "other"]
    subject: Subject
    description: str = Field(min_length=20, max_length=4000)
    occurred_on: date | None = None
    desired_outcome: str | None = Field(default=None, max_length=500)

    @field_validator("occurred_on")
    @classmethod
    def past(cls, v):
        if v and v > datetime.now(ZoneInfo("Africa/Lagos")).date():
            raise ValueError("Choose today or an earlier date.")
        return v


class Version(StrictModel):
    version: int = Field(ge=1, strict=True)


class Assign(Version):
    staff_id: UUID


class Transition(Version, TextInput):
    action: Action
    reason: str | None = Field(default=None, max_length=2000)
    dismiss_reason: Dismiss | None = None


class Investigation(Version, TextInput):
    findings: str = Field(min_length=1, max_length=8000)
    evidence_reviewed: str = Field(min_length=1, max_length=4000)
    outcome: Outcome
    actions: list[CaseAction] = Field(min_length=1, max_length=7)
    public_note: str | None = Field(default=None, max_length=1000)

    @field_validator("actions")
    @classmethod
    def unique(cls, v):
        if len(set(v)) != len(v) or ("no_action" in v and len(v) > 1):
            raise ValueError("Choose distinct compatible actions.")
        return v


class CaseSummary(UtcOutput):
    id: UUID
    reference: str
    kind: Kind
    status: Status
    created_at: datetime
    public_note: str | None


class Receipt(UtcOutput):
    id: UUID
    reference: str
    status: Literal["new"] = "new"
    upload_token: str
    upload_token_expires_at: datetime
    message: str


class Evidence(StrictModel):
    id: UUID
    mime_type: str
    size_bytes: int


class Event(UtcOutput):
    from_status: str | None
    to_status: str
    note: str
    created_at: datetime


class ReporterOut(StrictModel):
    name: str | None
    email: str | None
    phone: str | None


class StaffDetail(CaseSummary):
    reason: Reason | None
    description: str
    reporter: ReporterOut
    reporter_user_id: UUID | None
    property_id: UUID | None
    appointment_id: UUID | None
    occurred_on: date | None
    desired_outcome: str | None
    assigned_staff_id: UUID | None
    findings: str | None
    evidence_reviewed: str | None
    outcome: Outcome | None
    actions: list[CaseAction]
    dismiss_reason: Dismiss | None
    hold_review_due_at: datetime | None
    version: int
    other_open_reports: int
    evidence: list[Evidence]
    events: list[Event]
    allowed_actions: list[Action]
    allowed_case_actions: list[CaseAction]
