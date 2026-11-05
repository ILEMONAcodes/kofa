"""Advance only an isolated fictional browser appointment into post-visit time."""

import sys
from datetime import timedelta
from uuid import UUID

from app.core.database import make_engine, session_factory
from app.core.security import now
from app.models.appointment import Appointment
from app.models.identity import User
from tests.e2e_server import settings


def main():
    config = settings()  # Enforces localhost and kofa_auth_test* database; never reads .env.
    engine = make_engine(config.database_url.get_secret_value())
    try:
        with session_factory(engine)() as db:
            appointment = db.get(Appointment, UUID(sys.argv[1]))
            if not appointment or appointment.status != "confirmed":
                raise RuntimeError("Use a confirmed fictional appointment.")
            client = db.get(User, appointment.client_id)
            if not client.email.endswith("@example.com"):
                raise RuntimeError("Only fictional test accounts are allowed.")
            # A test clock fixture, not a public API or a product rescheduling path.
            appointment.scheduled_at = now() - timedelta(hours=2)
            appointment.ends_at = appointment.scheduled_at + timedelta(
                minutes=appointment.duration_minutes
            )
            appointment.row_version += 1
            db.commit()
            print("Fictional appointment clock advanced.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
