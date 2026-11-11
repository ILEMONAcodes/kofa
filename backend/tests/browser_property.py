"""Browser-only fixture builder; callers first enforce the local test DB guard."""

from uuid import uuid4

from sqlalchemy import select

from app.models.property import Area, Landlord, Property


def property_record(db, **changes):
    area = db.scalar(select(Area).where(Area.is_active.is_(True)).order_by(Area.id).limit(1))
    if area is None:
        raise RuntimeError("Start the guarded browser fixture server to seed taxonomy first")
    owner = Landlord(full_name="Fictional Owner", phone="+2348000000000")
    db.add(owner)
    db.flush()
    data = dict(
        slug=str(uuid4()),
        area_id=area.id,
        landlord_id=owner.id,
        title="Fictional browser apartment",
        description="Isolated browser fixture property.",
        listing_type="rent",
        property_type="apartment",
        relationship="owner",
        price_amount=350000000,
        price_period="year",
        bedrooms=3,
        bathrooms=2,
        furnishing="unfurnished",
        address_line="Fictional private browser address",
    )
    data.update(changes)
    result = Property(**data)
    db.add(result)
    db.flush()
    return result
