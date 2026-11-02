"""Actual PostgreSQL constraint/migration tests on the hard-guarded local fixture."""

import uuid
from datetime import UTC, datetime
from pathlib import Path

import pytest
from alembic.autogenerate import compare_metadata
from alembic.config import Config
from alembic.migration import MigrationContext
from alembic.script import ScriptDirectory
from sqlalchemy import func, inspect, select, text
from sqlalchemy.exc import DBAPIError, IntegrityError

from alembic import command
from app.models.identity import Base, PolicyAcceptance, User
from app.models.property import (
    Amenity,
    Area,
    Landlord,
    LandlordApproval,
    Property,
    PropertyDocument,
    PropertyMedia,
    PropertyStatusHistory,
    PropertyVerification,
    VerificationCheck,
)
from app.seeds.taxonomy import AMENITIES, NEIGHBOURHOODS, seed_taxonomy
from tests.conftest import TEST_URL


def property_record(db, **changes):
    area = Area(state="FCT", city="Abuja", neighbourhood="Test District", slug=str(uuid.uuid4()))
    landlord = Landlord(full_name="Fictional Owner", phone="+2348000000000")
    db.add_all([area, landlord])
    db.flush()
    data = dict(
        slug=str(uuid.uuid4()),
        area_id=area.id,
        landlord_id=landlord.id,
        title="Fictional apartment",
        description="An isolated test listing.",
        listing_type="rent",
        property_type="apartment",
        relationship="owner",
        price_amount=350000000,
        price_period="year",
        bedrooms=3,
        bathrooms=2,
        furnishing="unfurnished",
        address_line="Fictional private address",
    )
    data.update(changes)
    prop = Property(**data)
    db.add(prop)
    db.flush()
    return prop


def staff_record(db):
    user = User(
        email=f"{uuid.uuid4()}@example.com",
        password_hash="not-a-real-hash",
        full_name="Test Staff",
        role="staff",
    )
    db.add(user)
    db.flush()
    return user


def media(prop, **changes):
    data = dict(
        property_id=prop.id,
        kind="photo",
        storage_key=str(uuid.uuid4()),
        original_filename="test.jpg",
        mime_type="image/jpeg",
        size_bytes=100,
        uploaded_by="landlord_submission",
    )
    data.update(changes)
    return PropertyMedia(**data)


def test_taxonomy_seed_preserves_customizations(db):
    seed_taxonomy(db)
    area_ids = list(db.scalars(select(Area.id)))
    amenity = db.scalar(select(Amenity).where(Amenity.code == "parking"))
    amenity.label = "Staff-customized parking"
    amenity.is_active = False
    db.commit()
    seed_taxonomy(db)
    assert set(db.scalars(select(Area.id))) == set(area_ids)
    assert db.scalar(select(func.count()).select_from(Area)) == len(NEIGHBOURHOODS)
    assert db.scalar(select(func.count()).select_from(Amenity)) == len(AMENITIES)
    db.refresh(amenity)
    assert amenity.label == "Staff-customized parking" and not amenity.is_active


@pytest.mark.parametrize(
    "changes",
    [
        {"listing_type": "lease"},
        {"property_type": "castle"},
        {"intended_use": "commercial"},
        {"relationship": "stranger"},
        {"price_amount": 0},
        {"currency": "USD"},
        {"listing_type": "sale", "price_period": "year"},
        {"price_period": "one_time"},
        {"bedrooms": 21},
        {"bathrooms": -1},
        {"furnishing": "unknown"},
        {"status": "live"},
        {"availability_status": "occupied"},
        {"row_version": 0},
        {"extra_charges": {}},
        {"latitude": 91},
        {"longitude": 181},
    ],
)
def test_invalid_property_values_rejected(db, changes):
    with pytest.raises(IntegrityError):
        property_record(db, **changes)
    db.rollback()


def test_defaults_bigint_money_and_private_records(db):
    prop = property_record(
        db, listing_type="sale", price_period="one_time", price_amount=5000000000
    )
    assert prop.price_amount == 5000000000 and prop.currency == "NGN"
    assert prop.status == "draft" and prop.row_version == 1 and prop.extra_charges == []
    assert prop.created_at.tzinfo is not None
    db.add(
        PropertyDocument(
            property_id=prop.id,
            kind="ownership_proof",
            storage_key="private/doc.pdf",
            mime_type="application/pdf",
            size_bytes=100,
        )
    )
    db.flush()
    with pytest.raises(IntegrityError):
        db.delete(db.get(Landlord, prop.landlord_id))
        db.flush()
    db.rollback()


@pytest.mark.parametrize(
    "changes",
    [
        {"kind": "pdf"},
        {"size_bytes": 0},
        {"position": -1},
        {"uploaded_by": "public"},
        {"kind": "video", "is_cover": True},
        {"width": -1},
    ],
)
def test_invalid_media_values_rejected(db, changes):
    prop = property_record(db)
    with pytest.raises(IntegrityError):
        db.add(media(prop, **changes))
        db.flush()
    db.rollback()


