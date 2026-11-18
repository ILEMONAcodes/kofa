from app.services import knowledge
from app.services.assistant import provider
from app.services.assistant.documents import articles, by_slug
from app.services.assistant.retrieval import retrieve
from tests.conftest import csrf
from tests.test_assistant import ask, start


def test_markdown_sources_work_without_published_articles(client, db):
    assert len(articles()) == 7
    assert by_slug("../../.env") is None
    sources = retrieve(db, "How does verification work?", knowledge.public_config(db).support)
    assert any(s["url"].endswith("guide-verification") for s in sources)
    article = client.get("/api/v1/knowledge-articles/guide-verification")
    assert article.status_code == 200
    assert "Verification checks" in article.json()["data"]["body"]


def test_greeting_needs_no_provider_or_sources(client, db, settings, monkeypatch):
    monkeypatch.setattr(settings, "assistant_provider", "disabled")

    def fail(*args):
        raise AssertionError("Greeting must not call the model")

    monkeypatch.setattr(provider, "build", fail)
    csrf(client)
    turn = ask(client, start(client), "Hello!").json()["data"]
    assert turn["handoff"] is None
    assert turn["message"]["content"].startswith("Hello!")
    assert turn["message"]["sources"] == []
