"""Contract-derived role/privacy/concurrency tests, fictional local records only."""

import io
import uuid
from concurrent.futures import ThreadPoolExecutor
from datetime import UTC, datetime, timedelta
from urllib.parse import urlsplit

import pytest
from PIL import Image
from sqlalchemy import func, select

from app.core.database import session_factory
from app.core.errors import AppError
from app.core.security import hasher
from app.models.identity import AuditLog, User
from app.models.property import (
    Area,
    LandlordApproval,
    Property,
    PropertyDocument,
    PropertyMedia,
    PropertyVerification,
    VerificationCheck,
)
from app.schemas.property_admin import PropertyPatch
from app.services.property_admin import edit
from app.services.storage import LocalStorage
from tests.conftest import csrf
from tests.test_property_models import property_record


def login(client, db, role):
    csrf(client)
    if role is None:
        return None
    user = User(
        email=f"{uuid.uuid4()}@example.com",
        password_hash=hasher.hash("Goodpass8!"),
        full_name="Fictional Staff",
        phone="+2348000000001",
        role=role,
    )
    db.add(user)
    db.commit()
    response = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "Goodpass8!"},
        headers=h(client),
    )
    assert response.status_code == 200
    return user


def h(client):
    return {"Origin": "http://testserver", "X-CSRF-Token": client.cookies.get("csrf_token", "")}


def jpeg():
    result = io.BytesIO()
    Image.new("RGB", (50, 40), "brown").save(result, "JPEG")
    return result.getvalue()


@pytest.fixture
def record(db, client, tmp_path):
    prop = property_record(db, status="submitted", submitted_at=datetime.now(UTC))
    store = LocalStorage(tmp_path, "file-test-secret-at-least-32-characters")
    client.app.state.storage = store
    photo = PropertyMedia(
        property_id=prop.id,
        kind="photo",
        storage_key=f"private/{uuid.uuid4()}.jpg",
        original_filename="room.jpg",
        mime_type="image/jpeg",
        size_bytes=len(jpeg()),
        is_cover=True,
        uploaded_by="landlord_submission",
    )
    doc = PropertyDocument(
        property_id=prop.id,
        kind="ownership_proof",
        storage_key=f"private/{uuid.uuid4()}.pdf",
        mime_type="application/pdf",
        size_bytes=12,
        review_note="Private evidence note",
    )
    db.add_all([photo, doc])
    db.commit()
    store.put(photo.storage_key, io.BytesIO(jpeg()), "image/jpeg")
    store.put(doc.storage_key, io.BytesIO(b"private-test"), "application/pdf")
    return prop, photo, doc


def clone(db, prop, **changes):
    values = {
        name: getattr(prop, name)
        for name in [
            "landlord_id",
            "area_id",
            "title",
            "description",
            "listing_type",
            "property_type",
            "relationship",
            "price_amount",
            "currency",
            "price_period",
            "bedrooms",
            "bathrooms",
            "furnishing",
            "address_line",
            "status",
        ]
    }
    values.update(slug=str(uuid.uuid4()), **changes)
    result = Property(**values)
    db.add(result)
    db.commit()
    return result


