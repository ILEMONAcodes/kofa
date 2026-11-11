"""Local-only support, editorial authorization and privacy acceptance."""

from datetime import UTC, datetime

import pytest
from pydantic import ValidationError

from app.schemas.knowledge import SupportHours
from app.services.knowledge import is_open
from tests.test_staff_properties import h, login

ARTICLE = {
    "title": "Inspection guide",
    "body": "Contact our team to arrange a suitable inspection time.",
    "category": "inspections",
    "language": "en",
}
SETTINGS = {
    "version": 0,
    "support_phone": "+2348145935403",
    "support_email": None,
    "support_hours": {
        "timezone": "Africa/Lagos",
        "days": [{"day": 0, "open": "09:00", "close": "16:00"}],
    },
    "assistant_enabled": False,
    "assistant_daily_token_budget": 123,
}


def write(client, path, data, method="post"):
    return getattr(client, method)("/api/v1" + path, json=data, headers=h(client))


@pytest.mark.parametrize(
    "hour,minute,expected", [(7, 59, False), (8, 0, True), (14, 59, True), (15, 0, False)]
)
def test_hours(hour, minute, expected):
    assert (
        is_open(
            SupportHours.model_validate(SETTINGS["support_hours"]),
            datetime(2026, 11, 9, hour, minute, tzinfo=UTC),
        )
        is expected
    )


@pytest.mark.parametrize(
    "day,opening,closing,hour,expected",
    [
        (6, "22:00", "02:00", 0, True),
        (6, "22:00", "02:00", 1, False),
        (6, "09:00", "09:00", 7, True),
        (6, "09:00", "09:00", 8, False),
    ],
)
def test_week_boundary(day, opening, closing, hour, expected):
    hours = SupportHours(days=[{"day": day, "open": opening, "close": closing}])
    assert is_open(hours, datetime(2026, 11, 9, hour, tzinfo=UTC)) is expected


@pytest.mark.parametrize(
    "days",
    [
        [{"day": 0, "open": "09:00", "close": "16:00"}] * 2,
        [
            {"day": 6, "open": "22:00", "close": "03:00"},
            {"day": 0, "open": "02:00", "close": "04:00"},
        ],
        [{"day": 7, "open": "09:00", "close": "16:00"}],
        [{"day": 0, "open": "25:00", "close": "16:00"}],
    ],
)
def test_bad_hours(days):
    with pytest.raises(ValidationError):
        SupportHours(days=days)


@pytest.mark.parametrize(
    "role,code", [(None, 401), ("client", 403), ("staff", 403), ("admin", 200)]
)
def test_settings_roles(client, db, role, code):
    login(client, db, role)
    assert write(client, "/admin/settings", SETTINGS, "put").status_code == code
    assert client.get("/api/v1/admin/settings").status_code == (
        200 if role in {"staff", "admin"} else code
    )


def test_settings_clear_and_conflict(client, db):
    login(client, db, "admin")
    assert (
        client.get("/api/v1/public-config").json()["data"]["support"]["phone"] == "+2348145935403"
    )
    response = write(client, "/admin/settings", SETTINGS, "put")
    assert response.status_code == 200, response.text
    assert response.json()["data"]["version"] == 1
    assert write(client, "/admin/settings", SETTINGS, "put").status_code == 409
    cleared = SETTINGS | {"version": 1, "support_phone": None, "support_hours": {"days": []}}
    assert write(client, "/admin/settings", cleared, "put").status_code == 200
    public = client.get("/api/v1/public-config")
    assert public.json()["data"]["support"]["phone"] is None
    assert public.json()["data"]["support"]["is_open_now"] is False
    assert public.json()["data"]["assistant"]["enabled"] is False
    assert public.headers["cache-control"] == "no-store"
    for field in ["assistant_daily_token_budget", "updated_by", "version"]:
        assert field not in public.text


@pytest.mark.parametrize(
    "patch",
    [
        {"support_phone": "bad"},
        {"support_email": "bad"},
        {"version": True},
        {"support_hours": {"timezone": "UTC", "days": []}},
    ],
)
def test_settings_validation(client, db, patch):
    login(client, db, "admin")
    assert write(client, "/admin/settings", SETTINGS | patch, "put").status_code == 422


@pytest.mark.parametrize(
    "role,code", [(None, 401), ("client", 403), ("staff", 201), ("admin", 201)]
)
def test_article_roles(client, db, role, code):
    login(client, db, role)
    response = write(client, "/admin/knowledge-articles", ARTICLE)
    assert response.status_code == code, response.text


def test_editorial_lifecycle(client, db):
    login(client, db, "staff")
    response = write(client, "/admin/knowledge-articles", ARTICLE)
    assert response.status_code == 201, response.text
    row = response.json()["data"]
    path = "/admin/knowledge-articles/" + row["id"]
    public = "/api/v1/knowledge-articles/" + row["slug"]
    assert client.get(public).status_code == 404
    assert client.get("/api/v1/knowledge-articles?q=inspection").json()["data"] == []
    assert write(client, path + "/publish", {"version": 1}).status_code == 403
    edited = write(
        client, path, ARTICLE | {"title": "Updated inspection guide", "version": 1}, "patch"
    )
    assert edited.status_code == 200, edited.text
    assert edited.json()["data"]["slug"] == row["slug"]
    assert write(client, path, ARTICLE | {"version": 1}, "patch").status_code == 409
    login(client, db, "admin")
    assert write(client, path + "/publish", {"version": 2}).status_code == 200
    assert write(client, path + "/publish", {"version": 3}).status_code == 409
    assert write(client, path, ARTICLE | {"version": 3}, "patch").status_code == 409
    detail = client.get(public)
    assert detail.status_code == 200, detail.text
    assert set(detail.json()["data"]) == {
        "slug",
        "title",
        "body",
        "category",
        "language",
        "published_at",
    }
    page = client.get("/api/v1/knowledge-articles?category=inspections&page_size=1").json()
    assert page["meta"]["total_items"] == 1
    assert "body" not in page["data"][0]
    assert client.get("/api/v1/knowledge-articles?q=%25").json()["data"] == []
    assert write(client, path + "/unpublish", {"version": 3}).status_code == 200
    assert client.get(public).status_code == 404
    assert client.get("/api/v1/knowledge-articles").json()["data"] == []


