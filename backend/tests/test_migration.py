from pathlib import Path

from alembic.config import Config
from sqlalchemy import inspect

from alembic import command
from app.cli import seed_admin
from tests.conftest import TEST_URL, register


def test_migration_down_and_up_on_seeded_database(engine, db, client):
    assert register(client).status_code == 201
    seed_admin(db, "admin@example.com", "Goodadmin8!", "Example Admin")
    db.close()
    cfg = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
    cfg.attributes["database_url"] = TEST_URL
    try:
        command.downgrade(cfg, "base")
        assert "users" not in inspect(engine).get_table_names()
    finally:
        command.upgrade(cfg, "head")
    assert {"users", "auth_sessions", "audit_log", "policy_acceptances", "email_outbox"} <= set(
        inspect(engine).get_table_names()
    )
