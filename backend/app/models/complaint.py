"""Private allegations, bounded evidence and append-only investigation history."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
)
from sqlalchemy.dialects.postgresql import ARRAY, UUID
from sqlalchemy.orm import Mapped, mapped_column

from app.models.identity import Base


class Complaint(Base):
    __tablename__ = "complaints"
    __table_args__ = (
        CheckConstraint(
            "kind IN ('suspicious_listing','dispute','service_complaint','other')",
            name="ck_complaint_kind",
        ),
        CheckConstraint(
            "status IN ('new','triage','investigating','resolved','dismissed')",
            name="ck_complaint_status",
        ),
        CheckConstraint(
            "kind <> 'suspicious_listing' OR (property_id IS NOT NULL AND reason IS NOT NULL)",
            name="ck_report_subject",
        ),
        CheckConstraint(
            "status <> 'resolved' OR (investigation_findings IS NOT NULL AND evidence_reviewed IS NOT NULL AND length(trim(investigation_findings)) > 0 AND length(trim(evidence_reviewed)) > 0 AND outcome IS NOT NULL AND cardinality(actions_taken) > 0)",
            name="ck_complaint_resolution",
        ),
        CheckConstraint(
            "status <> 'dismissed' OR dismiss_reason IS NOT NULL", name="ck_complaint_dismiss"
        ),
        CheckConstraint(
            "reason IS NULL OR reason IN ('fake_listing','wrong_price','misleading_description','already_let_or_sold','unauthorised_agent','asked_to_pay_outside','other')",
            name="ck_complaint_reason",
        ),
        CheckConstraint(
            "outcome IS NULL OR outcome IN ('substantiated','partially_substantiated','unsubstantiated','inconclusive')",
            name="ck_complaint_outcome",
        ),
        CheckConstraint(
            "dismiss_reason IS NULL OR dismiss_reason IN ('duplicate','spam_or_abuse','out_of_scope','insufficient_information')",
            name="ck_complaint_dismiss_reason",
        ),
        CheckConstraint(
            "actions_taken <@ ARRAY['listing_corrected','listing_unpublished','listing_rejected','landlord_warned','landlord_blocked','client_warned','no_action']::text[]",
            name="ck_complaint_actions",
        ),
        CheckConstraint(
            "NOT actions_taken && ARRAY['landlord_blocked','listing_rejected']::text[] OR (outcome IS NOT NULL AND outcome IN ('substantiated','partially_substantiated'))",
            name="ck_complaint_permanent_findings",
        ),
        Index("ix_complaint_queue", "status", "created_at"),
        Index("ix_complaint_owner", "reporter_user_id", "created_at"),
        Index("ix_complaint_property", "property_id"),
        Index("ix_complaint_assignment", "assigned_staff_id", "status"),
        Index("ix_complaint_hold", "hold_property_id", "hold_review_due_at"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    kind: Mapped[str] = mapped_column(String(30))
    reason: Mapped[str | None] = mapped_column(String(40))
    status: Mapped[str] = mapped_column(String(20), default="new")
    reporter_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    reporter_name: Mapped[str | None] = mapped_column(String(150))
    reporter_email: Mapped[str | None] = mapped_column(String(254))
    reporter_phone: Mapped[str | None] = mapped_column(String(20))
    reporter_ip_hash: Mapped[str] = mapped_column(String(64))
    property_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("properties.id"))
    appointment_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("appointments.id"))
    description: Mapped[str] = mapped_column(Text)
    occurred_on: Mapped[date | None] = mapped_column(Date)
    desired_outcome: Mapped[str | None] = mapped_column(Text)
    assigned_staff_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    investigation_findings: Mapped[str | None] = mapped_column(Text)
    evidence_reviewed: Mapped[str | None] = mapped_column(Text)
    outcome: Mapped[str | None] = mapped_column(String(30))
    actions_taken: Mapped[list[str]] = mapped_column(ARRAY(Text), default=list, server_default="{}")
    dismiss_reason: Mapped[str | None] = mapped_column(String(40))
    public_note: Mapped[str | None] = mapped_column(Text)
    hold_property_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("properties.id"))
    hold_review_due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    upload_token_hash: Mapped[str] = mapped_column(String(64))
    upload_token_expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    row_version: Mapped[int] = mapped_column(Integer, default=1)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ComplaintEvidence(Base):
    __tablename__ = "complaint_evidence"
    __table_args__ = (
        CheckConstraint("size_bytes > 0 AND size_bytes <= 5242880", name="ck_complaint_file_size"),
    )
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    complaint_id: Mapped[uuid.UUID] = mapped_column(
        ForeignKey("complaints.id", ondelete="CASCADE"), index=True
    )
    storage_key: Mapped[str] = mapped_column(Text, unique=True)
    mime_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column(Integer)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ComplaintEvent(Base):
    __tablename__ = "complaint_events"
    id: Mapped[uuid.UUID] = mapped_column(UUID, primary_key=True, default=uuid.uuid4)
    complaint_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("complaints.id"), index=True)
    from_status: Mapped[str | None] = mapped_column(String(20))
    to_status: Mapped[str] = mapped_column(String(20))
    actor_user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    note: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
