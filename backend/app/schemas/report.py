"""Aggregate-only output. No entity or reporter DTO is exposed."""

from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, Field


class Period(BaseModel):
    from_date: date | None
    to_date: date | None
    timezone: Literal["Africa/Lagos"] = "Africa/Lagos"


class Counts(BaseModel):
    listings_awaiting_review: int = Field(ge=0)
    open_inquiries: int = Field(ge=0)
    upcoming_inspections: int = Field(ge=0)
    active_complaints: int = Field(ge=0)


class Dashboard(BaseModel):
    as_of: datetime
    period: Period
    counts: Counts


class Envelope(BaseModel):
    data: Dashboard
