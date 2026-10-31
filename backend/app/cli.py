"""Explicit administrator bootstrap and outbox delivery; no default credentials."""

import argparse
import getpass
import sys

from app.core.config import get_settings
from app.core.database import make_engine, session_factory
from app.core.security import hasher
from app.models.identity import User
from app.repositories.identity import by_email
from app.schemas.auth import CreateStaff
from app.services.auth import audit
from app.services.email import send_outbox


def seed_admin(db, email, password, name):
    data = CreateStaff(full_name=name, email=email, role="admin", temporary_password=password)
    existing = by_email(db, str(data.email))
    if existing:
        if existing.role != "admin" or not existing.is_active:
            raise ValueError(
                "Existing account is not an active administrator; refusing to promote it"
            )
        return False
    assert data.temporary_password is not None
    user = User(
        email=str(data.email).lower(),
        full_name=data.full_name,
        role="admin",
        password_hash=hasher.hash(data.temporary_password),
    )
    db.add(user)
    db.flush()
    audit(db, "admin.seeded", user, user, after={"role": "admin"})
    db.commit()
    return True


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("command", choices=["seed-admin", "send-email"])
    args = parser.parse_args()
    settings = get_settings()  # Loads backend/.env through Pydantic settings.
    engine = make_engine(settings.database_url.get_secret_value())
    with session_factory(engine)() as db:
        if args.command == "seed-admin":
            # .env values not exported by dotenv; read through a dedicated settings model.
            from pydantic import SecretStr
            from pydantic_settings import BaseSettings, SettingsConfigDict

            class SeedSettings(BaseSettings):
                model_config = SettingsConfigDict(
                    env_file=".env", extra="ignore", hide_input_in_errors=True
                )
                seed_admin_email: str = ""
                seed_admin_password: SecretStr = SecretStr("")
                seed_admin_name: str = "Kofa Administrator"

            seed = SeedSettings()
            email = seed.seed_admin_email
            password = seed.seed_admin_password.get_secret_value()
            if sys.stdin.isatty():
                email = email or input("Administrator email: ").strip()
                password = password or getpass.getpass(
                    "Administrator password (at least 8 characters): "
                )
            if not email or not password:
                raise SystemExit(
                    "Set SEED_ADMIN_EMAIL and SEED_ADMIN_PASSWORD privately, or run seed-admin interactively."
                )
            created = seed_admin(db, email, password, seed.seed_admin_name)
            print(
                "Administrator created." if created else "Administrator already exists; unchanged."
            )
        else:
            print(f"Processed {send_outbox(db, settings)} queued messages.")
    engine.dispose()


if __name__ == "__main__":
    main()