@pytest.mark.parametrize("role", [None, "client", "staff", "admin"])
@pytest.mark.parametrize(
    "operation",
    [
        "queue",
        "detail",
        "edit",
        "assign",
        "availability",
        "upload",
        "media_patch",
        "media_delete",
        "landlords",
        "landlord",
        "file",
    ],
)
def test_every_staff_route_requires_current_staff_or_admin(client, db, record, role, operation):
    prop, photo, doc = record
    actor = login(client, db, role)
    base = f"/api/v1/admin/properties/{prop.id}"
    if operation == "queue":
        response = client.get("/api/v1/admin/properties")
    elif operation == "detail":
        response = client.get(base)
    elif operation == "edit":
        response = client.patch(
            base, json={"title": "Updated fictional apartment", "version": 1}, headers=h(client)
        )
    elif operation == "assign":
        response = client.post(
            base + "/assign", json={"staff_id": str(actor.id) if actor else None}, headers=h(client)
        )
    elif operation == "availability":
        response = client.patch(
            base + "/availability", json={"availability_status": "under_offer"}, headers=h(client)
        )
    elif operation == "upload":
        response = client.post(
            base + "/media",
            headers=h(client),
            data={"kind": "photo"},
            files={"file": ("new.jpg", jpeg(), "image/jpeg")},
        )
    elif operation == "media_patch":
        response = client.patch(
            base + f"/media/{photo.id}", json={"alt": "Living room"}, headers=h(client)
        )
    elif operation == "media_delete":
        response = client.delete(base + f"/media/{photo.id}", headers=h(client))
    elif operation == "landlords":
        response = client.get("/api/v1/admin/landlords")
    elif operation == "landlord":
        response = client.get(f"/api/v1/admin/landlords/{prop.landlord_id}")
    else:
        grant = client.app.state.storage.signed_read(doc.storage_key)
        response = client.get(base + f"/files/{doc.id}", params={"token": grant.token})
    expected = (
        401
        if role is None
        else 403
        if role == "client"
        else 201
        if operation == "upload"
        else 204
        if operation == "media_delete"
        else 200
    )
    assert response.status_code == expected, response.text
    if role in {None, "client"}:
        assert "private-test" not in response.text and "Private evidence note" not in response.text
        assert (
            "Fictional private address" not in response.text and "storage_key" not in response.text
        )


def test_detail_has_explicit_private_metadata_and_expiring_urls(client, db, record):
    prop, photo, doc = record
    actor = login(client, db, "staff")
    verify = PropertyVerification(
        property_id=prop.id,
        method="desk_review",
        status="passed",
        verified_by=actor.id,
        verified_at=datetime.now(UTC),
    )
    db.add(verify)
    db.flush()
    db.add(VerificationCheck(verification_id=verify.id, code="identity", result="pass"))
    db.commit()
    data = client.get(f"/api/v1/admin/properties/{prop.id}").json()["data"]
    assert (
        data["landlord"]["phone"] == "+2348000000000"
        and data["address_line"] == "Fictional private address"
    )
    assert data["verification_history"][0]["checks"][0]["code"] == "identity"
    assert data["is_verified"] and data["verification"]["scope"] == ["identity"]
    assert "storage_key" not in str(data) and "password_hash" not in str(data)
    link = data["documents"][0]["signed_url"]
    parsed = urlsplit(link)
    assert parsed.netloc == "testserver" and data["documents"][0]["expires_at"]
    response = client.get(parsed.path + "?" + parsed.query)
    assert response.status_code == 200 and response.content == b"private-test"
    assert "attachment" in response.headers["Content-Disposition"]
    assert response.headers["Cache-Control"] == "no-store"
    assert (
        db.scalar(
            select(func.count())
            .select_from(AuditLog)
            .where(AuditLog.action == "property.private_file_downloaded")
        )
        == 1
    )


def test_queue_comma_filters_pagination_sort_and_stale_boundary(client, db, record):
    prop, _, _ = record
    login(client, db, "staff")
    prop.last_availability_confirmed_at = datetime.now(UTC) - timedelta(days=20)
    db.commit()
    fresh = clone(
        db,
        prop,
        status="in_review",
        last_availability_confirmed_at=datetime.now(UTC),
        submitted_at=datetime.now(UTC),
    )
    stale = client.get(
        "/api/v1/admin/properties",
        params={
            "status": "submitted,in_review",
            "stale_availability": "true",
            "sort": "-updated_at,submitted_at",
            "page_size": 1,
        },
    ).json()
    assert stale["meta"] == {"page": 1, "page_size": 1, "total_items": 1, "total_pages": 1}
    assert stale["data"][0]["id"] == str(prop.id)
    fresh_result = client.get(
        "/api/v1/admin/properties", params={"stale_availability": "false"}
    ).json()
    assert fresh_result["data"][0]["id"] == str(fresh.id)
    assert client.get("/api/v1/admin/properties?page=3&page_size=1").json()["data"] == []
    assert client.get("/api/v1/admin/properties?q=not-a-match").json()["meta"]["total_pages"] == 0


