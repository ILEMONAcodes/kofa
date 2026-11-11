"""Scoped assistant transcripts and conservative aggregate usage accounting."""

import uuid
from datetime import date, datetime

from sqlalchemy import (
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.identity import Base
from app.models.property import Created, Identified, Updated


class Conversation(Identified, Updated, Base):
    __tablename__ = "assistant_conversations"
    __table_args__ = (
        CheckConstraint(
            "user_id IS NOT NULL OR anon_token_hash IS NOT NULL", name="ck_assistant_owner"
        ),
        CheckConstraint("status IN ('active','handed_off','closed')", name="ck_assistant_status"),
        Index("ix_assistant_review", "flagged", "updated_at"),
    )
    user_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    anon_token_hash: Mapped[str | None] = mapped_column(String(64), unique=True)
    ip_hash: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(20), default="active")
    handoff_reason: Mapped[str | None] = mapped_column(String(30))
    handed_off_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    inquiry_id: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("inquiries.id"))
    flagged: Mapped[bool] = mapped_column(Boolean, default=False)
    review_note: Mapped[str] = mapped_column(Text, default="")
    row_version: Mapped[int] = mapped_column(Integer, default=1)
    failures: Mapped[int] = mapped_column(Integer, default=0)
    in_flight: Mapped[uuid.UUID | None]
    lease_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class AssistantMessage(Identified, Created, Base):
    __tablename__ = "assistant_messages"
    __table_args__ = (
        CheckConstraint("role IN ('user','assistant')", name="ck_assistant_message_role"),
        CheckConstraint(
            "tokens_in >= 0 AND tokens_out >= 0 AND latency_ms >= 0",
            name="ck_assistant_message_usage",
        ),
        Index("ix_assistant_message_order", "conversation_id", "created_at", "id"),
    )
    conversation_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assistant_conversations.id"))
    role: Mapped[str] = mapped_column(String(10))
    content: Mapped[str] = mapped_column(Text)
    sources: Mapped[list] = mapped_column(JSONB, default=list)
    intent: Mapped[str] = mapped_column(String(40), default="unknown")
    handoff_reason: Mapped[str | None] = mapped_column(String(30))
    model: Mapped[str] = mapped_column(String(100), default="none")
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)


class AssistantUsage(Base):
    __tablename__ = "assistant_daily_usage"
    __table_args__ = (
        CheckConstraint(
            "reserved_tokens >= 0 AND requests >= 0 AND tokens_in >= 0 AND tokens_out >= 0 AND unknown_usage_requests >= 0",
            name="ck_assistant_usage_positive",
        ),
    )
    day: Mapped[date] = mapped_column(Date, primary_key=True)
    reserved_tokens: Mapped[int] = mapped_column(Integer, default=0)
    requests: Mapped[int] = mapped_column(Integer, default=0)
    tokens_in: Mapped[int] = mapped_column(Integer, default=0)
    tokens_out: Mapped[int] = mapped_column(Integer, default=0)
    unknown_usage_requests: Mapped[int] = mapped_column(Integer, default=0)


class AssistantFeedback(Identified, Created, Base):
    __tablename__ = "assistant_feedback"
    __table_args__ = (
        CheckConstraint("length(comment) <= 500", name="ck_assistant_feedback_length"),
    )
    message_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("assistant_messages.id"), unique=True)
    helpful: Mapped[bool] = mapped_column(Boolean)
    comment: Mapped[str] = mapped_column(Text, default="")
