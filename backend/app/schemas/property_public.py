"""Explicit public projections. Never inherit private/admin property DTOs."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.schemas.auth import StrictModel
from app.schemas.submission import ExtraCharge, Price


class LocationPublic(BaseModel):
    state: str
    city: str
    neighbourhood: str
    address_hint: str | None


class ImagePublic(BaseModel):
    url: str
    thumb_url: str | None
    alt: str | None


class PropertySummaryPublic(BaseModel):
    id: UUID
    slug: str
    title: str
    listing_type: str
    property_type: str
    price: Price
    location: LocationPublic
    bedrooms: int
    bathrooms: int
    furnishing: str
    availability_status: str
    is_verified: bool
    verified_at: datetime | None
    cover_image: ImagePublic | None
    published_at: datetime | None


class MediaPublic(ImagePublic):
    id: UUID
    kind: str
    position: int


class AmenityPublic(BaseModel):
    code: str
    label: str


class VerificationPublic(BaseModel):
    status: str
    verified_at: datetime | None
    method: str
    scope: list[str]
    disclaimer: str = (
        "Verification confirms the checks listed. It is not a guarantee of legal title."
    )


class ApproximatePublic(BaseModel):
    lat: float
    lng: float
    radius_m: int = 1000


class PropertyDetailPublic(PropertySummaryPublic):
    description: str
    payment_terms: str | None
    price_negotiable: bool
    extra_charges: list[ExtraCharge]
    amenities: list[AmenityPublic]
    media: list[MediaPublic]
    approximate_location: ApproximatePublic | None
    verification: VerificationPublic | None
    last_availability_confirmed_at: datetime | None


class PageMetaPublic(BaseModel):
    page: int
    page_size: int
    total_items: int
    total_pages: int


class PropertyPagePublic(BaseModel):
    data: list[PropertySummaryPublic]
    meta: PageMetaPublic


class DetailEnvelopePublic(BaseModel):
    data: PropertyDetailPublic


class AreaPublic(BaseModel):
    id: UUID
    state: str
    city: str
    neighbourhood: str
    slug: str


class TaxonomyAmenityPublic(AmenityPublic):
    category: str


class TaxonomyPublic(BaseModel):
    listing_types: list[str]
    property_types: list[str]
    furnishing: list[str]
    availability_statuses: list[str]
    amenities: list[TaxonomyAmenityPublic]
    areas: list[AreaPublic]


class TaxonomyEnvelopePublic(BaseModel):
    data: TaxonomyPublic


class SearchQueryPublic(StrictModel):
    q: str | None = Field(None, max_length=150)
    listing_type: str | None = Field(None, max_length=20)
    property_type: str | None = Field(None, max_length=200)
    state: str | None = Field(None, max_length=100)
    city: str | None = Field(None, max_length=100)
    area: str | None = Field(None, max_length=2000)
    price_min: int | None = Field(None, ge=0, le=9007199254740991)
    price_max: int | None = Field(None, ge=0, le=9007199254740991)
    bedrooms_min: int | None = Field(None, ge=0, le=20)
    bedrooms_max: int | None = Field(None, ge=0, le=20)
    bathrooms_min: int | None = Field(None, ge=0, le=20)
    furnishing: str | None = Field(None, max_length=100)
    amenities: str | None = Field(None, max_length=2000)
    availability: str = Field("available", max_length=100)
    sort: str = Field("-published_at", max_length=100)
    page: int = Field(1, ge=1)
    page_size: int = Field(20, ge=1, le=100)

    @model_validator(mode="after")
    def ranges(self):
        for low, high in [(self.price_min, self.price_max), (self.bedrooms_min, self.bedrooms_max)]:
            if low is not None and high is not None and low > high:
                raise ValueError("Minimum must not exceed maximum")
        return self