@pytest.mark.parametrize(
    "query",
    [
        "unknown=value",
        "sort=price",
        "sort=-updated_at,updated_at",
        "status=unknown",
        "status=submitted,submitted",
        "page=0",
        "page_size=101",
        "assigned_to=bad",
        "listing_type=lease",
        "stale_availability=invalid",
        "status=submitted&status=in_review",
    ],
)
def test_invalid_staff_queue_queries_rejected(client, db, record, query):
    login(client, db, "staff")
    response = client.get("/api/v1/admin/properties?" + query)
    assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"


def test_queue_filters_for_area_assignee_listing_and_landlord(client, db, record):
    prop, _, _ = record
    actor = login(client, db, "staff")
    prop.assigned_staff_id = actor.id
    db.commit()
    clone(
        db,
        prop,
        status="draft",
        listing_type="sale",
        price_period="one_time",
        assigned_staff_id=None,
    )
    area = db.get(Area, prop.area_id)
    response = client.get(
        "/api/v1/admin/properties",
        params={
            "area": area.slug,
            "assigned_to": str(actor.id),
            "listing_type": "rent",
            "landlord_id": str(prop.landlord_id),
            "q": "Test District",
        },
    )
    assert response.status_code == 200 and response.json()["meta"]["total_items"] == 1
    assert response.json()["data"][0]["assigned_staff"]["id"] == str(actor.id)
    assert client.get("/api/v1/admin/properties?q=%25").json()["data"] == []


@pytest.mark.parametrize(
    "change",
    [
        {"description": "Changed description approved by nobody yet."},
        {"price": {"amount": 400000000, "currency": "NGN", "period": "year"}},
    ],
)
def test_price_or_description_invalidates_approval_but_not_verification(client, db, record, change):
    prop, _, _ = record
    actor = login(client, db, "staff")
    approval = LandlordApproval(
        property_id=prop.id,
        approved_price_amount=prop.price_amount,
        approved_price_period="year",
        description_approved=True,
        method="phone",
        recorded_by=actor.id,
        approved_at=datetime.now(UTC),
    )
    verify = PropertyVerification(
        property_id=prop.id,
        status="passed",
        method="desk_review",
        verified_by=actor.id,
        verified_at=datetime.now(UTC),
    )
    db.add_all([approval, verify])
    db.commit()
    response = client.patch(
        f"/api/v1/admin/properties/{prop.id}", json={"version": 1, **change}, headers=h(client)
    )
    assert response.status_code == 200 and response.json()["data"]["approval_invalidated"]
    db.refresh(approval)
    db.refresh(verify)
    assert approval.superseded_at and verify.status == "passed" and verify.is_current
    response = client.patch(
        f"/api/v1/admin/properties/{prop.id}",
        json={"version": 1, "title": "Outdated editor title"},
        headers=h(client),
    )
    assert response.status_code == 409 and response.json()["error"]["code"] == "VERSION_CONFLICT"


def test_unrelated_edit_keeps_approval_and_readonly_fields_rejected(client, db, record):
    prop, _, _ = record
    actor = login(client, db, "staff")
    approval = LandlordApproval(
        property_id=prop.id,
        approved_price_amount=prop.price_amount,
        approved_price_period="year",
        description_approved=True,
        method="phone",
        recorded_by=actor.id,
        approved_at=datetime.now(UTC),
    )
    db.add(approval)
    db.commit()
    response = client.patch(
        f"/api/v1/admin/properties/{prop.id}", json={"version": 1, "bedrooms": 4}, headers=h(client)
    )
    assert response.status_code == 200 and not response.json()["data"]["approval_invalidated"]
    db.refresh(approval)
    assert approval.superseded_at is None
    for changes in [
        {"status": "published"},
        {"landlord_id": str(uuid.uuid4())},
        {"title": None},
        {"price": {"amount": True, "currency": "NGN", "period": "year"}},
        {"listing_type": "sale"},
    ]:
        assert (
            client.patch(
                f"/api/v1/admin/properties/{prop.id}",
                json={"version": 2, **changes},
                headers=h(client),
            ).status_code
            == 422
        )


