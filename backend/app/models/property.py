"""Property metadata. Private fields are not public response schemas."""

import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import (
    BigInteger,
    Boolean,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    Numeric,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
    literal_column,
    text,
)
from sqlalchemy.dialects.postgresql import CITEXT, JSONB, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.identity import Base

STATUSES = "'draft','submitted','in_review','changes_requested','approved','published','unpublished','rejected','archived'"


class Identified:
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)


class Created:
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class Updated(Created):
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Area(Identified, Updated, Base):
    __tablename__ = "areas"
    __table_args__ = (
        UniqueConstraint("state", "city", "neighbourhood", name="uq_area_location"),
        CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_area_latitude"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_area_longitude"),
    )
    state: Mapped[str] = mapped_column(String(60))
    city: Mapped[str] = mapped_column(String(60))
    neighbourhood: Mapped[str] = mapped_column(String(80))
    slug: Mapped[str] = mapped_column(String(100), unique=True)
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))


class Amenity(Identified, Updated, Base):
    __tablename__ = "amenities"
    code: Mapped[str] = mapped_column(String(40), unique=True)
    label: Mapped[str] = mapped_column(String(80))
    category: Mapped[str] = mapped_column(String(30))
    sort_order: Mapped[int] = mapped_column(Integer, server_default="0")
    is_active: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))


class Landlord(Identified, Updated, Base):
    __tablename__ = "landlords"
    full_name: Mapped[str] = mapped_column(String(150))
    phone: Mapped[str] = mapped_column(String(20), index=True)
    email: Mapped[str | None] = mapped_column(CITEXT, index=True)
    identity_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    identity_verified_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    blocked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    blocked_reason: Mapped[str | None] = mapped_column(Text)
    notes: Mapped[str | None] = mapped_column(Text)


class Property(Identified, Updated, Base):
    __tablename__ = "properties"
    __table_args__ = (
        CheckConstraint("listing_type IN ('rent','sale')", name="ck_property_listing_type"),
        CheckConstraint(
            "property_type IN ('apartment','house','duplex','bungalow','terrace','studio','room')",
            name="ck_property_type",
        ),
        CheckConstraint("intended_use = 'residential'", name="ck_property_intended_use"),
        CheckConstraint(
            "relationship IN ('owner','authorized_agent','developer','property_manager')",
            name="ck_property_relationship",
        ),
        CheckConstraint("price_amount > 0", name="ck_property_price"),
        CheckConstraint("currency = 'NGN'", name="ck_property_currency"),
        CheckConstraint(
            "(listing_type = 'sale' AND price_period = 'one_time') OR (listing_type = 'rent' AND price_period IN ('month','year'))",
            name="ck_property_price_period",
        ),
        CheckConstraint(
            "bedrooms BETWEEN 0 AND 20 AND bathrooms BETWEEN 0 AND 20", name="ck_property_rooms"
        ),
        CheckConstraint(
            "furnishing IN ('furnished','semi_furnished','unfurnished')",
            name="ck_property_furnishing",
        ),
        CheckConstraint(f"status IN ({STATUSES})", name="ck_property_status"),
        CheckConstraint(
            "availability_status IN ('available','under_offer','unavailable')",
            name="ck_property_availability",
        ),
        CheckConstraint("row_version > 0", name="ck_property_version"),
        CheckConstraint("jsonb_typeof(extra_charges) = 'array'", name="ck_property_extra_charges"),
        CheckConstraint("latitude BETWEEN -90 AND 90", name="ck_property_latitude"),
        CheckConstraint("longitude BETWEEN -180 AND 180", name="ck_property_longitude"),
        Index("ix_property_status_published", "status", "published_at"),
        Index("ix_property_listing_type", "listing_type", "property_type"),
        Index("ix_property_staff_status", "assigned_staff_id", "status"),
        Index(
            "ix_property_public_search",
            "area_id",
            "price_amount",
            postgresql_where=text("status = 'published'"),
        ),
        Index(
            "ix_property_text",
            literal_column("((title::text || ' '::text) || description)").label("search_text"),
            postgresql_using="gin",
            postgresql_ops={"search_text": "gin_trgm_ops"},
        ),
    )
    slug: Mapped[str] = mapped_column(String(160), unique=True)
    landlord_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("landlords.id"), index=True)
    area_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("areas.id"), index=True)
    title: Mapped[str] = mapped_column(String(120))
    description: Mapped[str] = mapped_column(Text)
    listing_type: Mapped[str] = mapped_column(String(10))
    property_type: Mapped[str] = mapped_column(String(20))
    intended_use: Mapped[str] = mapped_column(String(20), server_default="residential")
    relationship: Mapped[str] = mapped_column(String(30))
    price_amount: Mapped[int] = mapped_column(BigInteger, index=True)
    currency: Mapped[str] = mapped_column(String(3), server_default="NGN")
    price_period: Mapped[str] = mapped_column(String(10))
    price_negotiable: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    payment_terms: Mapped[str | None] = mapped_column(Text)
    extra_charges: Mapped[list[dict]] = mapped_column(JSONB, server_default=text("'[]'::jsonb"))
    bedrooms: Mapped[int] = mapped_column(SmallInteger, index=True)
    bathrooms: Mapped[int] = mapped_column(SmallInteger)
    furnishing: Mapped[str] = mapped_column(String(15))
    address_line: Mapped[str] = mapped_column(Text)
    address_hint: Mapped[str | None] = mapped_column(String(160))
    latitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    longitude: Mapped[Decimal | None] = mapped_column(Numeric(9, 6))
    landlord_conditions: Mapped[str | None] = mapped_column(Text)
    status: Mapped[str] = mapped_column(String(20), server_default="draft")
    availability_status: Mapped[str] = mapped_column(
        String(15), server_default="available", index=True
    )
    last_availability_confirmed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    assigned_staff_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    submitted_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    archived_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    rejection_reason: Mapped[str | None] = mapped_column(Text)
    row_version: Mapped[int] = mapped_column(Integer, server_default="1")


