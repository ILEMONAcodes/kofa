"""Read a fictional test outbox link, only in the isolated local E2E database."""

import sys

from sqlalchemy import select

from app.core.database import make_engine, session_factory
from app.models.identity import EmailOutbox
from tests.e2e_server import settings

if __name__ == "__main__":
    email, template = sys.argv[1:]
    if not email.endswith("@example.com") or template not in {
        "reset",
        "invitation",
        "verification",
    }:
        raise RuntimeError("Only fictional test recipients are allowed")
    engine = make_engine(settings().database_url.get_secret_value())
    with session_factory(engine)() as db:
        message = db.scalar(
            select(EmailOutbox)
            .where(EmailOutbox.to_email == email, EmailOutbox.template == template)
            .order_by(EmailOutbox.created_at.desc())
        )
        if not message:
            raise RuntimeError("Test email was not queued")
        print(message.payload["link"])
    engine.dispose()
