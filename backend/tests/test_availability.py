"""Availability lifecycle on fictional guarded localhost data."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch
from uuid import uuid4

import pytest
from pydantic import ValidationError
from sqlalchemy import func, select

from app.core.config import Settings
from app.core.database import session_factory
from app.models.identity import EmailOutbox
from app.schemas.property_admin import AvailabilityInput
from app.services.availability import scan
from app.services.property_admin import availability
from tests.test_inquiries import write
from tests.test_property_models import property_record
from tests.test_staff_properties import clone, login

STAMP = datetime(2030, 5, 20, 12, tzinfo=UTC)


@pytest.fixture
def setup(db, client):
    actor = login(client, db, "staff")
    prop = property_record(
        db, status="published", last_availability_confirmed_at=STAMP - timedelta(days=15)
    )
    db.commit()
    return actor, prop


def test_threshold_queue_filters_and_current_truth(db, client, setup, settings):
    actor, prop = setup
    clone(db, prop, last_availability_confirmed_at=None)
    clone(db, prop, last_availability_confirmed_at=STAMP - timedelta(days=14))
    clone(db, prop, last_availability_confirmed_at=STAMP - timedelta(days=14, microseconds=1))
    clone(db, prop, status="draft", last_availability_confirmed_at=None)
    clone(db, prop, availability_status="unavailable", last_availability_confirmed_at=None)
    db.commit()
    with patch("app.services.availability.now", return_value=STAMP):
        response = client.get("/api/v1/admin/availability-queue?page_size=2")
        assert response.status_code == 200
        assert response.json()["meta"]["total_items"] == 3
        assert len(response.json()["data"]) == 2
        assert response.json()["data"][0]["last_confirmed_at"] is None
        assert client.get("/api/v1/admin/availability-queue?page=8").json()["data"] == []
        assert scan(db, settings) == 3
        assert scan(db, settings) == 0
        assert client.get("/api/v1/admin/availability-queue").json()["meta"]["total_items"] == 3
    db.refresh(prop)
    assert prop.status == "published" and prop.row_version == 1
    assert db.scalar(select(func.count()).select_from(EmailOutbox)) == 0
    with patch("app.services.availability.now", return_value=STAMP):
        changed = settings.model_copy(update={"availability_stale_days": 30})
        from app.services.availability import listing

        assert listing(db, changed, actor.id, 1, 20).meta.total_items == 1


def test_confirmation_clears_queue_and_records_history(db, client, setup, settings):
    actor, prop = setup
    with patch("app.services.availability.now", return_value=STAMP):
        assert scan(db, settings) == 1
        with patch("app.services.property_admin.moment", return_value=STAMP):
            result = write(
                client,
                f"/admin/properties/{prop.id}/availability",
                {
                    "outcome": "available",
                    "note": "Confirmed by phone with the owner.",
                    "version": 1,
                },
                "patch",
            )
        assert result.status_code == 200, result.text
        assert client.get("/api/v1/admin/availability-queue").json()["data"] == []
        assert scan(db, settings) == 0
    history = client.get(f"/api/v1/admin/properties/{prop.id}/availability-history").json()["data"]
    assert len(history) == 1 and history[0]["actor_name"] == actor.full_name
    assert history[0]["outcome"] == "available" and history[0]["confirmed_at"] == STAMP.isoformat()
    with patch("app.services.availability.now", return_value=STAMP + timedelta(days=15)):
        assert scan(db, settings) == 1
        assert scan(db, settings) == 0
    stale = write(
        client,
        f"/admin/properties/{prop.id}/availability",
        {"outcome": "available", "version": 1},
        "patch",
    )
    assert stale.status_code == 409
    assert (
        len(client.get(f"/api/v1/admin/properties/{prop.id}/availability-history").json()["data"])
        == 1
    )


@pytest.mark.parametrize(
    "outcome,kind,status",
    [
        ("let", "rent", "unavailable"),
        ("sold", "sale", "unavailable"),
        ("withdrawn", "rent", "unavailable"),
        ("under_offer", "rent", "under_offer"),
    ],
)
def test_staff_outcomes_preserve_public_enum(db, client, setup, outcome, kind, status):
    _, prop = setup
    prop.listing_type = kind
    prop.price_period = "one_time" if kind == "sale" else "year"
    db.commit()
    response = write(
        client,
        f"/admin/properties/{prop.id}/availability",
        {"outcome": outcome, "version": 1},
        "patch",
    )
    assert response.status_code == 200, response.text
    assert response.json()["data"]["availability_status"] == status
    db.refresh(prop)
    assert prop.status == "published"


@pytest.mark.parametrize(
    "body",
    [
        {"outcome": "sold"},
        {"outcome": "available", "availability_status": "unavailable"},
        {"outcome": "invalid"},
        {"confirmed_at": "2030-05-01T00:00:00Z"},
    ],
)
def test_bad_outcomes_do_not_change_property(db, client, setup, body):
    _, prop = setup
    response = write(
        client, f"/admin/properties/{prop.id}/availability", body | {"version": 1}, "patch"
    )
    assert response.status_code == 422, response.text
    db.refresh(prop)
    assert prop.row_version == 1


@pytest.mark.parametrize(
    "role,expected", [(None, 401), ("client", 403), ("staff", 200), ("admin", 200)]
)
def test_permissions_privacy_and_unknown_history(db, client, role, expected):
    if role:
        login(client, db, role)
    prop = property_record(db, status="published")
    db.commit()
    response = client.get("/api/v1/admin/availability-queue")
    assert response.status_code == expected
    assert response.headers["cache-control"] == "no-store"
    if expected == 200:
        for key in ["address_line", "phone", "email", "documents", "landlord_id"]:
            assert key not in response.text
        assert (
            client.get(f"/api/v1/admin/properties/{uuid4()}/availability-history").status_code
            == 404
        )
        assert client.get("/api/v1/admin/availability-queue?status=published").status_code == 422
    assert (
        client.get(f"/api/v1/admin/properties/{prop.id}/availability-history").status_code
        == expected
    )


def test_skip_locked_batch_and_new_confirmation_cycle(db, client, engine, setup, settings):
    actor, prop = setup
    clone(db, prop, last_availability_confirmed_at=None)
    db.commit()
    from app.repositories.availability import scan_candidates

    with patch("app.services.availability.now", return_value=STAMP):
        with session_factory(engine)() as other:
            assert len(scan_candidates(other, STAMP, 14, 1)) == 1
            assert scan(db, settings, limit=1) == 1
            other.rollback()
        assert scan(db, settings) == 1
        assert scan(db, settings) == 0
        # A legitimate backdated reconfirmation is still stale, but starts a new cycle.
        with patch("app.services.property_admin.moment", return_value=STAMP):
            availability(
                db,
                actor.id,
                prop.id,
                AvailabilityInput(
                    outcome="available", confirmed_at=STAMP - timedelta(days=16), version=1
                ),
            )
        assert scan(db, settings) == 1
        assert scan(db, settings) == 0
    with pytest.raises(ValueError):
        scan(db, settings, 0)


def test_threshold_config_bounds(settings):
    for days in [0, 366]:
        with pytest.raises(ValidationError):
            Settings(**(settings.model_dump() | {"availability_stale_days": days}), _env_file=None)
