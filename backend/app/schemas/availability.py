from datetime import datetime
from uuid import UUID

from pydantic import BaseModel

from app.schemas.property_admin import Availability, PageMeta


class AvailabilityQueueItem(BaseModel):
    id: UUID
    title: str
    listing_type: str
    availability_status: Availability
    last_confirmed_at: datetime | None
    version: int
    assigned_staff: str | None


class AvailabilityQueueMeta(PageMeta):
    threshold_days: int
    as_of: datetime


class AvailabilityQueue(BaseModel):
    data: list[AvailabilityQueueItem]
    meta: AvailabilityQueueMeta


class AvailabilityConfirmation(BaseModel):
    id: UUID
    recorded_at: datetime
    confirmed_at: str | None
    actor_name: str | None
    availability_status: str | None
    outcome: str | None
    note: str | None


class AvailabilityHistory(BaseModel):
    data: list[AvailabilityConfirmation]
