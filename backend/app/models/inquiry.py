"""Inquiry records; staff notes have their own table and response boundary."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    UniqueConstraint,
    text,
)
from sqlalchemy.orm import Mapped, mapped_column

from app.models.identity import Base
from app.models.property import Created, Identified, Updated

OPEN = "status NOT IN ('closed_won','closed_lost','spam')"
STATUSES = "'new','in_progress','qualified','inspection_scheduled','negotiating','closed_won','closed_lost','spam'"


class Inquiry(Identified, Updated, Base):
    __tablename__ = "inquiries"
    __table_args__ = (
        CheckConstraint(f"status IN ({STATUSES})", name="ck_inquiry_status"),
        CheckConstraint(
            "kind IN ('property_interest','inspection_request','general')", name="ck_inquiry_kind"
        ),
        CheckConstraint("source IN ('web_form','assistant')", name="ck_inquiry_source"),
        CheckConstraint("(kind = 'general') = (property_id IS NULL)", name="ck_inquiry_property"),
        CheckConstraint("budget_min IS NULL OR budget_min >= 0", name="ck_inquiry_min"),
        CheckConstraint("budget_max IS NULL OR budget_max >= 0", name="ck_inquiry_max"),
        CheckConstraint(
            "budget_min IS NULL OR budget_max IS NULL OR budget_min <= budget_max",
            name="ck_inquiry_budget",
        ),
        Index(
            "uq_inquiry_open_property",
            "client_id",
            "property_id",
            unique=True,
            postgresql_where=text(OPEN + " AND property_id IS NOT NULL"),
        ),
        Index("ix_inquiry_status_created", "status", "created_at"),
        Index("ix_inquiry_staff_status", "assigned_staff_id", "status"),
        Index("ix_inquiry_client_created", "client_id", "created_at"),
    )
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    property_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("properties.id"))
    kind: Mapped[str] = mapped_column(String(30))
    source: Mapped[str] = mapped_column(String(20), default="web_form")
    status: Mapped[str] = mapped_column(String(30), default="new")
    assigned_staff_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    budget_min: Mapped[int | None] = mapped_column(BigInteger)
    budget_max: Mapped[int | None] = mapped_column(BigInteger)
    desired_move_in: Mapped[date | None] = mapped_column(Date)
    qualified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    closed_reason: Mapped[str | None] = mapped_column(Text)
    last_client_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    last_staff_message_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    row_version: Mapped[int] = mapped_column(Integer, default=1)


class InquiryMessage(Identified, Created, Base):
    __tablename__ = "inquiry_messages"
    __table_args__ = (
        CheckConstraint("sender_role IN ('client','staff')", name="ck_message_role"),
        CheckConstraint("length(body) BETWEEN 1 AND 4000", name="ck_message_length"),
        Index("ix_inquiry_message_order", "inquiry_id", "created_at", "id"),
    )
    inquiry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("inquiries.id"))
    sender_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    sender_role: Mapped[str] = mapped_column(String(10))
    body: Mapped[str] = mapped_column(Text)
    read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class InquiryNote(Identified, Created, Base):
    __tablename__ = "inquiry_notes"
    __table_args__ = (
        CheckConstraint("length(body) BETWEEN 1 AND 4000", name="ck_note_length"),
        Index("ix_inquiry_note_order", "inquiry_id", "created_at", "id"),
    )
    inquiry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("inquiries.id"))
    author_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    body: Mapped[str] = mapped_column(Text)


class InquiryHistory(Identified, Created, Base):
    __tablename__ = "inquiry_status_history"
    inquiry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("inquiries.id"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(30))
    to_status: Mapped[str] = mapped_column(String(30))
    actor_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(Text)


class InquiryRequest(Identified, Created, Base):
    __tablename__ = "inquiry_requests"
    __table_args__ = (UniqueConstraint("client_id", "key_hash", name="uq_inquiry_request_key"),)
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    inquiry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("inquiries.id"))
    key_hash: Mapped[str] = mapped_column(String(64))
    body_hash: Mapped[str] = mapped_column(String(64))
