"""Schedule a bounded batch: python -m app.workers.availability --limit 100."""

import argparse

from app.core.config import get_settings
from app.core.database import make_engine, session_factory
from app.services.availability import scan


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=100, choices=range(1, 1001), metavar="1..1000")
    args = parser.parse_args()
    settings = get_settings()
    engine = make_engine(settings.database_url.get_secret_value())
    try:
        with session_factory(engine)() as db:
            print(f"Flagged {scan(db, settings, args.limit)} listings for availability review.")
    finally:
        engine.dispose()


if __name__ == "__main__":
    main()
