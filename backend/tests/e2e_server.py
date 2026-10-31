"""Local-only real PostgreSQL/FastAPI fixture server. Never runs on Neon."""

import os
from pathlib import Path

import uvicorn
from alembic.config import Config
from sqlalchemy import text
from sqlalchemy.engine import make_url

from alembic import command
from app.core.config import Settings, get_settings
from app.core.database import make_engine
from app.main import create_app

TEST_URL = os.environ.get(
    "KOFA_E2E_DATABASE_URL", "postgresql://kofa_test@127.0.0.1:55432/kofa_auth_test_e2e"
)
SECRET = "e2e-only-auth-secret-with-at-least-32-characters"


def settings():
    url = make_url(TEST_URL)
    if url.host not in {"127.0.0.1", "localhost"} or not (url.database or "").startswith(
        "kofa_auth_test"
    ):
        raise RuntimeError("E2E fixtures require a dedicated local kofa_auth_test* database")
    return Settings(
        database_url=TEST_URL,
        database_url_unpooled=TEST_URL,
        auth_secret=SECRET,
        public_origin="http://127.0.0.1:3100",
        app_env="test",
        cookie_secure=False,
        _env_file=None,
    )


def main():
    config = settings()
    os.environ.update(DATABASE_URL=TEST_URL, DATABASE_URL_UNPOOLED=TEST_URL, AUTH_SECRET=SECRET)
    get_settings.cache_clear()
    cfg = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
    cfg.attributes["database_url"] = TEST_URL
    command.upgrade(cfg, "head")
    engine = make_engine(TEST_URL)
    with engine.begin() as conn:
        conn.execute(
            text(
                "TRUNCATE users, auth_sessions, password_reset_tokens, policy_acceptances, audit_log, email_outbox, auth_rate_limits CASCADE"
            )
        )
    uvicorn.run(
        create_app(config, engine),
        host="127.0.0.1",
        port=8000,
        access_log=False,
        proxy_headers=True,
        forwarded_allow_ips="127.0.0.1",
    )


if __name__ == "__main__":
    main()
