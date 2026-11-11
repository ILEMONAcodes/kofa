"""Publication, support-hour evaluation and audience-specific DTOs. No LLM calls."""

import re
import unicodedata
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.core.errors import AppError
from app.core.security import now
from app.models.identity import AuditLog
from app.models.knowledge import KnowledgeArticle, SiteSetting
from app.repositories import knowledge as repo
from app.schemas import knowledge as s
from app.schemas.property_admin import PageMeta
from app.services.media import current_staff

DEFAULT_PHONE = "+2348145935403"  # Owner-provided public support contact; admin can override.
DEFAULT_HOURS = {
    "timezone": "Africa/Lagos",
    "days": [{"day": day, "open": "09:00", "close": "16:00"} for day in range(5)],
}


def values(rows):
    value = {key: row.value for key, row in rows.items()}
    return s.SupportSettingsOut(
        version=value.get("version", 0),
        support_phone=value.get("support_phone", DEFAULT_PHONE),
        support_email=value.get("support_email"),
        support_hours=value.get("support_hours", DEFAULT_HOURS),
        assistant_daily_token_budget=value.get("assistant_daily_token_budget", 0),
    )


def check_version(actual, supplied):
    if actual != supplied:
        raise AppError(409, "VERSION_CONFLICT", "This record changed. Refresh and try again.")


def get_settings(db, actor_id):
    current_staff(db, actor_id)
    return values(repo.settings(db))


def set_settings(db, actor_id, data):
    actor = current_staff(db, actor_id)
    if actor.role != "admin":
        raise AppError(403, "FORBIDDEN", "Only an admin can change support settings.")
    rows = repo.settings(db, True)
    current = values(rows)
    check_version(current.version, data.version)
    changes = data.model_dump(mode="json", exclude={"version", "assistant_enabled"}) | {
        "version": current.version + 1
    }
    for key, value in changes.items():
        if key in rows:
            rows[key].value = value
            rows[key].updated_by = actor.id
        else:
            db.add(SiteSetting(key=key, value=value, updated_by=actor.id))
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="support.settings_updated",
            entity_type="site_settings",
            before={"version": current.version},
            after={"version": current.version + 1},
        )
    )
    db.commit()
    return values(repo.settings(db))


def is_open(hours, stamp):
    local = stamp.astimezone(ZoneInfo("Africa/Lagos"))
    current = local.weekday() * 86400 + local.hour * 3600 + local.minute * 60 + local.second
    for day in hours.days:
        start = day.day * 86400 + s.minute(day.open) * 60
        end = day.day * 86400 + s.minute(day.close) * 60
        if end <= start:
            end += 86400
        if start <= current < end or start <= current + 604800 < end:
            return True
    return False


def public_config(db):
    config = values(repo.settings(db))
    names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]
    hours = (
        "; ".join(
            f"{names[d.day]} {d.open}–{d.close}"
            + (" (+1 day)" if s.minute(d.close) <= s.minute(d.open) else "")
            for d in sorted(config.support_hours.days, key=lambda day: day.day)
        )
        or "Support hours are not configured"
    )
    return s.PublicConfigData(
        support=s.PublicSupport(
            phone=config.support_phone,
            display_phone=config.support_phone,
            email=config.support_email,
            hours_text=hours + " (WAT)" if config.support_hours.days else hours,
            is_open_now=bool(config.support_phone or config.support_email)
            and is_open(config.support_hours, now()),
        )
    )


def public_out(row, body=False):
    cls = s.PublicArticle if body else s.PublicArticleSummary
    return cls(**{field: getattr(row, field) for field in cls.model_fields})


def staff_out(row, body=True):
    cls = s.StaffArticle if body else s.StaffArticleSummary
    return cls(
        version=row.row_version,
        **{field: getattr(row, field) for field in cls.model_fields if field != "version"},
    )


def article_list(db, page, size, public=False, actor_id=None, **filters):
    if not public:
        current_staff(db, actor_id)
    rows, total = repo.articles(db, page, size, public=public, **filters)
    cls = s.PublicArticlePage if public else s.StaffArticlePage
    return cls(
        data=[public_out(row) if public else staff_out(row, False) for row in rows],
        meta=PageMeta(
            page=page, page_size=size, total_items=total, total_pages=(total + size - 1) // size
        ),
    )


def public_article(db, slug):
    row = repo.published(db, slug)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Help article not found.")
    return public_out(row, True)


def staff_article(db, actor_id, id):
    current_staff(db, actor_id)
    row = repo.by_id(db, id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Article not found.")
    return staff_out(row)


def audit(db, actor, row, action):
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="knowledge." + action,
            entity_type="knowledge_article",
            entity_id=row.id,
            after={"status": row.status, "version": row.row_version},
        )
    )


def create(db, actor_id, data):
    actor = current_staff(db, actor_id)
    id = uuid4()
    slug = (
        re.sub(
            r"[^a-z0-9]+",
            "-",
            unicodedata.normalize("NFKD", data.title).encode("ascii", "ignore").decode().lower(),
        ).strip("-")[:100]
        or "help"
    )
    row = KnowledgeArticle(
        id=id,
        slug=f"{slug}-{id}",
        created_by=actor.id,
        row_version=1,
        status="draft",
        **data.model_dump(),
    )
    db.add(row)
    audit(db, actor, row, "created")
    db.commit()
    return staff_out(row)


def change(db, actor_id, id, data, operation="edit"):
    actor = current_staff(db, actor_id)
    if operation != "edit" and actor.role != "admin":
        raise AppError(403, "FORBIDDEN", "Only an admin can publish or unpublish articles.")
    row = repo.by_id(db, id, True)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Article not found.")
    check_version(row.row_version, data.version)
    if operation == "edit":
        if row.status != "draft":
            raise AppError(
                409, "INVALID_STATE_TRANSITION", "Unpublish this article before editing it."
            )
        for key, value in data.model_dump(exclude={"version"}).items():
            setattr(row, key, value)
    else:
        target = "published" if operation == "publish" else "draft"
        if row.status == target:
            raise AppError(
                409, "INVALID_STATE_TRANSITION", "This article is already in that state."
            )
        row.status = target
        row.published_by = actor.id if target == "published" else None
        row.published_at = now() if target == "published" else None
    row.row_version += 1
    audit(db, actor, row, operation)
    db.commit()
    return staff_out(row)
