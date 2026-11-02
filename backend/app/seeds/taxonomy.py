"""Idempotent reference-data inserts. Existing staff customizations are preserved."""

import uuid

from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.orm import Session

from app.models.property import Amenity, Area

NEIGHBOURHOODS = (
    "Wuse 2",
    "Gwarinpa",
    "Maitama",
    "Asokoro",
    "Jabi",
    "Utako",
    "Garki",
    "Kubwa",
    "Lugbe",
    "Apo",
    "Katampe",
    "Life Camp",
)
AMENITIES = (
    ("generator", "Generator", "utilities"),
    ("borehole", "Borehole / water", "utilities"),
    ("parking", "Parking", "outdoor"),
    ("security", "Security", "security"),
    ("cctv", "CCTV", "security"),
    ("gated_estate", "Gated estate", "security"),
    ("fitted_kitchen", "Fitted kitchen", "interior"),
    ("air_conditioning", "Air conditioning", "interior"),
    ("wardrobe", "Wardrobe", "interior"),
    ("boys_quarters", "Boys’ quarters", "outdoor"),
    ("swimming_pool", "Swimming pool", "recreation"),
    ("gym", "Gym", "recreation"),
    ("waste_disposal", "Waste disposal", "utilities"),
    ("internet_ready", "Internet-ready", "utilities"),
    ("balcony", "Balcony", "outdoor"),
    ("elevator", "Elevator", "access"),
)


def seed_taxonomy(db: Session) -> None:
    for name in NEIGHBOURHOODS:
        slug = "abuja-" + name.lower().replace(" ", "-")
        db.execute(
            insert(Area)
            .values(
                id=uuid.uuid5(uuid.NAMESPACE_URL, f"kofa:area:{slug}"),
                state="FCT",
                city="Abuja",
                neighbourhood=name,
                slug=slug,
            )
            .on_conflict_do_nothing()
        )
    for position, (code, label, category) in enumerate(AMENITIES):
        db.execute(
            insert(Amenity)
            .values(
                id=uuid.uuid5(uuid.NAMESPACE_URL, f"kofa:amenity:{code}"),
                code=code,
                label=label,
                category=category,
                sort_order=position,
            )
            .on_conflict_do_nothing()
        )
    db.commit()
