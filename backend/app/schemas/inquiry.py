from datetime import date, datetime
from typing import Generic, Literal, TypeVar
from uuid import UUID

from pydantic import Field, field_validator, model_validator

from app.schemas.auth import StrictModel

Status = Literal[
    "new",
    "in_progress",
    "qualified",
    "inspection_scheduled",
    "negotiating",
    "closed_won",
    "closed_lost",
    "spam",
]
Kind = Literal["property_interest", "inspection_request", "general"]


class Qualification(StrictModel):
    budget_min: int | None = Field(None, strict=True, ge=0, le=9000000000000000)
    budget_max: int | None = Field(None, strict=True, ge=0, le=9000000000000000)
    desired_move_in: date | None = None

    @model_validator(mode="after")
    def budgets(self):
        if (
            self.budget_min is not None
            and self.budget_max is not None
            and self.budget_min > self.budget_max
        ):
            raise ValueError("Minimum budget must not exceed maximum.")
        return self


class TextInput(StrictModel):
    body: str = Field(min_length=1, max_length=4000)

    @field_validator("body")
    @classmethod
    def nonblank(cls, value):
        if not value.strip():
            raise ValueError("Enter a message.")
        return value.strip()


class Create(Qualification, TextInput):
    kind: Kind
    property_id: UUID | None = None

    @model_validator(mode="after")
    def target(self):
        if (self.kind == "general") != (self.property_id is None):
            raise ValueError("Choose a property for this inquiry.")
        return self


class Version(StrictModel):
    version: int = Field(strict=True, ge=1)


class Qualify(Qualification, Version):
    pass


class Assign(Version):
    assigned_staff_id: UUID | None


class Transition(Version):
    action: Literal["start", "qualify", "negotiate", "close_won", "close_lost", "mark_spam"]
    reason: str | None = Field(None, max_length=2000)


class ClientPatch(Version):
    is_active: bool = Field(strict=True)


class Receipt(StrictModel):
    id: UUID
    reference: str
    status: Literal["new"] = "new"


class PropertyRef(StrictModel):
    id: UUID
    slug: str | None
    title: str


class Summary(StrictModel):
    unread_count: int
    id: UUID
    reference: str
    kind: Kind
    status: Status
    property: PropertyRef | None
    budget_min: int | None
    budget_max: int | None
    desired_move_in: date | None
    created_at: datetime
    updated_at: datetime
    last_client_message_at: datetime | None
    last_staff_message_at: datetime | None


class Message(StrictModel):
    id: UUID
    body: str
    sender_role: Literal["client", "staff"]
    created_at: datetime


class Note(StrictModel):
    id: UUID
    body: str
    created_at: datetime


class Client(StrictModel):
    id: UUID
    full_name: str
    email: str
    phone: str | None
    is_active: bool
    version: int
    created_at: datetime


class StaffRef(StrictModel):
    id: UUID
    full_name: str


class History(StrictModel):
    from_status: str | None
    to_status: str
    reason: str | None
    created_at: datetime


class Detail(Summary):
    client: Client
    assigned_staff: StaffRef | None
    version: int
    closed_reason: str | None
    allowed_actions: list[str]
    history: list[History]


class Mutation(StrictModel):
    id: UUID
    version: int
    status: Status


class ClientDetail(Client):
    inquiries: list[Summary]
    inquiry_count: int


T = TypeVar("T")


class Envelope(StrictModel, Generic[T]):  # noqa: UP046
    data: T


class Meta(StrictModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class Page(Envelope[list[T]], Generic[T]):  # noqa: UP046
    meta: Meta


class ReadInput(StrictModel):
    through_message_id: UUID


class ReadReceipt(StrictModel):
    unread_count: int
