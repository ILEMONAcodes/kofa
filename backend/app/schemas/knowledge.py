import re
from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field, field_validator, model_validator

from app.schemas.auth import Phone, StrictModel
from app.schemas.property_admin import PageMeta

Category = Literal[
    "how_it_works",
    "fees",
    "verification",
    "inspections",
    "policies",
    "reporting",
    "contact",
    "other",
]


class SupportDay(StrictModel):
    day: int = Field(ge=0, le=6, strict=True)
    open: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")
    close: str = Field(pattern=r"^([01]\d|2[0-3]):[0-5]\d$")


def minute(value):
    hour, mins = map(int, value.split(":"))
    return hour * 60 + mins


class SupportHours(StrictModel):
    timezone: Literal["Africa/Lagos"] = "Africa/Lagos"
    days: list[SupportDay] = Field(default_factory=list, max_length=7)

    @model_validator(mode="after")
    def unique_nonoverlap(self):
        if len({d.day for d in self.days}) != len(self.days):
            raise ValueError("Each weekday can appear once")
        spans: list[tuple[int, int]] = []
        for day in self.days:
            start = day.day * 1440 + minute(day.open)
            end = day.day * 1440 + minute(day.close)
            if end <= start:
                end += 1440
            for other_start, other_end in spans:
                if any(
                    max(start, other_start + shift) < min(end, other_end + shift)
                    for shift in [-10080, 0, 10080]
                ):
                    raise ValueError("Opening hours must not overlap")
            spans.append((start, end))
        return self


class SupportSettingsInput(StrictModel):
    version: int = Field(strict=True, ge=0)
    support_phone: Phone | None = None
    support_email: EmailStr | None = None
    support_hours: SupportHours
    assistant_enabled: bool = Field(default=False, strict=True)
    assistant_daily_token_budget: int = Field(default=0, strict=True, ge=0, le=10000000)


class SupportSettingsOut(BaseModel):
    version: int
    support_phone: str | None
    support_email: str | None
    support_hours: SupportHours
    assistant_enabled: bool = False
    assistant_daily_token_budget: int = 0


class SupportSettingsEnvelope(BaseModel):
    data: SupportSettingsOut


class PublicSupport(BaseModel):
    phone: str | None
    display_phone: str | None
    email: str | None
    hours_text: str
    timezone: Literal["Africa/Lagos"] = "Africa/Lagos"
    is_open_now: bool


class PublicAssistant(BaseModel):
    enabled: bool = False
    disclosure: str = "I'm an AI assistant. I can answer common questions, but I can make mistakes. For payments, legal questions or complaints, please contact our team."


class PublicConfigData(BaseModel):
    support: PublicSupport
    assistant: PublicAssistant = Field(default_factory=PublicAssistant)


class PublicConfigEnvelope(BaseModel):
    data: PublicConfigData


class ArticleCreate(StrictModel):
    title: str = Field(min_length=3, max_length=160)
    body: str = Field(min_length=20, max_length=30000)
    category: Category
    language: Literal["en"] = "en"

    @field_validator("title", "body", mode="before")
    @classmethod
    def trimmed(cls, value):
        if not isinstance(value, str):
            return value
        value = value.strip()
        if not value:
            raise ValueError("Provide meaningful text")
        if re.search(r"<\s*/?\s*(script|iframe|object|style)\b", value, re.I):
            raise ValueError("Active HTML is not accepted")
        return value


class ArticleEdit(ArticleCreate):
    version: int = Field(strict=True, ge=1)


class ArticleVersion(StrictModel):
    version: int = Field(strict=True, ge=1)


class PublicArticleSummary(BaseModel):
    slug: str
    title: str
    category: Category
    language: Literal["en"]
    published_at: datetime


class PublicArticle(PublicArticleSummary):
    body: str


class StaffArticleSummary(BaseModel):
    id: UUID
    slug: str
    title: str
    category: Category
    language: Literal["en"]
    status: Literal["draft", "published"]
    version: int
    published_at: datetime | None
    created_at: datetime
    updated_at: datetime


class StaffArticle(StaffArticleSummary):
    body: str


class PublicArticleEnvelope(BaseModel):
    data: PublicArticle


class PublicArticlePage(BaseModel):
    data: list[PublicArticleSummary]
    meta: PageMeta


class StaffArticleEnvelope(BaseModel):
    data: StaffArticle


class StaffArticlePage(BaseModel):
    data: list[StaffArticleSummary]
    meta: PageMeta