def test_live_detail_edit_requires_unpublish_but_availability_can_update(client, db, record):
    prop, _, _ = record
    login(client, db, "staff")
    prop.status = "published"
    db.commit()
    base = f"/api/v1/admin/properties/{prop.id}"
    assert (
        client.patch(
            base,
            json={"version": 1, "description": "This must not be silently published."},
            headers=h(client),
        ).status_code
        == 409
    )
    assert (
        client.patch(
            base + "/availability",
            json={"availability_status": "unavailable", "version": 1},
            headers=h(client),
        ).status_code
        == 200
    )


def test_assignment_validation_and_availability_timestamps(client, db, record):
    prop, _, _ = record
    actor = login(client, db, "staff")
    base = f"/api/v1/admin/properties/{prop.id}"
    assert (
        client.post(
            base + "/assign", json={"staff_id": str(actor.id), "version": 1}, headers=h(client)
        ).status_code
        == 200
    )
    db.refresh(prop)
    assert prop.assigned_staff_id == actor.id and prop.row_version == 2
    response = client.patch(
        base + "/availability",
        json={"availability_status": "under_offer", "version": 2},
        headers=h(client),
    )
    assert response.status_code == 200 and response.json()["data"]["last_availability_confirmed_at"]
    for stamp in ["2026-01-01T00:00:00", (datetime.now(UTC) + timedelta(days=1)).isoformat()]:
        assert (
            client.patch(
                base + "/availability",
                json={"availability_status": "available", "confirmed_at": stamp},
                headers=h(client),
            ).status_code
            == 422
        )
    assert (
        client.post(
            base + "/assign", json={"staff_id": str(uuid.uuid4())}, headers=h(client)
        ).status_code
        == 422
    )
    assert (
        client.post(base + "/assign", json={"staff_id": None}, headers=h(client)).status_code == 200
    )


def test_media_cross_property_and_cover_selection(client, db, record):
    prop, photo, _ = record
    login(client, db, "staff")
    other = clone(db, prop)
    base = f"/api/v1/admin/properties/{prop.id}"
    assert (
        client.patch(
            f"/api/v1/admin/properties/{other.id}/media/{photo.id}",
            json={"alt": "Wrong property"},
            headers=h(client),
        ).status_code
        == 404
    )
    response = client.post(
        base + "/media",
        data={"kind": "photo"},
        files={"file": ("room.jpg", jpeg(), "image/jpeg")},
        headers=h(client),
    )
    assert response.status_code == 201
    new_id = response.json()["data"]["file_id"]
    response = client.patch(
        base + f"/media/{new_id}",
        json={"is_cover": True, "alt": "New living room", "position": 0},
        headers=h(client),
    )
    assert response.status_code == 200
    db.expire_all()
    assert not db.get(PropertyMedia, photo.id).is_cover
    assert db.get(PropertyMedia, uuid.UUID(new_id)).is_cover
    assert client.delete(base + f"/media/{new_id}", headers=h(client)).status_code == 204
    db.expire_all()
    assert db.get(PropertyMedia, photo.id).is_cover


def test_document_link_cannot_be_reused_for_another_file(client, db, record):
    prop, photo, doc = record
    login(client, db, "staff")
    grant = client.app.state.storage.signed_read(doc.storage_key)
    response = client.get(
        f"/api/v1/admin/properties/{prop.id}/files/{photo.id}", params={"token": grant.token}
    )
    assert response.status_code == 404
    response = client.get(
        f"/api/v1/admin/properties/{prop.id}/files/{doc.id}", params={"token": grant.token + "x"}
    )
    assert response.status_code == 404


