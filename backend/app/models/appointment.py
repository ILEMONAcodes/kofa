"""Appointments; overlapping active slots are excluded by PostgreSQL."""

import uuid
from datetime import datetime

from sqlalchemy import (
    BigInteger,
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    text,
)
from sqlalchemy.dialects.postgresql import ExcludeConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.identity import Base
from app.models.property import Created, Identified, Updated

ACTIVE = "status IN ('proposed','confirmed','reschedule_requested')"
STATUSES = "'proposed','confirmed','reschedule_requested','completed','cancelled_by_client','cancelled_by_staff','cancelled_by_landlord','no_show'"


class Appointment(Identified, Updated, Base):
    __tablename__ = "appointments"
    __table_args__ = (
        CheckConstraint(f"status IN ({STATUSES})", name="ck_appointment_status"),
        CheckConstraint(
            "fee_amount = 0 AND fee_status = 'none'", name="ck_appointment_fee_disabled"
        ),
        CheckConstraint(
            "ends_at = scheduled_at + duration_minutes * interval '1 minute'",
            name="ck_appointment_interval",
        ),
        CheckConstraint("duration_minutes BETWEEN 15 AND 240", name="ck_appointment_duration"),
        CheckConstraint(
            "outcome IS NULL OR outcome IN ('interested','not_interested','needs_follow_up')",
            name="ck_appointment_outcome",
        ),
        ExcludeConstraint(
            ("staff_id", "="),
            (func.tstzrange(text("scheduled_at"), text("ends_at"), text("'[)'")), "&&"),
            where=text(ACTIVE),
            using="gist",
            name="ex_appointment_staff_slot",
        ),
        ExcludeConstraint(
            ("property_id", "="),
            (func.tstzrange(text("scheduled_at"), text("ends_at"), text("'[)'")), "&&"),
            where=text(ACTIVE),
            using="gist",
            name="ex_appointment_property_slot",
        ),
        Index(
            "uq_appointment_active_inquiry",
            "inquiry_id",
            unique=True,
            postgresql_where=text(ACTIVE),
        ),
        Index("ix_appointment_client_date", "client_id", "scheduled_at"),
        Index("ix_appointment_staff_date", "staff_id", "scheduled_at"),
        Index("ix_appointment_status_date", "status", "scheduled_at"),
    )
    inquiry_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("inquiries.id"))
    property_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("properties.id"))
    client_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    staff_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    scheduled_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    ends_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    duration_minutes: Mapped[int] = mapped_column(Integer, default=45)
    status: Mapped[str] = mapped_column(String(30), default="proposed")
    meeting_address: Mapped[str | None] = mapped_column(Text)
    meeting_instructions: Mapped[str | None] = mapped_column(Text)
    landlord_rep_name: Mapped[str | None] = mapped_column(String(150))
    landlord_rep_phone: Mapped[str | None] = mapped_column(String(20))
    address_disclosed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    requested_scheduled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    reschedule_reason: Mapped[str | None] = mapped_column(Text)
    cancellation_reason: Mapped[str | None] = mapped_column(Text)
    outcome: Mapped[str | None] = mapped_column(String(30))
    outcome_notes: Mapped[str | None] = mapped_column(Text)
    fee_amount: Mapped[int] = mapped_column(BigInteger, default=0, server_default="0")
    fee_status: Mapped[str] = mapped_column(String(20), default="none", server_default="none")
    row_version: Mapped[int] = mapped_column(Integer, default=1)


class AppointmentHistory(Identified, Created, Base):
    __tablename__ = "appointment_status_history"
    __table_args__ = (Index("ix_appointment_history", "appointment_id", "created_at", "id"),)
    appointment_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("appointments.id"))
    from_status: Mapped[str | None] = mapped_column(String(30))
    to_status: Mapped[str] = mapped_column(String(30))
    actor_user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    reason: Mapped[str | None] = mapped_column(Text)
