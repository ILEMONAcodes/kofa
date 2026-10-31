from datetime import timedelta

from sqlalchemy import case
from sqlalchemy.dialects.postgresql import insert

from app.models.identity import RateLimit


def increment(db, key, moment, seconds):
    statement = insert(RateLimit).values(
        key=key, count=1, reset_at=moment + timedelta(seconds=seconds)
    )
    expired = RateLimit.reset_at <= moment
    returning = statement.on_conflict_do_update(
        index_elements=[RateLimit.key],
        set_={
            "count": case((expired, 1), else_=RateLimit.count + 1),
            "reset_at": case(
                (expired, moment + timedelta(seconds=seconds)), else_=RateLimit.reset_at
            ),
        },
    ).returning(RateLimit.count, RateLimit.reset_at)
    return db.execute(returning).one()