def test_role_deactivation_blocks_existing_private_links(client, db, record):
    prop, _, doc = record
    actor = login(client, db, "staff")
    grant = client.app.state.storage.signed_read(doc.storage_key)
    actor.is_active = False
    db.commit()
    assert client.get(f"/api/v1/admin/properties/{prop.id}").status_code == 401
    assert (
        client.get(
            f"/api/v1/admin/properties/{prop.id}/files/{doc.id}", params={"token": grant.token}
        ).status_code
        == 401
    )


def test_landlord_directory_search_and_private_properties(client, db, record):
    prop, _, _ = record
    login(client, db, "staff")
    response = client.get("/api/v1/admin/landlords?q=Fictional")
    assert response.status_code == 200 and response.json()["meta"]["total_items"] == 1
    assert response.json()["data"][0]["phone"] == "+2348000000000"
    response = client.get(f"/api/v1/admin/landlords/{prop.landlord_id}")
    assert response.status_code == 200 and response.json()["data"]["properties"][0]["id"] == str(
        prop.id
    )
    assert client.get("/api/v1/admin/landlords?unknown=true").status_code == 422
    assert client.get(f"/api/v1/admin/landlords/{uuid.uuid4()}").status_code == 404


def test_concurrent_edits_only_one_version_wins(client, db, engine, record):
    prop, _, _ = record
    actor = login(client, db, "staff")
    factory = session_factory(engine)
    property_id, actor_id = prop.id, actor.id

    def change(index):
        with factory() as session:
            try:
                edit(
                    session,
                    actor_id,
                    property_id,
                    PropertyPatch(version=1, title=f"Concurrent title {index}"),
                )
                return 200
            except AppError as error:
                return error.status

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(change, range(2)))
    assert sorted(results) == [200, 409]


def test_staff_mutations_require_csrf_and_bound_json(client, db, record):
    prop, _, _ = record
    login(client, db, "staff")
    base = f"/api/v1/admin/properties/{prop.id}"
    assert client.patch(base, json={"version": 1, "title": "No CSRF update"}).status_code == 403
    response = client.patch(
        base, json={"version": 1, "description": "a" * 70000}, headers=h(client)
    )
    assert response.status_code == 413


def test_staff_upload_rejects_mistyped_file(client, db, record):
    prop, _, _ = record
    login(client, db, "staff")
    response = client.post(
        f"/api/v1/admin/properties/{prop.id}/media",
        data={"kind": "photo"},
        files={"file": ("bad.jpg", b"executable", "image/jpeg")},
        headers=h(client),
    )
    assert response.status_code == 415


def test_optional_empty_strings_clear_without_invalidating_approval(client, db, record):
    prop, photo, _ = record
    login(client, db, "staff")
    prop.address_hint = "Old hint"
    prop.payment_terms = "Old terms"
    db.commit()
    base = f"/api/v1/admin/properties/{prop.id}"
    response = client.patch(
        base,
        json={"version": 1, "address_hint": " ", "payment_terms": "", "latitude": ""},
        headers=h(client),
    )
    assert response.status_code == 200
    db.refresh(prop)
    assert prop.address_hint is None and prop.payment_terms is None and prop.latitude is None
    assert (
        client.patch(base + f"/media/{photo.id}", json={"alt": ""}, headers=h(client)).status_code
        == 200
    )
    db.refresh(photo)
    assert photo.alt_text is None


def test_client_or_inactive_assignee_rejected(client, db, record):
    prop, _, _ = record
    login(client, db, "staff")
    for role, active in [("client", True), ("staff", False)]:
        target = User(
            email=f"{uuid.uuid4()}@example.com",
            password_hash="unused",
            full_name="Fictional target",
            phone="+2348000000002",
            role=role,
            is_active=active,
        )
        db.add(target)
        db.commit()
        response = client.post(
            f"/api/v1/admin/properties/{prop.id}/assign",
            json={"staff_id": str(target.id)},
            headers=h(client),
        )
        assert response.status_code == 422


