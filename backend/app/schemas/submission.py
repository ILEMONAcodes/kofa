"""Strict incoming property details, separate from minimal public receipts."""

import re
from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, StringConstraints, field_validator, model_validator

from app.schemas.auth import Name, PolicyInput, StrictModel

Text120 = Annotated[str, StringConstraints(min_length=5, max_length=120)]
Relationship = Literal["owner", "authorized_agent", "developer", "property_manager"]
FileKind = Literal[
    "photo", "video", "ownership_proof", "authorization_letter", "id_document", "other"
]


class LandlordContact(StrictModel):
    full_name: Name
    phone: str
    email: EmailStr | None = Field(default=None, max_length=254)
    relationship: Relationship

    @field_validator("phone")
    @classmethod
    def normalize_phone(cls, value):
        value = re.sub(r"[\s()\-]", "", value)
        if re.fullmatch(r"0\d{10}", value):
            value = "+234" + value[1:]
        if not re.fullmatch(r"\+[1-9]\d{7,14}", value):
            raise ValueError("Use an E.164 phone number")
        return value


class Price(StrictModel):
    amount: int = Field(strict=True, ge=100000, le=9223372036854775807)
    currency: Literal["NGN"]
    period: Literal["year", "month", "one_time"]


class ExtraCharge(StrictModel):
    label: str = Field(min_length=1, max_length=100)
    amount: int = Field(strict=True, ge=0, le=9223372036854775807)
    currency: Literal["NGN"]


class PropertyInput(StrictModel):
    title: Text120
    description: str = Field(min_length=20, max_length=5000)
    listing_type: Literal["rent", "sale"]
    property_type: Literal["apartment", "house", "duplex", "bungalow", "terrace", "studio", "room"]
    intended_use: Literal["residential"] = "residential"
    area_id: UUID
    address_line: str = Field(min_length=5, max_length=500)
    address_hint: str | None = Field(default=None, max_length=160)
    price: Price
    price_negotiable: bool = False
    payment_terms: str | None = Field(default=None, max_length=1000)
    extra_charges: list[ExtraCharge] = Field(default_factory=list, max_length=10)
    bedrooms: int = Field(strict=True, ge=0, le=20)
    bathrooms: int = Field(strict=True, ge=0, le=20)
    furnishing: Literal["furnished", "semi_furnished", "unfurnished"]
    amenity_codes: list[Annotated[str, StringConstraints(min_length=1, max_length=40)]] = Field(
        default_factory=list, max_length=50
    )
    availability_status: Literal["available", "under_offer", "unavailable"] = "available"
    landlord_conditions: str | None = Field(default=None, max_length=2000)

    @model_validator(mode="after")
    def coherent_price(self):
        if (self.listing_type == "sale") != (self.price.period == "one_time"):
            raise ValueError("Rent requires month/year; sale requires one_time")
        if len(self.amenity_codes) != len(set(self.amenity_codes)):
            raise ValueError("Amenities must be unique")
        return self


class SubmissionCreate(StrictModel):
    landlord: LandlordContact
    property: PropertyInput
    accepted_policies: list[PolicyInput] = Field(min_length=2, max_length=2)


class DraftReceipt(BaseModel):
    id: UUID
    status: Literal["draft"]
    upload_token: str
    upload_token_expires_at: datetime


class DraftEnvelope(BaseModel):
    data: DraftReceipt


class UploadReceipt(BaseModel):
    file_id: UUID
    kind: FileKind
    size_bytes: int
    status: Literal["uploaded"]


class UploadEnvelope(BaseModel):
    data: UploadReceipt


class SubmissionReceipt(BaseModel):
    id: UUID
    status: Literal["submitted"]
    reference: str


class SubmissionEnvelope(BaseModel):
    data: SubmissionReceipt
