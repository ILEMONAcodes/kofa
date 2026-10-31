from sqlalchemy import select, update
from sqlalchemy.orm import Session

from app.core.security import digest, now
from app.models.identity import AuthSession, User


def by_email(db: Session, email: str):
    return db.scalar(select(User).where(User.email == email.strip().lower()))


def session_by_token(db: Session, token: str, *, lock=False):
    query = select(AuthSession).where(AuthSession.token_hash == digest(token))
    return db.scalar(query.with_for_update() if lock else query)


def revoke_family(db: Session, family_id):
    db.execute(
        update(AuthSession)
        .where(AuthSession.family_id == family_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=now())
    )


def revoke_user(db: Session, user_id):
    db.execute(
        update(AuthSession)
        .where(AuthSession.user_id == user_id, AuthSession.revoked_at.is_(None))
        .values(revoked_at=now())
    )


def user_by_id(db, user_id):
    return db.get(User, user_id)


def session_by_id(db, session_id):
    return db.get(AuthSession, session_id)


def one_time_token(db, token):
    from app.models.identity import OneTimeToken

    return db.scalar(
        select(OneTimeToken).where(OneTimeToken.token_hash == digest(token)).with_for_update()
    )


def invalidate_links(db, user_id, purposes):
    from app.models.identity import OneTimeToken

    db.execute(
        update(OneTimeToken)
        .where(
            OneTimeToken.user_id == user_id,
            OneTimeToken.purpose.in_(purposes),
            OneTimeToken.used_at.is_(None),
        )
        .values(used_at=now())
    )


def lock_admin_mutations(db):
    from sqlalchemy import text

    db.execute(text("SELECT pg_advisory_xact_lock(72839120)"))


def locked_user(db, user_id):
    return db.scalar(select(User).where(User.id == user_id).with_for_update())


def active_admin_count(db):
    from sqlalchemy import func

    return (
        db.scalar(
            select(func.count())
            .select_from(User)
            .where(User.role == "admin", User.is_active.is_(True))
        )
        or 0
    )


def list_users(db, *, role=None, is_active=None, q=None, sort="-created_at", page=1, page_size=20):
    from sqlalchemy import func, or_

    query = select(User)
    if role:
        query = query.where(User.role == role)
    if is_active is not None:
        query = query.where(User.is_active == is_active)
    if q:
        escaped = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        query = query.where(
            or_(
                User.full_name.ilike(f"%{escaped}%", escape="\\"),
                User.email.ilike(f"%{escaped}%", escape="\\"),
            )
        )
    total = db.scalar(select(func.count()).select_from(query.subquery())) or 0
    column = User.full_name if sort.lstrip("-") == "full_name" else User.created_at
    query = (
        query.order_by(column.desc() if sort.startswith("-") else column.asc(), User.id)
        .offset((page - 1) * page_size)
        .limit(page_size)
    )
    return db.scalars(query).all(), total
