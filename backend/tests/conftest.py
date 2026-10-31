import os
from pathlib import Path

import pytest
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import text

from alembic import command
from app.core.config import Settings
from app.core.database import make_engine, session_factory
from app.main import create_app

TEST_URL = os.environ.get(
    "TEST_DATABASE_URL", "postgresql://kofa_test@127.0.0.1:55432/kofa_auth_test_utf8"
)


@pytest.fixture(scope="session")
def settings():
    return Settings(
        database_url=TEST_URL,
        auth_secret="test-only-auth-secret-at-least-32-characters",
        app_env="test",
        public_origin="http://testserver",
        cookie_secure=False,
        _env_file=None,
    )


@pytest.fixture(scope="session")
def engine(settings):
    # Never allow test cleanup against a supplied Neon/production URL.
    from sqlalchemy.engine import make_url

    url = make_url(TEST_URL)
    if url.host not in {"127.0.0.1", "localhost"} or not (url.database or "").startswith(
        "kofa_auth_test"
    ):
        raise RuntimeError("Use an isolated local kofa_auth_test* PostgreSQL database for tests")
    os.environ["DATABASE_URL_UNPOOLED"] = TEST_URL
    os.environ["DATABASE_URL"] = TEST_URL
    os.environ["AUTH_SECRET"] = settings.auth_secret.get_secret_value()
    from app.core.config import get_settings

    get_settings.cache_clear()
    cfg = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
    cfg.attributes["database_url"] = TEST_URL
    command.upgrade(cfg, "head")
    value = make_engine(TEST_URL)
    yield value
    value.dispose()


@pytest.fixture(autouse=True)
def clean_database(engine):
    # This cluster was created for this task, holds fictional test data only.
    with engine.begin() as connection:
        connection.execute(
            text(
                "TRUNCATE users, auth_sessions, password_reset_tokens, policy_acceptances, audit_log, email_outbox, auth_rate_limits CASCADE"
            )
        )


@pytest.fixture
def db(engine):
    with session_factory(engine)() as session:
        yield session


@pytest.fixture
def client(settings, engine):
    with TestClient(create_app(settings, engine), client=("127.0.0.1", 12345)) as value:
        yield value


def csrf(client):
    response = client.get("/api/v1/auth/csrf")
    assert response.status_code == 200
    return {"Origin": "http://testserver", "X-CSRF-Token": client.cookies["csrf_token"]}


def post(client, path, payload=None):
    headers = {"Origin": "http://testserver", "X-CSRF-Token": client.cookies.get("csrf_token", "")}
    return client.post("/api/v1" + path, json=payload, headers=headers)


def register(client, email="client@example.com", password="Goodpass8!"):
    csrf(client)
    return post(
        client,
        "/auth/register",
        {
            "full_name": "Example Client",
            "email": email,
            "phone": "+2348012345678",
            "password": password,
            "accepted_policies": [
                {"type": "terms", "version": "draft-v1"},
                {"type": "privacy", "version": "draft-v1"},
            ],
        },
    )
