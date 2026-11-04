"""Public browsing uses real isolated PostgreSQL; no production data or network."""

import uuid
from datetime import UTC, datetime
from decimal import Decimal

import pytest

from app.models.property import (
    Amenity,
    LandlordApproval,
    PropertyAmenity,
    PropertyVerification,
    VerificationCheck,
)
from tests.test_staff_properties import clone
from tests.test_staff_properties import record as record


def publish(db, prop):
    prop.status = "published"
    prop.published_at = datetime.now(UTC)
    prop.latitude = Decimal("9.076543")
    prop.longitude = Decimal("7.475432")
    from tests.test_property_models import staff_record

    actor = staff_record(db)
    v = PropertyVerification(
        property_id=prop.id,
        method="both",
        status="passed",
        is_current=True,
        verified_by=actor.id,
        verified_at=datetime.now(UTC),
    )
    db.add(v)
    db.flush()
    for code in ["identity", "ownership_docs", "location", "price", "features"]:
        db.add(
            VerificationCheck(
                verification_id=v.id, code=code, result="pass", note="PRIVATE CHECK NOTE"
            )
        )
    db.add(
        LandlordApproval(
            property_id=prop.id,
            approved_price_amount=prop.price_amount,
            approved_price_period=prop.price_period,
            description_approved=True,
            method="phone",
            recorded_by=actor.id,
            approved_at=datetime.now(UTC),
        )
    )
    db.commit()


def test_public_privacy_detail_taxonomy_and_gated_photos(db, client, record):
    prop, photo, doc = record
    photo.thumb_key = photo.storage_key
    db.commit()
    publish(db, prop)
    for path in ["/properties", f"/properties/{prop.slug}", "/taxonomy"]:
        r = client.get("/api/v1" + path)
        assert r.status_code == 200, r.text
        text = r.text
        for forbidden in [
            prop.address_line,
            "Fictional Owner",
            "+2348000000000",
            "landlord_id",
            "address_line",
            "documents",
            "storage_key",
            "private/",
            "verified_by",
            "recorded_by",
            "notes",
            "row_version",
            "PRIVATE CHECK NOTE",
            str(doc.id),
            "9.076543",
            "7.475432",
        ]:
            assert forbidden not in text
        assert r.headers["cache-control"] == "no-store"
    detail = client.get(f"/api/v1/properties/{prop.slug}").json()["data"]
    assert detail["approximate_location"] == {"lat": 9.08, "lng": 7.48, "radius_m": 1000}
    assert len(detail["verification"]["scope"]) == 5
    assert client.get(f"/api/v1/property-media/{photo.id}").status_code == 200
    partial = client.get(f"/api/v1/property-media/{photo.id}", headers={"Range": "bytes=0-9"})
    assert partial.status_code == 206
    assert len(partial.content) == 10
    assert client.get(f"/api/v1/property-media/{doc.id}").status_code == 404
    assert client.get(f"/api/v1/property-media/{uuid.uuid4()}").status_code == 404
    assert client.get(f"/api/v1/property-media/{photo.id}?thumbnail=true").status_code == 200
    prop.status = "unpublished"
    db.commit()
    assert client.get("/api/v1/properties").json()["data"] == []
    assert client.get(f"/api/v1/properties/{prop.slug}").status_code == 404
    assert client.get(f"/api/v1/property-media/{photo.id}").status_code == 404


@pytest.mark.parametrize(
    "status",
    [
        "draft",
        "submitted",
        "in_review",
        "changes_requested",
        "approved",
        "unpublished",
        "rejected",
        "archived",
    ],
)
def test_nonpublished_hidden(db, client, record, status):
    prop, _, _ = record
    publish(db, prop)
    prop.status = status
    db.commit()
    assert client.get("/api/v1/properties").json()["meta"]["total_items"] == 0
    assert client.get(f"/api/v1/properties/{prop.slug}").status_code == 404


