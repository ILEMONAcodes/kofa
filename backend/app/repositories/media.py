"""Upload row queries. Caller holds the property lock until commit/rollback."""

import uuid

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.models.property import Property, PropertyDocument, PropertyMedia


def locked_property(db: Session, property_id: uuid.UUID) -> Property | None:
    return db.scalar(select(Property).where(Property.id == property_id).with_for_update())


def file_counts(db: Session, property_id: uuid.UUID) -> tuple[int, int, int]:
    media = dict(
        db.execute(
            select(PropertyMedia.kind, func.count())
            .where(PropertyMedia.property_id == property_id)
            .group_by(PropertyMedia.kind)
        ).all()
    )
    docs = (
        db.scalar(
            select(func.count())
            .select_from(PropertyDocument)
            .where(PropertyDocument.property_id == property_id)
        )
        or 0
    )
    return media.get("photo", 0), media.get("video", 0), docs
