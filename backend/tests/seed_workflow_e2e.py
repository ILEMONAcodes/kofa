"""One fictional property in the guarded LOCAL browser database; no remote access."""

from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select

from app.core.database import make_engine, session_factory
from app.models.property import Area, Landlord, Property
from tests.e2e_server import settings


def main():
    config = settings()  # rejects all non-local/non-test database URLs
    engine = make_engine(config.database_url.get_secret_value())
    with session_factory(engine)() as db:
        area = db.scalar(select(Area).where(Area.is_active.is_(True)).limit(1))
        if area is None:
            raise RuntimeError("Seed the local test taxonomy first")
        owner = Landlord(full_name="Workflow Fictional Owner", phone="+2348000000000")
        db.add(owner)
        db.flush()
        prop = Property(
            slug=str(uuid4()),
            area_id=area.id,
            landlord_id=owner.id,
            title="Workflow fictional apartment",
            description="An isolated fictional workflow test listing.",
            listing_type="rent",
            property_type="apartment",
            relationship="owner",
            price_amount=350000000,
            price_period="year",
            bedrooms=3,
            bathrooms=2,
            furnishing="unfurnished",
            address_line="Fictional private address",
            status="submitted",
            submitted_at=datetime.now(UTC),
        )
        db.add(prop)
        db.commit()
        print(prop.id)
    engine.dispose()


if __name__ == "__main__":
    main()
