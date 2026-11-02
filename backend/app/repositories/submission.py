import uuid

from sqlalchemy import func, or_, select, text
from sqlalchemy.orm import Session

from app.models.property import Amenity, Area, Landlord, PropertyDocument, PropertyMedia


def active_area(db: Session, area_id: uuid.UUID):
    return db.scalar(select(Area).where(Area.id == area_id, Area.is_active.is_(True)))


def active_amenities(db: Session, codes: list[str]):
    return list(
        db.scalars(select(Amenity).where(Amenity.code.in_(codes), Amenity.is_active.is_(True)))
    )


def blocked_contact(db: Session, phone: str, email: str | None) -> bool:
    match = Landlord.phone == phone
    if email:
        match = or_(match, Landlord.email == email)
    return (
        db.scalar(select(Landlord.id).where(match, Landlord.blocked_at.is_not(None)).limit(1))
        is not None
    )


def next_reference(db: Session, year: int) -> str:
    sequence = db.scalar(text("SELECT nextval('landlord_submission_reference_seq')"))
    return f"SUB-{year}-{sequence:06d}"


def property_file(db: Session, property_id: uuid.UUID, file_id: uuid.UUID):
    row = db.scalar(
        select(PropertyMedia).where(
            PropertyMedia.id == file_id, PropertyMedia.property_id == property_id
        )
    )
    return row or db.scalar(
        select(PropertyDocument).where(
            PropertyDocument.id == file_id, PropertyDocument.property_id == property_id
        )
    )


def evidence_count(db: Session, property_id: uuid.UUID) -> int:
    return (
        db.scalar(
            select(func.count())
            .select_from(PropertyDocument)
            .where(
                PropertyDocument.property_id == property_id,
                PropertyDocument.kind.in_(["ownership_proof", "authorization_letter"]),
            )
        )
        or 0
    )
