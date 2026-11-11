"""Fictional assistant content in the guarded local browser database only."""

from app.core.database import make_engine, session_factory
from app.core.security import hasher, now
from app.models.identity import User
from app.models.knowledge import KnowledgeArticle, SiteSetting
from tests.e2e_server import settings

if __name__ == "__main__":
    config = settings()
    engine = make_engine(config.database_url.get_secret_value())
    with session_factory(engine)() as db:
        author = User(
            email="assistant-editor@example.com",
            full_name="Fictional Editor",
            phone="+2348000000001",
            password_hash=hasher.hash("Browserpass8!"),
            role="admin",
        )
        db.add(author)
        db.flush()
        db.add(
            KnowledgeArticle(
                slug="inspection-preparation",
                title="Preparing for an inspection",
                body="Before an inspection, review the property listing and prepare your questions. Our team will confirm the time for your visit.",
                category="inspections",
                language="en",
                status="published",
                created_by=author.id,
                published_by=author.id,
                published_at=now(),
                row_version=1,
            )
        )
        for key, value in [("assistant_enabled", True), ("assistant_daily_token_budget", 1000000)]:
            row = db.get(SiteSetting, key)
            if row:
                row.value = value
            else:
                db.add(SiteSetting(key=key, value=value))
        db.commit()
    print("Local fictional assistant content ready")