@pytest.mark.parametrize("change", ["verification", "approval", "price"])
def test_published_still_requires_current_guards(db, client, record, change):
    from sqlalchemy import select

    prop, _, _ = record
    publish(db, prop)
    if change == "verification":
        db.scalar(select(PropertyVerification)).status = "failed"
    elif change == "approval":
        db.scalar(select(LandlordApproval)).superseded_at = datetime.now(UTC)
    else:
        prop.price_amount += 1
    db.commit()
    assert client.get("/api/v1/properties").json()["data"] == []
    assert client.get(f"/api/v1/properties/{prop.slug}").status_code == 404


@pytest.mark.parametrize(
    "query",
    [
        "unknown=1",
        "page=0",
        "page_size=101",
        "sort=title",
        "sort=price,price",
        "price_min=-1",
        "price_min=20&price_max=10",
        "bedrooms_min=4&bedrooms_max=2",
        "property_type=castle",
        "furnishing=wrong",
        "listing_type=lease",
        "availability=wrong",
        "area=unknown",
        "amenities=unknown",
        "page=1&page=2",
        "property_type=house,house",
        "bathrooms_min=21",
        "q=" + ("a" * 151),
    ],
)
def test_invalid_queries(client, query):
    r = client.get("/api/v1/properties?" + query)
    assert r.status_code == 422, r.text
    assert r.json()["error"]["request_id"]


@pytest.mark.parametrize(
    "query,expected",
    [
        ("q=Fictional", 1),
        ("q=NoMatch", 0),
        ("q=%25", 0),
        ("q=_", 0),
        ("listing_type=rent", 1),
        ("listing_type=sale", 0),
        ("property_type=apartment,duplex", 1),
        ("property_type=house", 0),
        ("state=fct", 1),
        ("city=abuja", 1),
        ("city=Lagos", 0),
        ("price_min=350000000&price_max=350000000", 1),
        ("price_min=350000001", 0),
        ("price_max=349999999", 0),
        ("bedrooms_min=3&bedrooms_max=3", 1),
        ("bedrooms_max=2", 0),
        ("bathrooms_min=2", 1),
        ("bathrooms_min=10", 0),
        ("furnishing=furnished,unfurnished", 1),
        ("furnishing=furnished", 0),
        ("availability=available,under_offer", 1),
        ("availability=under_offer", 0),
    ],
)
def test_filters(db, client, record, query, expected):
    prop, _, _ = record
    publish(db, prop)
    r = client.get("/api/v1/properties?" + query)
    assert r.status_code == 200, r.text
    assert r.json()["meta"]["total_items"] == expected


def test_area_amenities_sorts_pagination(db, client, record):
    from app.models.property import Area

    prop, _, _ = record
    publish(db, prop)
    second = clone(db, prop, price_amount=450000000, availability_status="under_offer")
    publish(db, second)
    a = Amenity(code="test-power", label="Power", category="power")
    b = Amenity(code="test-water", label="Water", category="water")
    db.add_all([a, b])
    db.flush()
    db.add_all(
        [
            PropertyAmenity(property_id=prop.id, amenity_id=a.id),
            PropertyAmenity(property_id=prop.id, amenity_id=b.id),
            PropertyAmenity(property_id=second.id, amenity_id=a.id),
        ]
    )
    db.commit()

    def get(q):
        r = client.get("/api/v1/properties?" + q)
        assert r.status_code == 200, r.text
        return r.json()

    slug = db.get(Area, prop.area_id).slug
    assert get("area=" + slug)["meta"]["total_items"] == 1
    assert (
        get("amenities=test-power,test-water&availability=available,under_offer")["meta"][
            "total_items"
        ]
        == 1
    )
    assert (
        get("amenities=test-power&availability=available,under_offer")["meta"]["total_items"] == 2
    )
    assert get("sort=-price&availability=available,under_offer")["data"][0]["id"] == str(second.id)
    assert get("sort=price,-verified_at&availability=available,under_offer")["data"][0][
        "id"
    ] == str(prop.id)
    assert get("page_size=1&availability=available,under_offer")["meta"]["total_pages"] == 2
    assert get("page=99")["data"] == []
    assert client.get("/api/v1/taxonomy?staff=yes").status_code == 422


