"""Editorial and support queries; callers own transactions and role policy."""

from sqlalchemy import func, literal_column, select, text
from sqlalchemy.orm import load_only

from app.models.knowledge import KnowledgeArticle, SiteSetting

KEYS = {
    "version",
    "assistant_enabled",
    "support_phone",
    "support_email",
    "support_hours",
    "assistant_daily_token_budget",
}


def settings(db, lock=False):
    if lock:
        db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended('kofa.site_settings',0))"))
    return {
        row.key: row
        for row in db.scalars(
            select(SiteSetting)
            .where(SiteSetting.key.in_(KEYS))
            .execution_options(populate_existing=True)
        )
    }


def by_id(db, id, lock=False):
    query = select(KnowledgeArticle).where(KnowledgeArticle.id == id)
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    return db.scalar(query)


def published(db, slug):
    return db.scalar(
        select(KnowledgeArticle).where(
            KnowledgeArticle.slug == slug, KnowledgeArticle.status == "published"
        )
    )


def articles(db, page, size, public=False, status=None, q=None, category=None):
    conditions = []
    if public:
        conditions.append(KnowledgeArticle.status == "published")
    elif status:
        conditions.append(KnowledgeArticle.status == status)
    if category:
        conditions.append(KnowledgeArticle.category == category)
    if q and q.strip():
        search = q.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        conditions.append(
            literal_column("((title::text || ' '::text) || body)").ilike(
                "%" + search + "%", escape="\\"
            )
        )
    total = db.scalar(select(func.count()).select_from(KnowledgeArticle).where(*conditions)) or 0
    rows = list(
        db.scalars(
            select(KnowledgeArticle)
            .options(
                load_only(
                    KnowledgeArticle.id,
                    KnowledgeArticle.slug,
                    KnowledgeArticle.title,
                    KnowledgeArticle.category,
                    KnowledgeArticle.language,
                    KnowledgeArticle.status,
                    KnowledgeArticle.row_version,
                    KnowledgeArticle.published_at,
                    KnowledgeArticle.created_at,
                    KnowledgeArticle.updated_at,
                )
            )
            .where(*conditions)
            .order_by(KnowledgeArticle.updated_at.desc(), KnowledgeArticle.id)
            .offset((page - 1) * size)
            .limit(size)
        )
    )
    return rows, total
