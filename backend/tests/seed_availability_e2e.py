"""Fictional published/stale browser fixture; guarded localhost DB only."""

import json
from datetime import timedelta
from uuid import uuid4

from app.core.database import make_engine, session_factory
from app.core.security import now
from app.services.availability import scan
from tests.browser_property import property_record
from tests.e2e_server import settings
from tests.test_public_properties import publish


def main():
    config = settings()
    engine = make_engine(config.database_url.get_secret_value())
    with session_factory(engine)() as db:
        prop = property_record(
            db,
            title="Availability home " + str(uuid4()),
            last_availability_confirmed_at=now() - timedelta(days=15),
        )
        publish(db, prop)
        data = {"id": str(prop.id), "title": prop.title, "slug": prop.slug}
        scan(db, config)
    engine.dispose()
    print(json.dumps(data))


if __name__ == "__main__":
    main()
