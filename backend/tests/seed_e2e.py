"""Create one fictional browser fixture in the guarded LOCAL test database."""

import argparse

from app.core.database import make_engine, session_factory
from app.core.security import hasher
from app.models.identity import User
from app.repositories.identity import by_email
from tests.e2e_server import settings

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("email")
    parser.add_argument("role", choices=["client", "staff", "admin"])
    args = parser.parse_args()
    if not args.email.endswith("@example.com") or not args.email.startswith("kofa-e2e-"):
        raise RuntimeError("Only fictional fixture accounts are allowed")
    config = settings()
    engine = make_engine(config.database_url.get_secret_value())
    with session_factory(engine)() as db:
        if not by_email(db, args.email):
            db.add(
                User(
                    email=args.email,
                    full_name=f"Example {args.role.title()}",
                    phone="+2348012345678",
                    role=args.role,
                    password_hash=hasher.hash("Browserpass8!"),
                )
            )
            db.commit()
    engine.dispose()
