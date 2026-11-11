"""Scoped ownership, leased conversation turns and atomic daily usage reservations."""

from datetime import timedelta
from zoneinfo import ZoneInfo

from sqlalchemy import false, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert

from app.core.security import now
from app.models.assistant import AssistantMessage, AssistantUsage, Conversation


def owned(db, id, user_id, token_hash, lock=False):
    query = select(Conversation).where(
        Conversation.id == id, Conversation.created_at >= now() - timedelta(days=90)
    )
    query = (
        query.where(Conversation.user_id == user_id)
        if user_id
        else query.where(Conversation.user_id.is_(None), Conversation.anon_token_hash == token_hash)
        if token_hash
        else query.where(false())
    )
    if lock:
        query = query.with_for_update().execution_options(populate_existing=True)
    return db.scalar(query)


def messages(db, id):
    return list(
        db.scalars(
            select(AssistantMessage)
            .where(AssistantMessage.conversation_id == id)
            .order_by(AssistantMessage.created_at, AssistantMessage.id)
        )
    )


def claim(db, id, lease):
    acquired = db.execute(
        update(Conversation)
        .where(
            Conversation.id == id,
            Conversation.status != "closed",
            or_(Conversation.in_flight.is_(None), Conversation.lease_until < now()),
        )
        .values(in_flight=lease, lease_until=now() + timedelta(seconds=60))
        .returning(Conversation.id)
    ).scalar()
    db.commit()
    return acquired is not None


def release(db, id, lease):
    db.execute(
        update(Conversation)
        .where(Conversation.id == id, Conversation.in_flight == lease)
        .values(in_flight=None, lease_until=None)
    )
    db.commit()


def today():
    return now().astimezone(ZoneInfo("Africa/Lagos")).date()


def reserve(db, amount, limit, request_limit):
    day = today()
    db.execute(
        insert(AssistantUsage)
        .values(
            day=day,
            reserved_tokens=0,
            requests=0,
            tokens_in=0,
            tokens_out=0,
            unknown_usage_requests=0,
        )
        .on_conflict_do_nothing(index_elements=["day"])
    )
    acquired = db.execute(
        update(AssistantUsage)
        .where(
            AssistantUsage.day == day,
            AssistantUsage.reserved_tokens + amount <= limit,
            AssistantUsage.requests < request_limit,
        )
        .values(
            reserved_tokens=AssistantUsage.reserved_tokens + amount,
            requests=AssistantUsage.requests + 1,
        )
        .returning(AssistantUsage.day)
    ).scalar()
    db.commit()
    return day if acquired else None


def account(db, day, reply, limit, reservation):
    # Missing usage is visible; failures remain fully reserved, never refunded.
    known = reply is not None and reply.usage_known
    extra = {}
    if known and reply.tokens_in + reply.tokens_out > reservation:
        extra["reserved_tokens"] = func.greatest(AssistantUsage.reserved_tokens, limit)
    db.execute(
        update(AssistantUsage)
        .where(AssistantUsage.day == day)
        .values(
            tokens_in=AssistantUsage.tokens_in + (reply.tokens_in if known else 0),
            tokens_out=AssistantUsage.tokens_out + (reply.tokens_out if known else 0),
            unknown_usage_requests=AssistantUsage.unknown_usage_requests + (0 if known else 1),
            **extra,
        )
    )
    db.commit()
