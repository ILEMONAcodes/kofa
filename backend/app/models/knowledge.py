"""Support configuration and editorial content; private drafts are never public DTOs."""

import uuid
from datetime import datetime

from sqlalchemy import (
    CheckConstraint,
    DateTime,
    ForeignKey,
    Index,
    Integer,
    String,
    Text,
    func,
    literal_column,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import Mapped, mapped_column

from app.models.identity import Base
from app.models.property import Identified, Updated


class SiteSetting(Base):
    __tablename__ = "site_settings"
    key: Mapped[str] = mapped_column(String(60), primary_key=True)
    value: Mapped[dict | list | str | int | bool | None] = mapped_column(JSONB, nullable=False)
    updated_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class KnowledgeArticle(Identified, Updated, Base):
    __tablename__ = "knowledge_articles"
    __table_args__ = (
        CheckConstraint("status IN ('draft','published')", name="ck_knowledge_status"),
        CheckConstraint(
            "category IN ('how_it_works','fees','verification','inspections','policies','reporting','contact','other')",
            name="ck_knowledge_category",
        ),
        CheckConstraint("language = 'en'", name="ck_knowledge_language"),
        CheckConstraint("row_version > 0", name="ck_knowledge_version"),
        CheckConstraint(
            "status <> 'published' OR (published_at IS NOT NULL AND published_by IS NOT NULL)",
            name="ck_knowledge_published",
        ),
        Index("ix_knowledge_status_updated", "status", "updated_at"),
        Index(
            "ix_knowledge_text",
            literal_column("((title::text || ' '::text) || body)").label("knowledge_text"),
            postgresql_using="gin",
            postgresql_ops={"knowledge_text": "gin_trgm_ops"},
        ),
    )
    slug: Mapped[str] = mapped_column(String(180), unique=True)
    title: Mapped[str] = mapped_column(String(160))
    body: Mapped[str] = mapped_column(Text)
    category: Mapped[str] = mapped_column(String(30))
    language: Mapped[str] = mapped_column(String(2), default="en")
    status: Mapped[str] = mapped_column(String(20), default="draft")
    published_by: Mapped[uuid.UUID | None] = mapped_column(ForeignKey("users.id"))
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    created_by: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    row_version: Mapped[int] = mapped_column(Integer, default=1)
