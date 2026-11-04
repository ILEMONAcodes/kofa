"""Fictional public-browse fixtures in a guarded local test database only."""

import json
from datetime import UTC, datetime
from uuid import uuid4

from sqlalchemy import select

from app.core.database import make_engine, session_factory
from app.models.identity import User
from app.models.property import (
    Area,
    Landlord,
    LandlordApproval,
    Property,
    PropertyVerification,
    VerificationCheck,
)
from tests.e2e_server import settings


def main():
    config = settings()
    engine = make_engine(config.database_url.get_secret_value())
    result = []
    with session_factory(engine)() as db:
        area = db.scalar(select(Area).where(Area.is_active.is_(True)).order_by(Area.slug))
        staff = db.scalar(select(User).where(User.role == "staff", User.is_active.is_(True)))
        if not area or not staff:
            raise RuntimeError("Local taxonomy and staff fixture required")
        owner = Landlord(
            full_name="Private Browser Owner",
            phone="+2348099999999",
            email="private-owner@example.com",
        )
        db.add(owner)
        db.flush()
        for i in range(13):
            p = Property(
                slug=f"public-browser-{uuid4()}",
                landlord_id=owner.id,
                area_id=area.id,
                title=f"Courtyard browser home {i + 1:02}",
                description="A bright fictional apartment for isolated browser testing.",
                listing_type="rent",
                property_type="apartment" if i % 2 == 0 else "house",
                relationship="owner",
                price_amount=100000000 + i * 10000000,
                price_period="year",
                bedrooms=1 + i % 4,
                bathrooms=2,
                furnishing="unfurnished",
                address_line="Private exact browser address",
                status="approved",
            )
            db.add(p)
            db.flush()
            v = PropertyVerification(
                property_id=p.id,
                method="both",
                status="passed",
                is_current=True,
                verified_by=staff.id,
                verified_at=datetime.now(UTC),
            )
            db.add(v)
            db.flush()
            for code in ["identity", "ownership_docs", "location", "price", "features"]:
                db.add(VerificationCheck(verification_id=v.id, code=code, result="pass"))
            db.add(
                LandlordApproval(
                    property_id=p.id,
                    approved_price_amount=p.price_amount,
                    approved_price_period="year",
                    description_approved=True,
                    method="phone",
                    recorded_by=staff.id,
                    approved_at=datetime.now(UTC),
                )
            )
            result.append(dict(id=str(p.id), slug=p.slug, title=p.title))
        db.commit()
    engine.dispose()
    print(json.dumps(result))


if __name__ == "__main__":
    main()
