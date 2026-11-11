"""Staff-only inputs and explicit outputs. Never use these DTOs on public endpoints."""

from datetime import datetime
from decimal import Decimal
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator

from app.schemas.auth import StrictModel
from app.schemas.submission import ExtraCharge, Price, Relationship

PropertyStatus = Literal[
    "draft",
    "submitted",
    "in_review",
    "changes_requested",
    "approved",
    "published",
    "unpublished",
    "rejected",
    "archived",
]
Availability = Literal["available", "under_offer", "unavailable"]


class PropertyPatch(StrictModel):
    version: int = Field(strict=True, ge=1)
    title: str | None = Field(default=None, min_length=5, max_length=120)
    description: str | None = Field(default=None, min_length=20, max_length=5000)
    listing_type: Literal["rent", "sale"] | None = None
    property_type: (
        Literal["apartment", "house", "duplex", "bungalow", "terrace", "studio", "room"] | None
    ) = None
    intended_use: Literal["residential"] | None = None
    area_id: UUID | None = None
    relationship: Relationship | None = None
    address_line: str | None = Field(default=None, min_length=5, max_length=500)
    address_hint: str | None = Field(default=None, max_length=160)
    latitude: Decimal | None = Field(default=None, ge=-90, le=90)
    longitude: Decimal | None = Field(default=None, ge=-180, le=180)
    price: Price | None = None
    price_negotiable: bool | None = None
    payment_terms: str | None = Field(default=None, max_length=1000)
    extra_charges: list[ExtraCharge] | None = Field(default=None, max_length=10)
    bedrooms: int | None = Field(default=None, strict=True, ge=0, le=20)
    bathrooms: int | None = Field(default=None, strict=True, ge=0, le=20)
    furnishing: Literal["furnished", "semi_furnished", "unfurnished"] | None = None
    amenity_codes: list[str] | None = Field(default=None, max_length=50)
    landlord_conditions: str | None = Field(default=None, max_length=2000)

    @field_validator(
        "address_hint",
        "latitude",
        "longitude",
        "payment_terms",
        "landlord_conditions",
        mode="before",
    )
    @classmethod
    def empty_to_null(cls, value):
        return None if isinstance(value, str) and not value.strip() else value

    @model_validator(mode="after")
    def supplied(self):
        if self.model_fields_set == {"version"}:
            raise ValueError("Provide a change")
        nullable = {"address_hint", "latitude", "longitude", "payment_terms", "landlord_conditions"}
        for name in self.model_fields_set - {"version"} - nullable:
            if getattr(self, name) is None:
                raise ValueError("This field cannot be null")
        return self


class Assignment(StrictModel):
    staff_id: UUID | None
    version: int | None = Field(default=None, strict=True, ge=1)

    @field_validator("staff_id", mode="before")
    @classmethod
    def empty_to_null(cls, value):
        return None if isinstance(value, str) and not value.strip() else value


class AvailabilityInput(StrictModel):
    availability_status: Availability | None = None
    outcome: (
        Literal["available", "under_offer", "unavailable", "let", "sold", "withdrawn"] | None
    ) = None
    note: str | None = Field(default=None, max_length=1000)
    confirmed_at: datetime | None = None
    version: int | None = Field(default=None, strict=True, ge=1)

    @model_validator(mode="after")
    def supplied_availability(self):
        if self.availability_status is None and self.outcome is None:
            raise ValueError("Choose an availability status or confirmation outcome")
        return self


class MediaPatch(StrictModel):
    alt: str | None = Field(default=None, max_length=200)
    position: int | None = Field(default=None, strict=True, ge=0)
    is_cover: bool | None = None
    version: int | None = Field(default=None, strict=True, ge=1)

    @field_validator("alt", mode="before")
    @classmethod
    def empty_to_null(cls, value):
        return None if isinstance(value, str) and not value.strip() else value

    @model_validator(mode="after")
    def supplied(self):
        if not self.model_fields_set - {"version"}:
            raise ValueError("Provide a change")
        if ("position" in self.model_fields_set and self.position is None) or (
            "is_cover" in self.model_fields_set and self.is_cover is None
        ):
            raise ValueError("Provide a value")
        return self


class StaffRef(BaseModel):
    id: UUID
    full_name: str