def test_active_taxonomy_and_visibility_does_not_depend_on_auth(db, client, record):
    from tests.test_staff_properties import login

    prop, _, _ = record
    publish(db, prop)
    for role in ["client", "staff", "admin"]:
        login(client, db, role)
        r = client.get("/api/v1/properties")
        assert r.status_code == 200
        assert r.json()["meta"]["total_items"] == 1
        assert "landlord" not in r.text
    a = Amenity(code="inactive-option", label="Inactive", category="other", is_active=False)
    db.add(a)
    db.commit()
    assert "inactive-option" not in client.get("/api/v1/taxonomy").text


def test_search_plan_and_latency_on_5000_published(db, client, record):
    """Measured local target, not a deployment/4G performance claim."""
    import json
    import time
    from pathlib import Path

    from sqlalchemy import insert, select, text
    from sqlalchemy.dialects import postgresql

    from app.models.property import Property
    from app.repositories.property_public import search_statement

    prop, _, _ = record
    publish(db, prop)
    now = datetime.now(UTC)
    actor_id = db.scalar(select(PropertyVerification.verified_by).limit(1))
    rows = []
    verifications = []
    approvals = []
    for i in range(4999):
        pid = uuid.uuid4()
        rows.append(
            dict(
                id=pid,
                slug=f"perf-{pid}",
                landlord_id=prop.landlord_id,
                area_id=prop.area_id,
                title=f"Performance home {i}",
                description="Fictional performance listing.",
                listing_type="rent",
                property_type="apartment",
                relationship="owner",
                price_amount=100000000 + i,
                price_period="year",
                bedrooms=2,
                bathrooms=2,
                furnishing="unfurnished",
                address_line="Private fixture address",
                status="published",
                published_at=now,
            )
        )
        verifications.append(
            dict(
                property_id=pid,
                method="desk_review",
                status="passed",
                is_current=True,
                verified_by=actor_id,
                verified_at=now,
            )
        )
        approvals.append(
            dict(
                property_id=pid,
                approved_price_amount=100000000 + i,
                approved_price_period="year",
                description_approved=True,
                method="phone",
                recorded_by=actor_id,
                approved_at=now,
            )
        )
    db.execute(insert(Property), rows)
    db.execute(insert(PropertyVerification), verifications)
    db.execute(insert(LandlordApproval), approvals)
    db.commit()
    for table in ["properties", "property_verifications", "property_landlord_approvals"]:
        db.execute(text(f"ANALYZE {table}"))
    stmt = (
        search_statement(
            {"availability": ["available"], "price_min": 100000000, "price_max": 100000010}
        )
        .order_by(Property.published_at.desc(), Property.id)
        .limit(20)
    )
    sql = str(stmt.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True}))
    plan = db.execute(text("EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) " + sql)).scalar()
    Path("/tmp/kofa-public-search-plan.json").write_text(json.dumps(plan, default=str, indent=2))
    assert "Index" in json.dumps(plan)
    samples = []
    for _ in range(21):
        started = time.perf_counter()
        response = client.get("/api/v1/properties?price_min=100000000&price_max=100005000")
        assert response.status_code == 200, response.text
        samples.append((time.perf_counter() - started) * 1000)
    p95 = sorted(samples[1:])[18]
    Path("/tmp/kofa-public-search-performance.json").write_text(
        json.dumps(
            dict(
                rows=5000,
                warm_requests=20,
                p95_ms=round(p95, 2),
                environment="isolated local PostgreSQL + TestClient",
            )
        )
    )
    assert p95 < 500, f"Local API p95 {p95:.1f} ms exceeds target"
