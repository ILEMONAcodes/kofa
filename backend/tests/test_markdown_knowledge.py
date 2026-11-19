from app.services import knowledge
from app.services.assistant.documents import articles, by_slug
from app.services.assistant.retrieval import retrieve


def test_markdown_sources_work_without_published_articles(client, db):
    assert len(articles()) == 7
    assert by_slug("../../.env") is None
    sources = retrieve(db, "How does verification work?", knowledge.public_config(db).support)
    assert any(s["url"].endswith("guide-verification") for s in sources)
    article = client.get("/api/v1/knowledge-articles/guide-verification")
    assert article.status_code == 200
    assert "Verification checks" in article.json()["data"]["body"]