def test_database_role_change_blocks_old_staff_session(client, db, record):
    prop, _, _ = record
    actor = login(client, db, "staff")
    actor.role = "client"
    db.commit()
    response = client.get(f"/api/v1/admin/properties/{prop.id}")
    assert response.status_code == 403 and "address_line" not in response.text


def test_media_delete_durably_queues_storage_failure(client, db, record):
    from unittest.mock import Mock

    from app.models.property import StorageDeletion

    prop, photo, _ = record
    photo_id = photo.id
    login(client, db, "staff")
    client.app.state.storage.delete = Mock(
        side_effect=AppError(503, "SERVICE_UNAVAILABLE", "Unavailable")
    )
    assert (
        client.delete(
            f"/api/v1/admin/properties/{prop.id}/media/{photo.id}", headers=h(client)
        ).status_code
        == 204
    )
    assert db.scalar(select(func.count()).select_from(StorageDeletion)) == 1
    db.expire_all()
    assert db.get(PropertyMedia, photo_id) is None


def test_queue_select_count_does_not_grow_per_property(client, db, engine, record):
    from sqlalchemy import event

    prop, _, _ = record
    login(client, db, "staff")
    for _ in range(8):
        clone(db, prop)
    selects = []

    def record_select(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            selects.append(statement)

    event.listen(engine, "before_cursor_execute", record_select)
    try:
        assert client.get("/api/v1/admin/properties?page_size=1").status_code == 200
        count_one = len(selects)
        selects.clear()
        assert client.get("/api/v1/admin/properties?page_size=10").status_code == 200
        assert len(selects) == count_one
    finally:
        event.remove(engine, "before_cursor_execute", record_select)


def test_unknown_fields_do_not_bypass_property_guards(client, db, record):
    prop, _, _ = record
    login(client, db, "staff")
    base = f"/api/v1/admin/properties/{prop.id}"
    assert (
        client.patch(
            base + "?status=published",
            json={"version": 1, "title": "Updated title"},
            headers=h(client),
        ).status_code
        == 422
    )
    assert client.get(base + "?include_passwords=true").status_code == 422
    assert (
        client.patch(
            base + "/availability",
            json={"availability_status": "available", "version": 0},
            headers=h(client),
        ).status_code
        == 422
    )


def test_stale_filter_exact_fourteen_day_boundary_and_never_confirmed(
    client, db, record, monkeypatch
):
    prop, _, _ = record
    login(client, db, "staff")
    fixed = datetime(2026, 11, 2, 12, tzinfo=UTC)
    monkeypatch.setattr("app.services.property_admin.moment", lambda: fixed)
    prop.last_availability_confirmed_at = fixed - timedelta(days=14)
    db.commit()
    clone(db, prop, last_availability_confirmed_at=None)
    clone(db, prop, last_availability_confirmed_at=fixed - timedelta(days=14, seconds=1))
    assert (
        client.get("/api/v1/admin/properties?stale_availability=true").json()["meta"]["total_items"]
        == 2
    )
    assert client.get("/api/v1/admin/properties?stale_availability=false").json()["data"][0][
        "id"
    ] == str(prop.id)


@pytest.mark.parametrize("role", [None, "client", "staff", "admin"])
def test_property_options_are_private_active_reference_data(client, db, record, role):
    from app.models.property import Amenity

    user = login(client, db, role)
    db.add_all(
        [
            Amenity(code="active-test", label="Active amenity", category="utilities"),
            Amenity(
                code="inactive-test", label="Hidden amenity", category="utilities", is_active=False
            ),
        ]
    )
    db.commit()
    response = client.get("/api/v1/admin/property-options")
    if role not in {"staff", "admin"}:
        assert response.status_code == (401 if role is None else 403)
        return
    assert response.status_code == 200
    data = response.json()["data"]
    assert data["areas"]
    assert data["amenities"] == [{"code": "active-test", "label": "Active amenity"}]
    assert data["staff"] == [{"id": str(user.id), "full_name": user.full_name}]
    assert "email" not in response.text and "password_hash" not in response.text
    assert client.get("/api/v1/admin/property-options?unknown=yes").status_code == 422