class PropertyAmenity(Base):
    __tablename__ = "property_amenities"
    property_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("properties.id", ondelete="CASCADE"), primary_key=True
    )
    amenity_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("amenities.id"), primary_key=True)


class PropertyMedia(Identified, Created, Base):
    __tablename__ = "property_media"
    __table_args__ = (
        CheckConstraint("kind IN ('photo','video')", name="ck_media_kind"),
        CheckConstraint("size_bytes > 0", name="ck_media_size"),
        CheckConstraint("position >= 0", name="ck_media_position"),
        CheckConstraint("width IS NULL OR width > 0", name="ck_media_width"),
        CheckConstraint("height IS NULL OR height > 0", name="ck_media_height"),
        CheckConstraint(
            "uploaded_by IN ('landlord_submission','staff')", name="ck_media_uploaded_by"
        ),
        CheckConstraint("NOT is_cover OR kind = 'photo'", name="ck_media_cover_photo"),
        Index("uq_property_cover", "property_id", unique=True, postgresql_where=text("is_cover")),
        Index(
            "uq_property_video", "property_id", unique=True, postgresql_where=text("kind = 'video'")
        ),
        Index("ix_media_property_position", "property_id", "position"),
    )
    property_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("properties.id", ondelete="CASCADE"))
    kind: Mapped[str] = mapped_column(String(10))
    storage_key: Mapped[str] = mapped_column(Text, unique=True)
    thumb_key: Mapped[str | None] = mapped_column(Text)
    original_filename: Mapped[str] = mapped_column(String(255))
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    width: Mapped[int | None] = mapped_column(Integer)
    height: Mapped[int | None] = mapped_column(Integer)
    alt_text: Mapped[str | None] = mapped_column(String(200))
    position: Mapped[int] = mapped_column(Integer, server_default="0")
    is_cover: Mapped[bool] = mapped_column(Boolean, server_default=text("false"))
    uploaded_by: Mapped[str] = mapped_column(String(30))


class PropertyDocument(Identified, Created, Base):
    __tablename__ = "property_documents"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('ownership_proof','authorization_letter','id_document','other')",
            name="ck_document_kind",
        ),
        CheckConstraint("size_bytes > 0", name="ck_document_size"),
    )
    property_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("properties.id"), index=True)
    kind: Mapped[str] = mapped_column(String(30))
    storage_key: Mapped[str] = mapped_column(Text, unique=True)
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(BigInteger)
    review_note: Mapped[str | None] = mapped_column(Text)
    reviewed_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PropertyVerification(Identified, Created, Base):
    __tablename__ = "property_verifications"
    __table_args__ = (
        CheckConstraint(
            "status IN ('in_progress','passed','failed')", name="ck_verification_status"
        ),
        CheckConstraint(
            "method IN ('desk_review','physical_inspection','both')", name="ck_verification_method"
        ),
        Index(
            "uq_current_verification",
            "property_id",
            unique=True,
            postgresql_where=text("is_current"),
        ),
    )
    property_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("properties.id"), index=True)
    status: Mapped[str] = mapped_column(String(15), server_default="in_progress")
    method: Mapped[str] = mapped_column(String(25))
    scope_summary: Mapped[str | None] = mapped_column(Text)
    verified_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    is_current: Mapped[bool] = mapped_column(Boolean, server_default=text("true"))


class VerificationCheck(Identified, Base):
    __tablename__ = "verification_checks"
    __table_args__ = (
        UniqueConstraint("verification_id", "code", name="uq_verification_check"),
        CheckConstraint(
            "code IN ('identity','ownership_docs','location','price','features','availability')",
            name="ck_verification_check_code",
        ),
        CheckConstraint("result IN ('pass','fail','na')", name="ck_verification_check_result"),
    )
    verification_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("property_verifications.id", ondelete="CASCADE")
    )
    code: Mapped[str] = mapped_column(String(30))
    result: Mapped[str] = mapped_column(String(5))
    note: Mapped[str | None] = mapped_column(Text)
    evidence_document_id: Mapped[uuid.UUID | None] = mapped_column(
        ForeignKey("property_documents.id")
    )


class LandlordApproval(Identified, Created, Base):
    __tablename__ = "property_landlord_approvals"
    __table_args__ = (
        CheckConstraint("approved_price_amount > 0", name="ck_approval_price"),
        CheckConstraint(
            "approved_price_period IN ('month','year','one_time')", name="ck_approval_period"
        ),
        CheckConstraint(
            "method IN ('phone','whatsapp','email','in_person')", name="ck_approval_method"
        ),
        Index(
            "uq_current_landlord_approval",
            "property_id",
            unique=True,
            postgresql_where=text("superseded_at IS NULL"),
        ),
    )
    property_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("properties.id"), index=True)
    approved_price_amount: Mapped[int] = mapped_column(BigInteger)
    approved_price_period: Mapped[str] = mapped_column(String(10))
    description_approved: Mapped[bool] = mapped_column(Boolean)
    method: Mapped[str] = mapped_column(String(15))
    note: Mapped[str | None] = mapped_column(Text)
    recorded_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    superseded_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class PropertyStatusHistory(Identified, Created, Base):
    __tablename__ = "property_status_history"
    __table_args__ = (
        CheckConstraint(f"from_status IN ({STATUSES})", name="ck_history_from_status"),
        CheckConstraint(f"to_status IN ({STATUSES})", name="ck_history_to_status"),
        Index("ix_property_history_created", "property_id", "created_at"),
    )
    property_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("properties.id"))
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(Text)