@pytest.mark.parametrize(
    "query", ["status=draft", "unknown=x", "page=1&page=2", "page=0", "category=secret"]
)
def test_strict_queries(client, query):
    assert client.get("/api/v1/knowledge-articles?" + query).status_code == 422


def test_content_csrf_limits(client, db):
    login(client, db, "staff")
    for patch in [
        {"body": "<script>alert(1)</script>"},
        {"title": "  "},
        {"language": "fr"},
        {"status": "published"},
    ]:
        assert write(client, "/admin/knowledge-articles", ARTICLE | patch).status_code == 422
    assert client.post("/api/v1/admin/knowledge-articles", json=ARTICLE).status_code == 403
    assert (
        write(client, "/admin/knowledge-articles", ARTICLE | {"body": "x" * 262145}).status_code
        == 413
    )


def test_migration_seeded_roundtrip(engine, db, client):
    from pathlib import Path

    from alembic.config import Config
    from sqlalchemy import inspect, text

    from alembic import command
    from tests.conftest import TEST_URL

    actor = login(client, db, "admin")
    actor_id = actor.id
    assert write(client, "/admin/knowledge-articles", ARTICLE).status_code == 201
    assert write(client, "/admin/settings", SETTINGS, "put").status_code == 200
    db.close()
    cfg = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
    cfg.attributes["database_url"] = TEST_URL
    try:
        command.downgrade(cfg, "be615_complaints")
        assert "knowledge_articles" not in inspect(engine).get_table_names()
        assert "site_settings" not in inspect(engine).get_table_names()
        with engine.connect() as connection:
            assert (
                connection.scalar(text("SELECT count(*) FROM users WHERE id=:id"), {"id": actor_id})
                == 1
            )
    finally:
        command.upgrade(cfg, "head")
    assert {"knowledge_articles", "site_settings"} <= set(inspect(engine).get_table_names())


def test_editorial_audit_pagination_and_private_settings(client, db):
    from sqlalchemy import select

    from app.models.identity import AuditLog
    from app.models.knowledge import SiteSetting

    login(client, db, "admin")
    for n in range(3):
        row = write(
            client, "/admin/knowledge-articles", ARTICLE | {"title": f"Inspection guide {n}"}
        ).json()["data"]
        assert (
            write(
                client, "/admin/knowledge-articles/" + row["id"] + "/publish", {"version": 1}
            ).status_code
            == 200
        )
    listing = client.get("/api/v1/knowledge-articles?page_size=2&page=2").json()
    assert listing["meta"] == {"page": 2, "page_size": 2, "total_items": 3, "total_pages": 2}
    assert len(listing["data"]) == 1
    assert client.get("/api/v1/knowledge-articles?page=9").json()["data"] == []
    assert len(client.get("/api/v1/admin/knowledge-articles?status=published").json()["data"]) == 3
    assert client.get("/api/v1/admin/knowledge-articles?status=draft").json()["data"] == []
    audit = list(db.scalars(select(AuditLog).where(AuditLog.action.like("knowledge.%"))))
    assert len(audit) == 6
    assert all("body" not in str(a.after) and "Contact our team" not in str(a.after) for a in audit)
    db.add(SiteSetting(key="provider_secret", value="private sentinel"))
    db.commit()
    assert "private sentinel" not in client.get("/api/v1/admin/settings").text
    assert "private sentinel" not in client.get("/api/v1/public-config").text


@pytest.mark.parametrize("authenticated", [False, True])
def test_request_budget_boundary(client, db, settings, authenticated):
    import hashlib
    import hmac
    from datetime import timedelta

    from app.core.security import now
    from app.models.identity import RateLimit

    actor = login(client, db, "staff" if authenticated else None)
    namespace = "knowledge.write" if authenticated else "knowledge.read"
    subject = str(actor.id) if actor else "127.0.0.1"
    key = hmac.new(
        settings.auth_secret.get_secret_value().encode(),
        f"{namespace}:{subject}".encode(),
        hashlib.sha256,
    ).hexdigest()
    db.add(RateLimit(key=key, count=119, reset_at=now() + timedelta(minutes=10)))
    db.commit()

    def request():
        return (
            write(client, "/admin/knowledge-articles", ARTICLE)
            if authenticated
            else client.get("/api/v1/knowledge-articles")
        )

    assert request().status_code == (201 if authenticated else 200)
    limited = request()
    assert limited.status_code == 429
    assert int(limited.headers["retry-after"]) > 0


def test_atomic_settings_version(engine, client, db):
    from concurrent.futures import ThreadPoolExecutor

    from app.core.database import session_factory
    from app.core.errors import AppError
    from app.schemas.knowledge import SupportSettingsInput
    from app.services.knowledge import set_settings

    actor = login(client, db, "admin")
    actor_id = actor.id

    def attempt():
        with session_factory(engine)() as session:
            try:
                return set_settings(
                    session, actor_id, SupportSettingsInput.model_validate(SETTINGS)
                ).version
            except AppError as error:
                session.rollback()
                return error.code

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: attempt(), range(2)))
    assert sorted(map(str, results)) == ["1", "VERSION_CONFLICT"]
