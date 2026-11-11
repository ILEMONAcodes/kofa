"""Dry-run by default. Purge only unflagged, unlinked transcripts older than 90 days."""

import argparse
from datetime import timedelta

from sqlalchemy import delete, exists, select

from app.core.config import get_settings
from app.core.database import make_engine, session_factory
from app.core.security import now
from app.models.assistant import AssistantFeedback, AssistantMessage, Conversation


def purge(db, apply=False, limit=100):
    rows = list(
        db.scalars(
            select(Conversation)
            .where(
                Conversation.created_at < now() - timedelta(days=90),
                Conversation.flagged.is_(False),
                Conversation.inquiry_id.is_(None),
                Conversation.in_flight.is_(None),
                ~exists(
                    select(AssistantMessage.id).where(
                        AssistantMessage.conversation_id == Conversation.id,
                        AssistantMessage.created_at >= now() - timedelta(days=90),
                    )
                ),
            )
            .order_by(Conversation.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
    )
    ids = [row.id for row in rows]
    if apply and ids:
        messages = select(AssistantMessage.id).where(AssistantMessage.conversation_id.in_(ids))
        db.execute(delete(AssistantFeedback).where(AssistantFeedback.message_id.in_(messages)))
        db.execute(delete(AssistantMessage).where(AssistantMessage.conversation_id.in_(ids)))
        db.execute(delete(Conversation).where(Conversation.id.in_(ids)))
        db.commit()
    else:
        db.rollback()
    return len(ids)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--limit", type=int, default=100)
    args = parser.parse_args()
    if not 1 <= args.limit <= 1000:
        parser.error("limit must be 1..1000")
    settings = get_settings()
    engine = make_engine(settings.database_url.get_secret_value())
    with session_factory(engine)() as db:
        print(
            ("Deleted" if args.apply else "Eligible"),
            purge(db, args.apply, args.limit),
            "expired unflagged/unlinked conversations",
        )


if __name__ == "__main__":
    main()
