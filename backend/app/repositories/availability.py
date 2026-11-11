"""Current computed staleness and append-only audit-backed detection cycles."""

from datetime import timedelta

from sqlalchemy import exists, func, or_, select

from app.models.identity import AuditLog, User
from app.models.property import Property


def stale(as_of, days):
    return or_(
        Property.last_availability_confirmed_at.is_(None),
        Property.last_availability_confirmed_at < as_of - timedelta(days=days),
    )


def eligible(as_of, days):
    return (
        Property.status == "published",
        Property.availability_status.in_(["available", "under_offer"]),
        stale(as_of, days),
    )


def queue(db, as_of, days, page, size, q=None, assigned_to=None):
    conditions = list(eligible(as_of, days))
    if q:
        literal = q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        conditions.append(Property.title.ilike("%" + literal + "%", escape="\\"))
    if assigned_to:
        conditions.append(Property.assigned_staff_id == assigned_to)
    total = db.scalar(select(func.count()).select_from(Property).where(*conditions)) or 0
    rows = db.execute(
        select(Property, User.full_name)
        .outerjoin(User, User.id == Property.assigned_staff_id)
        .where(*conditions)
        .order_by(Property.last_availability_confirmed_at.asc().nulls_first(), Property.id)
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    return rows, total


def scan_candidates(db, as_of, days, limit):
    from sqlalchemy import String, cast

    # Confirmation version, not wall-clock ordering, identifies a new cycle.
    latest = (
        select(cast(AuditLog.id, String))
        .where(
            AuditLog.entity_type == "property",
            AuditLog.entity_id == Property.id,
            AuditLog.action == "property.availability_confirmed",
        )
        .order_by(
            AuditLog.after["version"].as_integer().desc().nulls_last(),
            AuditLog.created_at.desc(),
            AuditLog.id.desc(),
        )
        .limit(1)
        .correlate(Property)
        .scalar_subquery()
    )
    cycle = func.coalesce(latest, cast(Property.last_availability_confirmed_at, String), "never")
    recorded = exists(
        select(AuditLog.id).where(
            AuditLog.entity_type == "property",
            AuditLog.entity_id == Property.id,
            AuditLog.action == "property.availability_stale",
            AuditLog.after["cycle_id"].astext == cycle,
        )
    ).correlate(Property)
    return db.execute(
        select(Property, cycle.label("cycle_id"))
        .where(*eligible(as_of, days), ~recorded)
        .order_by(Property.id)
        .with_for_update(of=Property, skip_locked=True)
        .limit(limit)
    ).all()


def history(db, property_id):
    return db.execute(
        select(AuditLog, User.full_name)
        .outerjoin(User, User.id == AuditLog.actor_user_id)
        .where(
            AuditLog.entity_type == "property",
            AuditLog.entity_id == property_id,
            AuditLog.action == "property.availability_confirmed",
        )
        .order_by(
            AuditLog.after["version"].as_integer().desc().nulls_last(),
            AuditLog.created_at.desc(),
            AuditLog.id,
        )
        .limit(50)
    ).all()