class Location(BaseModel):
    state: str
    city: str
    neighbourhood: str
    address_hint: str | None


class ImageOut(BaseModel):
    url: str
    thumb_url: str | None
    alt: str | None


class AdminPropertySummary(BaseModel):
    id: UUID
    slug: str
    title: str
    listing_type: str
    property_type: str
    price: Price
    location: Location
    bedrooms: int
    bathrooms: int
    furnishing: str
    availability_status: Availability
    is_verified: bool
    verified_at: datetime | None
    cover_image: ImageOut | None
    published_at: datetime | None
    status: PropertyStatus
    landlord_id: UUID
    assigned_staff: StaffRef | None
    submitted_at: datetime | None
    updated_at: datetime
    version: int
    submission_reference: str | None


class LandlordOut(BaseModel):
    id: UUID
    full_name: str
    phone: str
    email: str | None
    identity_verified_at: datetime | None
    blocked_at: datetime | None
    blocked_reason: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


class PropertyLandlord(LandlordOut):
    relationship: Relationship


class DocumentOut(BaseModel):
    id: UUID
    kind: str
    signed_url: str
    expires_at: datetime
    review_note: str | None


class MediaOut(ImageOut):
    id: UUID
    kind: str
    position: int
    is_cover: bool


class CheckOut(BaseModel):
    code: str
    result: str
    note: str | None
    evidence_document_id: UUID | None


class VerificationOut(BaseModel):
    id: UUID
    status: str
    method: str
    scope_summary: str | None
    verified_by: UUID
    verified_at: datetime | None
    is_current: bool
    checks: list[CheckOut]


class ApprovalOut(BaseModel):
    id: UUID
    approved_price: Price
    description_approved: bool
    method: str
    note: str | None
    recorded_by: UUID
    approved_at: datetime


class StatusOut(BaseModel):
    from_status: str | None
    to_status: str
    actor_user_id: UUID | None
    reason: str | None
    created_at: datetime


class AmenityOut(BaseModel):
    code: str
    label: str


class ApproximateLocation(BaseModel):
    lat: float
    lng: float
    radius_m: int = 500


class VerificationSummary(BaseModel):
    status: str
    verified_at: datetime | None
    method: str
    scope: list[str]
    disclaimer: str = (
        "Verification confirms the checks listed. It is not a guarantee of legal title."
    )


class AdminPropertyDetail(AdminPropertySummary):
    allowed_actions: list[str]
    allowed_workflows: list[str]
    publication_blockers: list[str]
    description: str
    intended_use: str
    area_id: UUID
    payment_terms: str | None
    price_negotiable: bool
    extra_charges: list[ExtraCharge]
    amenities: list[AmenityOut]
    media: list[MediaOut]
    approximate_location: ApproximateLocation | None
    verification: VerificationSummary | None
    last_availability_confirmed_at: datetime | None
    landlord: PropertyLandlord
    address_line: str
    latitude: float | None
    longitude: float | None
    landlord_conditions: str | None
    documents: list[DocumentOut]
    verification_history: list[VerificationOut]
    landlord_approval: ApprovalOut | None
    status_history: list[StatusOut]


class MutationOut(BaseModel):
    id: UUID
    status: PropertyStatus
    version: int
    approval_invalidated: bool = False
    assigned_staff_id: UUID | None
    availability_status: Availability
    last_availability_confirmed_at: datetime | None


class PageMeta(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class PropertyPage(BaseModel):
    data: list[AdminPropertySummary]
    meta: PageMeta


class DetailEnvelope(BaseModel):
    data: AdminPropertyDetail


class MutationEnvelope(BaseModel):
    data: MutationOut


class LandlordPage(BaseModel):
    data: list[LandlordOut]
    meta: PageMeta


class LandlordDetail(LandlordOut):
    properties: list[AdminPropertySummary]


class LandlordEnvelope(BaseModel):
    data: LandlordDetail


class AreaOption(BaseModel):
    id: UUID
    slug: str
    state: str
    city: str
    neighbourhood: str


class PropertyOptions(BaseModel):
    areas: list[AreaOption]
    amenities: list[AmenityOut]
    staff: list[StaffRef]


class OptionsEnvelope(BaseModel):
    data: PropertyOptions