@pytest.mark.parametrize("fields", [{"is_cover": True}, {"kind": "video"}])
def test_one_cover_and_one_video_per_property(db, fields):
    prop = property_record(db)
    db.add(media(prop, **fields))
    db.flush()
    with pytest.raises(IntegrityError):
        db.add(media(prop, **fields))
        db.flush()
    db.rollback()


def test_landlord_and_user_consents_are_exclusive(db):
    prop = property_record(db)
    user = staff_record(db)
    db.add_all(
        [
            PolicyAcceptance(landlord_id=prop.landlord_id, policy_type="terms", version="draft-v1"),
            PolicyAcceptance(user_id=user.id, policy_type="privacy", version="draft-v1"),
        ]
    )
    db.flush()
    with pytest.raises(IntegrityError):
        db.add(
            PolicyAcceptance(
                user_id=user.id,
                landlord_id=prop.landlord_id,
                policy_type="terms",
                version="draft-v1",
            )
        )
        db.flush()
    db.rollback()
    with pytest.raises(IntegrityError):
        db.add(PolicyAcceptance(policy_type="terms", version="draft-v1"))
        db.flush()
    db.rollback()


def test_unique_current_verification_and_check_codes(db):
    prop = property_record(db)
    user = staff_record(db)
    verify = PropertyVerification(property_id=prop.id, method="desk_review", verified_by=user.id)
    db.add(verify)
    db.flush()
    db.add(VerificationCheck(verification_id=verify.id, code="identity", result="pass"))
    db.flush()
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.add(VerificationCheck(verification_id=verify.id, code="identity", result="fail"))
            db.flush()
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.add(PropertyVerification(property_id=prop.id, method="both", verified_by=user.id))
            db.flush()
    # An older verification can coexist; only current is unique.
    db.add(
        PropertyVerification(
            property_id=prop.id, method="both", verified_by=user.id, is_current=False
        )
    )
    db.flush()


def test_one_active_approval_with_historical_records(db):
    prop = property_record(db)
    user = staff_record(db)
    values = dict(
        property_id=prop.id,
        approved_price_amount=350000000,
        approved_price_period="year",
        description_approved=True,
        method="phone",
        recorded_by=user.id,
        approved_at=datetime.now(UTC),
    )
    db.add(LandlordApproval(**values))
    db.flush()
    with pytest.raises(IntegrityError):
        with db.begin_nested():
            db.add(LandlordApproval(**values))
            db.flush()
    db.add(LandlordApproval(**values, superseded_at=datetime.now(UTC)))
    db.flush()


@pytest.mark.parametrize("operation", ["UPDATE", "DELETE"])
def test_property_history_is_append_only(db, operation):
    prop = property_record(db)
    db.add(PropertyStatusHistory(property_id=prop.id, to_status="draft"))
    db.flush()
    with pytest.raises(DBAPIError, match="append-only"):
        statement = (
            "UPDATE property_status_history SET reason='changed'"
            if operation == "UPDATE"
            else "DELETE FROM property_status_history"
        )
        db.execute(text(statement))
    db.rollback()


def migration_config():
    cfg = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
    cfg.attributes["database_url"] = TEST_URL
    return cfg


def test_property_migration_downgrade_preserves_identity_and_reupgrades(engine, db):
    prop = property_record(db)
    user = staff_record(db)
    user_id = user.id
    db.add(PolicyAcceptance(user_id=user.id, policy_type="terms", version="draft-v1"))
    db.commit()
    # Populate the new graph before downgrade, not just empty DDL.
    db.add_all(
        [
            media(prop),
            PropertyDocument(
                property_id=prop.id,
                kind="ownership_proof",
                storage_key="private/test",
                mime_type="application/pdf",
                size_bytes=100,
            ),
            PropertyStatusHistory(property_id=prop.id, to_status="draft"),
        ]
    )
    db.commit()
    db.close()
    cfg = migration_config()
    try:
        command.downgrade(cfg, "322d42e7e74c")
        assert "properties" not in inspect(engine).get_table_names()
        with engine.connect() as conn:
            assert conn.scalar(select(User.id).where(User.id == user_id)) == user_id
            assert conn.scalar(text("SELECT count(*) FROM policy_acceptances")) == 1
    finally:
        command.upgrade(cfg, "head")
    assert "property_media" in inspect(engine).get_table_names()


def test_downgrade_refuses_to_discard_landlord_consents(engine, db):
    prop = property_record(db)
    db.add(PolicyAcceptance(landlord_id=prop.landlord_id, policy_type="terms", version="draft-v1"))
    db.commit()
    db.close()
    with pytest.raises(DBAPIError, match="landlord consent"):
        command.downgrade(migration_config(), "322d42e7e74c")
    with engine.connect() as conn:
        assert (
            conn.scalar(
                text("SELECT count(*) FROM policy_acceptances WHERE landlord_id IS NOT NULL")
            )
            == 1
        )
        assert (
            conn.scalar(text("SELECT version_num FROM alembic_version"))
            == ScriptDirectory.from_config(migration_config()).get_current_head()
        )


def test_model_metadata_matches_migrated_schema(engine):
    with engine.connect() as conn:
        diffs = compare_metadata(
            MigrationContext.configure(conn, opts={"compare_type": True}), Base.metadata
        )
    assert diffs == []
