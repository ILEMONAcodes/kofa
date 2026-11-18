from sqlalchemy import func, select

from app.models.knowledge import KnowledgeArticle
from app.seeds.knowledge import ARTICLES, seed_knowledge
from app.services import knowledge
from app.services.assistant.retrieval import retrieve
from tests.test_staff_properties import login


def test_starter_content_published_retrievable_and_repeatable(client, db):
    actor = login(client, db, "admin")
    assert seed_knowledge(db, actor.id) == len(ARTICLES)
    assert seed_knowledge(db, actor.id) == 0
    assert db.scalar(select(func.count()).select_from(KnowledgeArticle)) == len(ARTICLES)
    sources = retrieve(db, "How does verification work?", knowledge.public_config(db).support)
    assert any(source["title"] == "How verification works" for source in sources)
    for row in db.scalars(select(KnowledgeArticle)):
        assert row.status == "published" and row.published_by == actor.id
        assert knowledge.public_article(db, row.slug).body == row.body
