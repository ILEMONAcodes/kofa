"""Maintenance does not change publication, fees or email delivery."""

from app.core.errors import AppError
from app.core.security import now
from app.models.identity import AuditLog
from app.repositories import availability as repo
from app.repositories.media import locked_property
from app.schemas import availability as s
from app.services.media import current_staff


def listing(db, settings, actor_id, page, size, q=None, assigned_to=None):
    current_staff(db, actor_id)
    as_of = now()
    rows, total = repo.queue(
        db, as_of, settings.availability_stale_days, page, size, q, assigned_to
    )
    return s.AvailabilityQueue(
        data=[
            s.AvailabilityQueueItem(
                id=p.id,
                title=p.title,
                listing_type=p.listing_type,
                availability_status=p.availability_status,
                last_confirmed_at=p.last_availability_confirmed_at,
                version=p.row_version,
                assigned_staff=name,
            )
            for p, name in rows
        ],
        meta=s.AvailabilityQueueMeta(
            page=page,
            page_size=size,
            total_items=total,
            total_pages=(total + size - 1) // size,
            threshold_days=settings.availability_stale_days,
            as_of=as_of,
        ),
    )


def history(db, actor_id, property_id):
    current_staff(db, actor_id)
    # Lock while reading to serialize against confirmation writes.
    if locked_property(db, property_id) is None:
        raise AppError(404, "NOT_FOUND", "Property not found.")
    result = []
    for event, name in repo.history(db, property_id):
        after = event.after or {}
        result.append(
            s.AvailabilityConfirmation(
                id=event.id,
                recorded_at=event.created_at,
                confirmed_at=after.get("confirmed_at"),
                actor_name=name,
                availability_status=after.get("availability_status"),
                outcome=after.get("outcome"),
                note=after.get("note"),
            )
        )
    return s.AvailabilityHistory(data=result)


def scan(db, settings, limit=100):
    if not 1 <= limit <= 1000:
        raise ValueError("Batch size must be between 1 and 1000")
    as_of = now()
    rows = repo.scan_candidates(db, as_of, settings.availability_stale_days, limit)
    for prop, cycle in rows:
        db.add(
            AuditLog(
                entity_type="property",
                entity_id=prop.id,
                action="property.availability_stale",
                after={
                    "cycle_id": cycle,
                    "threshold_days": settings.availability_stale_days,
                    "last_confirmed_at": prop.last_availability_confirmed_at.isoformat()
                    if prop.last_availability_confirmed_at
                    else None,
                },
                created_at=as_of,
            )
        )
    db.commit()
    return len(rows)
