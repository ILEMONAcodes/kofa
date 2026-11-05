"""Separate private staff and owner-scoped client appointment shapes."""

from datetime import UTC, datetime
from typing import Literal
from uuid import UUID

from pydantic import Field, field_validator

from app.schemas.auth import Phone, StrictModel
from app.schemas.inquiry import Client, PropertyRef

Status = Literal[
    "proposed",
    "confirmed",
    "reschedule_requested",
    "completed",
    "cancelled_by_client",
    "cancelled_by_staff",
    "cancelled_by_landlord",
    "no_show",
]
Outcome = Literal["interested", "not_interested", "needs_follow_up"]


class Slot(StrictModel):
    staff_id: UUID
    scheduled_at: datetime
    duration_minutes: int = Field(45, strict=True, ge=15, le=240)
    meeting_instructions: str | None = Field(None, max_length=2000)
    landlord_rep_name: str | None = Field(None, min_length=2, max_length=150)
    landlord_rep_phone: Phone | None = None

    @field_validator("scheduled_at")
    @classmethod
    def timezone(cls, value):
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Include a timezone.")
        return value.astimezone(UTC)


class Create(Slot):
    inquiry_id: UUID
    version: int = Field(strict=True, ge=1)  # inquiry version at schedule time


class Version(StrictModel):
    version: int = Field(strict=True, ge=1)


class Reschedule(Slot, Version):
    reason: str = Field(min_length=1, max_length=2000)


class Reason(Version):
    reason: str = Field(min_length=1, max_length=2000)


class Cancel(Reason):
    cancelled_by: Literal["staff", "landlord"] = "staff"


class RequestReschedule(Reason):
    preferred_at: datetime | None = None

    @field_validator("preferred_at")
    @classmethod
    def timezone(cls, value):
        if value is None:
            return None
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("Include a timezone.")
        return value.astimezone(UTC)


class Result(Version):
    outcome: Outcome | None = None
    no_show: bool = Field(False, strict=True)
    notes: str | None = Field(None, max_length=4000)


class Fee(StrictModel):
    amount: Literal[0] = 0
    currency: Literal["NGN"] = "NGN"
    status: Literal["none"] = "none"
    disclosure: str = "No inspection fee applies to this appointment. No payment is required to confirm, reschedule or cancel."


class UtcOutput(StrictModel):
    @field_validator("*", mode="after")
    @classmethod
    def utc_dates(cls, value):
        if isinstance(value, datetime):
            return value.astimezone(UTC)
        return value


class SummaryClient(UtcOutput):
    id: UUID
    reference: str
    inquiry_id: UUID
    property: PropertyRef
    staff_name: str
    scheduled_at: datetime
    ends_at: datetime
    duration_minutes: int
    status: Status
    version: int
    fee: Fee
    allowed_actions: list[str]
    requested_scheduled_at: datetime | None
    outcome: Outcome | None
    created_at: datetime
    updated_at: datetime


class DetailClient(SummaryClient):
    meeting_address: str | None
    meeting_instructions: str | None


class History(UtcOutput):
    from_status: str | None
    to_status: str
    reason: str | None
    created_at: datetime


class DetailStaff(SummaryClient):
    confirmed_meeting_address: str | None
    client: Client
    staff_id: UUID
    address_line: str
    landlord_rep_name: str | None
    landlord_rep_phone: str | None
    meeting_instructions: str | None
    address_disclosed_at: datetime | None
    reschedule_reason: str | None
    cancellation_reason: str | None
    outcome_notes: str | None
    history: list[History]


class StaffMember(StrictModel):
    id: UUID
    full_name: str


class Options(StrictModel):
    staff: list[StaffMember]
    fee: Fee
