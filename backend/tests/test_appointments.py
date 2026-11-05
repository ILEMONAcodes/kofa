"""Inspection behavior on real isolated PostgreSQL, never the application database."""

import uuid
from datetime import timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.core.security import now
from app.models.appointment import Appointment, AppointmentHistory
from app.models.inquiry import Inquiry
from tests.test_inquiries import write
from tests.test_public_properties import publish
from tests.test_staff_properties import clone, login
from tests.test_staff_properties import record as record


def qualify(client, db, prop):
    owner = login(client, db, "client")
    r = write(
        client,
        "/inquiries",
        {
            "kind": "inspection_request",
            "property_id": str(prop.id),
            "body": "Please arrange an inspection.",
        },
    )
    assert r.status_code == 201, r.text
    iid = r.json()["data"]["id"]
    staff = login(client, db, "staff")
    for action, version in [("start", 1), ("qualify", 2)]:
        assert (
            write(
                client,
                f"/admin/inquiries/{iid}/transitions",
                {"version": version, "action": action},
            ).status_code
            == 200
        )
    return owner, staff, iid


@pytest.fixture
def setup(db, client, record):
    prop, _, _ = record
    publish(db, prop)
    owner, staff, iid = qualify(client, db, prop)
    body = {
        "inquiry_id": iid,
        "version": 3,
        "staff_id": str(staff.id),
        "scheduled_at": (now() + timedelta(days=2)).replace(second=0, microsecond=0).isoformat(),
        "duration_minutes": 45,
        "meeting_instructions": "Private meeting instructions.",
    }
    return prop, owner, staff, body


def schedule(client, body):
    r = write(client, "/admin/appointments", body)
    assert r.status_code == 201, r.text
    return r.json()["data"]


def signin(client, user):
    assert (
        write(client, "/auth/login", {"email": user.email, "password": "Goodpass8!"}).status_code
        == 200
    )


def test_schedule_confirm_complete_address_privacy_and_audit(db, client, setup):
    prop, owner, staff, body = setup
    row = schedule(client, body)
    aid = row["id"]
    assert row["status"] == "proposed" and row["fee"]["amount"] == 0
    assert db.get(Inquiry, uuid.UUID(body["inquiry_id"])).status == "inspection_scheduled"
    assert row["landlord_rep_phone"] == "+2348000000000"
    signin(client, owner)
    own = f"/appointments/{aid}"
    proposed = client.get("/api/v1" + own)
    assert proposed.status_code == 200 and proposed.json()["data"]["meeting_address"] is None
    assert (
        prop.address_line not in proposed.text
        and "Private meeting instructions." not in proposed.text
    )
    assert write(client, own + "/confirm", {"version": 1}).status_code == 200
    confirmed = client.get("/api/v1" + own)
    assert confirmed.json()["data"]["meeting_address"] == prop.address_line
    assert confirmed.json()["data"]["meeting_instructions"] == "Private meeting instructions."
    for path in ["/appointments", own]:
        response = client.get("/api/v1" + path)
        assert response.headers["cache-control"] == "no-store"
        for private in [
            "landlord_rep",
            "+2348000000000",
            "Fictional Owner",
            "outcome_notes",
            "address_line",
            "latitude",
            "longitude",
            "history",
            "staff_id",
        ]:
            assert private not in response.text
    assert prop.address_line not in client.get("/api/v1/appointments").text
    signin(client, staff)
    assert (
        write(
            client, f"/admin/appointments/{aid}/outcome", {"version": 2, "outcome": "interested"}
        ).status_code
        == 409
    )
    with patch("app.services.appointment.now", return_value=now() + timedelta(days=3)):
        r = write(
            client,
            f"/admin/appointments/{aid}/outcome",
            {"version": 2, "outcome": "interested", "notes": "PRIVATE OUTCOME NOTES"},
        )
    assert r.status_code == 200, r.text
    assert r.json()["data"]["status"] == "completed"
    signin(client, owner)
    detail = client.get("/api/v1" + own)
    assert detail.json()["data"]["outcome"] == "interested"
    assert "PRIVATE OUTCOME NOTES" not in detail.text
    assert write(client, own + "/cancel", {"version": 3, "reason": "Too late"}).status_code == 409
    assert len(list(db.scalars(select(AppointmentHistory)))) == 3
    with pytest.raises(DBAPIError):
        db.execute(text("UPDATE appointment_status_history SET reason='tampered'"))
    db.rollback()


def test_rescheduling_requires_reconfirmation_and_withdraws_address(db, client, setup):
    prop, owner, staff, body = setup
    row = schedule(client, body)
    aid = row["id"]
    own = f"/appointments/{aid}"
    signin(client, owner)
    assert write(client, own + "/confirm", {"version": 1}).status_code == 200
    request = write(
        client,
        own + "/request-reschedule",
        {
            "version": 2,
            "reason": "A different day works better.",
            "preferred_at": (now() + timedelta(days=4)).isoformat(),
        },
    )
    assert request.status_code == 200 and request.json()["data"]["meeting_address"] is None
    signin(client, staff)
    newer = {k: v for k, v in body.items() if k != "inquiry_id"} | {
        "version": 3,
        "reason": "New time agreed.",
        "scheduled_at": (now() + timedelta(days=4)).isoformat(),
    }
    r = write(client, f"/admin/appointments/{aid}", newer, "patch")
    assert r.status_code == 200, r.text
    assert (
        r.json()["data"]["status"] == "proposed"
        and r.json()["data"]["address_disclosed_at"] is None
    )
    signin(client, owner)
    assert client.get("/api/v1" + own).json()["data"]["meeting_address"] is None
    assert (
        write(client, own + "/confirm", {"version": 4}).json()["data"]["meeting_address"]
        == prop.address_line
    )
    cancelled = write(client, own + "/cancel", {"version": 5, "reason": "Plans changed."})
    assert (
        cancelled.status_code == 200 and cancelled.json()["data"]["status"] == "cancelled_by_client"
    )
    assert cancelled.json()["data"]["meeting_address"] is None
    db.expire_all()
    assert db.get(Inquiry, uuid.UUID(body["inquiry_id"])).status == "qualified"


@pytest.mark.parametrize("party", ["staff", "landlord"])
def test_staff_cancellation_and_no_fee(db, client, setup, party):
    _, _, _, body = setup
    row = schedule(client, body)
    r = write(
        client,
        f"/admin/appointments/{row['id']}/cancel",
        {"version": 1, "reason": "Unavailable for this visit.", "cancelled_by": party},
    )
    assert r.status_code == 200 and r.json()["data"]["status"] == "cancelled_by_" + party
    assert r.json()["data"]["fee"]["amount"] == 0


def test_no_show_needs_note_and_completed_time(db, client, setup):
    _, owner, staff, body = setup
    row = schedule(client, body)
    aid = row["id"]
    signin(client, owner)
    assert write(client, f"/appointments/{aid}/confirm", {"version": 1}).status_code == 200
    signin(client, staff)
    with patch("app.services.appointment.now", return_value=now() + timedelta(days=3)):
        assert (
            write(
                client, f"/admin/appointments/{aid}/outcome", {"version": 2, "no_show": True}
            ).status_code
            == 422
        )
        r = write(
            client,
            f"/admin/appointments/{aid}/outcome",
            {"version": 2, "no_show": True, "notes": "No attendance after the agreed time."},
        )
    assert r.status_code == 200 and r.json()["data"]["status"] == "no_show"
    signin(client, owner)
    assert client.get(f"/api/v1/appointments/{aid}").json()["data"]["meeting_address"] is None


@pytest.mark.parametrize("role", [None, "client", "staff", "admin"])
@pytest.mark.parametrize(
    "path,method,body",
    [
        ("/admin/appointments", "get", None),
        ("/admin/appointments/{id}", "get", None),
        ("/admin/appointments/{id}/cancel", "post", {"version": 1, "reason": "Cancel"}),
        ("/admin/appointments/{id}/outcome", "post", {"version": 1, "outcome": "interested"}),
        (
            "/admin/appointments/{id}",
            "patch",
            {
                "version": 1,
                "staff_id": str(uuid.uuid4()),
                "scheduled_at": (now() + timedelta(days=3)).isoformat(),
                "reason": "New slot",
            },
        ),
    ],
)
def test_staff_permission_matrix(db, client, role, path, method, body):
    login(client, db, role)
    path = path.replace("{id}", str(uuid.uuid4()))
    response = (
        client.get("/api/v1" + path) if method == "get" else write(client, path, body, method)
    )
    expected = (
        401
        if role is None
        else 403
        if role == "client"
        else 200
        if path == "/admin/appointments"
        else 404
    )
    assert response.status_code == expected, response.text


@pytest.mark.parametrize(
    "suffix,body",
    [
        ("", None),
        ("/confirm", {"version": 1}),
        ("/cancel", {"version": 1, "reason": "Cancel"}),
        ("/request-reschedule", {"version": 1, "reason": "Another time"}),
    ],
)
def test_other_client_object_guard(db, client, setup, suffix, body):
    _, _, _, payload = setup
    row = schedule(client, payload)
    login(client, db, "client")
    target = f"/appointments/{row['id']}{suffix}"
    r = client.get("/api/v1" + target) if body is None else write(client, target, body)
    assert r.status_code == 404
    assert client.get("/api/v1/appointments").json()["data"] == []


@pytest.mark.parametrize(
    "change",
    [
        {"scheduled_at": "2026-01-01T10:00:00Z"},
        {"scheduled_at": "2030-01-01T10:00:00"},
        {"duration_minutes": 0},
        {"duration_minutes": 241},
        {"duration_minutes": 30.5},
        {"staff_id": str(uuid.uuid4())},
        {"version": 0},
        {"version": 999},
        {"fee_amount": 10000},
        {"client_id": str(uuid.uuid4())},
    ],
)
def test_invalid_creation(db, client, setup, change):
    _, _, _, body = setup
    r = write(client, "/admin/appointments", body | change)
    assert r.status_code == (409 if change.get("version") == 999 else 422), r.text


@pytest.mark.parametrize(
    "query",
    [
        "unknown=1",
        "page=0",
        "page_size=101",
        "status=bad",
        "page=1&page=2",
        "date_from=2026-01-01",
        "date_from=2030-01-01T10:00:00Z&date_to=2029-01-01T10:00:00Z",
    ],
)
def test_invalid_filters(db, client, query):
    login(client, db, "staff")
    assert client.get("/api/v1/admin/appointments?" + query).status_code == 422


def test_conflicting_staff_property_slots_and_adjacent_boundary(db, client, setup):
    prop, _, staff, body = setup
    schedule(client, body)
    # Another client and team member may inquire about the same property.
    _, other, second = qualify(client, db, prop)
    overlap = body | {"inquiry_id": second, "staff_id": str(other.id)}
    assert write(client, "/admin/appointments", overlap).status_code == 409
    # Back-to-back property slots are valid.
    overlap["scheduled_at"] = (
        __import__("datetime").datetime.fromisoformat(body["scheduled_at"]) + timedelta(minutes=45)
    ).isoformat()
    assert write(client, "/admin/appointments", overlap).status_code == 201
    other_prop = clone(db, prop)
    publish(db, other_prop)
    _, _, third = qualify(client, db, other_prop)
    assert (
        write(
            client, "/admin/appointments", body | {"inquiry_id": third, "staff_id": str(staff.id)}
        ).status_code
        == 409
    )


def test_concurrent_overlap_is_rejected_atomically(db, client, setup):
    from concurrent.futures import ThreadPoolExecutor

    prop, _, _, body = setup
    _, _, second = qualify(client, db, prop)
    payloads = [body, body | {"inquiry_id": second}]
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(
            pool.map(lambda payload: write(client, "/admin/appointments", payload), payloads)
        )
    assert sorted(r.status_code for r in results) == [201, 409], [r.text for r in results]
    assert len(list(db.scalars(select(Appointment)))) == 1
    assert len(list(db.scalars(select(AppointmentHistory)))) == 1


def test_csrf_body_limits_and_inquiry_validation(db, client, setup):
    _, owner, staff, body = setup
    assert client.post("/api/v1/admin/appointments", json=body).status_code == 403
    assert (
        write(
            client, "/admin/appointments", body | {"meeting_instructions": "x" * 70000}
        ).status_code
        == 413
    )
    assert (
        write(client, "/admin/appointments", body | {"inquiry_id": str(uuid.uuid4())}).status_code
        == 404
    )
    signin(client, owner)
    general = write(client, "/inquiries", {"kind": "general", "body": "General question"}).json()[
        "data"
    ]["id"]
    signin(client, staff)
    assert (
        write(
            client, "/admin/appointments", body | {"inquiry_id": general, "version": 1}
        ).status_code
        == 409
    )


def test_stale_version_and_reschedule_conflict_preserve_original(db, client, setup):
    prop, owner, staff, body = setup
    first = schedule(client, body)
    _, other, second = qualify(client, db, prop)
    second_body = body | {
        "inquiry_id": second,
        "staff_id": str(other.id),
        "scheduled_at": (now() + timedelta(days=4)).isoformat(),
    }
    second_row = schedule(client, second_body)
    conflict_body = {k: v for k, v in second_body.items() if k != "inquiry_id"} | {
        "version": 1,
        "reason": "Move into booked slot",
        "scheduled_at": body["scheduled_at"],
    }
    r = write(client, f"/admin/appointments/{second_row['id']}", conflict_body, "patch")
    assert r.status_code == 409 and r.json()["error"]["code"] == "CONFLICT"
    unchanged = client.get(f"/api/v1/admin/appointments/{second_row['id']}").json()["data"]
    assert unchanged["version"] == 1 and unchanged["scheduled_at"] == second_row["scheduled_at"]
    signin(client, owner)
    assert write(client, f"/appointments/{first['id']}/confirm", {"version": 1}).status_code == 200
    stale = write(
        client, f"/appointments/{first['id']}/cancel", {"version": 1, "reason": "Changed plans"}
    )
    assert stale.status_code == 409 and stale.json()["error"]["code"] == "VERSION_CONFLICT"


def test_unavailable_property_blocks_confirmation(db, client, setup):
    prop, owner, _, body = setup
    row = schedule(client, body)
    prop.status = "unpublished"
    db.commit()
    signin(client, owner)
    r = write(client, f"/appointments/{row['id']}/confirm", {"version": 1})
    assert r.status_code == 409
    assert client.get(f"/api/v1/appointments/{row['id']}").json()["data"]["meeting_address"] is None


def test_list_filters_and_safe_options(db, client, setup):
    _, owner, staff, body = setup
    row = schedule(client, body)
    result = client.get(
        "/api/v1/admin/appointments",
        params={"staff_id": str(staff.id), "inquiry_id": body["inquiry_id"], "status": "proposed"},
    ).json()
    assert result["meta"]["total_items"] == 1
    assert client.get("/api/v1/admin/appointments?status=completed").json()["data"] == []
    assert client.get("/api/v1/admin/appointments?page=99").json()["data"] == []
    options = client.get("/api/v1/admin/appointment-options")
    assert options.status_code == 200 and options.json()["data"]["fee"]["amount"] == 0
    assert (
        "email" not in options.text
        and "phone" not in options.text
        and "password" not in options.text
    )
    signin(client, owner)
    assert client.get("/api/v1/admin/appointment-options").status_code == 403
    assert client.get("/api/v1/appointments?staff_id=" + str(staff.id)).status_code == 422
    own = client.get("/api/v1/appointments").json()["data"][0]
    assert own["id"] == row["id"] and "landlord_rep_phone" not in own
    for role in ["staff", "admin"]:
        login(client, db, role)
        assert client.get("/api/v1/appointments").status_code == 403
        assert (
            write(client, f"/appointments/{row['id']}/confirm", {"version": 1}).status_code == 403
        )


def test_inactive_parties_and_non_staff_creation_rejected(db, client, setup):
    _, owner, staff, body = setup
    staff.is_active = False
    db.commit()
    login(client, db, "admin")
    assert write(client, "/admin/appointments", body).status_code == 422
    staff.is_active = True
    owner.is_active = False
    db.commit()
    assert write(client, "/admin/appointments", body).status_code == 409
    owner.is_active = True
    db.commit()
    signin(client, owner)
    assert write(client, "/admin/appointments", body).status_code == 403


def test_cancelled_slot_can_be_rebooked_and_database_has_active_unique_guard(db, client, setup):
    from sqlalchemy.exc import IntegrityError

    prop, _, _, body = setup
    first = schedule(client, body)
    original = db.get(Appointment, uuid.UUID(first["id"]))
    duplicate = Appointment(
        inquiry_id=original.inquiry_id,
        property_id=original.property_id,
        client_id=original.client_id,
        staff_id=original.staff_id,
        scheduled_at=original.scheduled_at + timedelta(days=4),
        ends_at=original.ends_at + timedelta(days=4),
        duration_minutes=original.duration_minutes,
    )
    db.add(duplicate)
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert (
        write(
            client,
            f"/admin/appointments/{first['id']}/cancel",
            {"version": 1, "reason": "Slot released"},
        ).status_code
        == 200
    )
    _, _, second = qualify(client, db, prop)
    assert write(client, "/admin/appointments", body | {"inquiry_id": second}).status_code == 201


def test_appointment_migration_roundtrip_preserves_upstream_records(engine, db, client, setup):
    from pathlib import Path

    from alembic.config import Config
    from sqlalchemy import inspect

    from alembic import command
    from tests.conftest import TEST_URL

    _, owner, _, body = setup
    schedule(client, body)
    user_id = owner.id
    inquiry_id = body["inquiry_id"]
    db.close()
    cfg = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
    cfg.attributes["database_url"] = TEST_URL
    try:
        command.downgrade(cfg, "be52_inquiries")
        assert "appointments" not in inspect(engine).get_table_names()
        with engine.connect() as conn:
            assert (
                conn.scalar(text("SELECT count(*) FROM users WHERE id=:id"), {"id": user_id}) == 1
            )
            assert (
                conn.scalar(text("SELECT count(*) FROM inquiries WHERE id=:id"), {"id": inquiry_id})
                == 1
            )
    finally:
        command.upgrade(cfg, "head")
    assert {"appointments", "appointment_status_history"} <= set(inspect(engine).get_table_names())


def test_client_action_attempt_rate_limit(db, client):
    login(client, db, "client")
    path = f"/appointments/{uuid.uuid4()}/cancel"
    for _ in range(120):
        assert write(client, path, {"version": 1, "reason": "Unknown visit"}).status_code == 404
    response = write(client, path, {"version": 1, "reason": "Rate budget exhausted"})
    assert response.status_code == 429 and response.headers.get("retry-after")


def test_confirmation_uses_address_snapshot_and_staff_can_see_both_addresses(db, client, setup):
    prop, owner, staff, body = setup
    row = schedule(client, body)
    original = prop.address_line
    signin(client, owner)
    assert write(client, f"/appointments/{row['id']}/confirm", {"version": 1}).status_code == 200
    # A metadata change cannot silently move an already-confirmed meeting.
    prop.address_line = "Different private address"
    db.commit()
    assert (
        client.get(f"/api/v1/appointments/{row['id']}").json()["data"]["meeting_address"]
        == original
    )
    signin(client, staff)
    detail = client.get(f"/api/v1/admin/appointments/{row['id']}").json()["data"]
    assert detail["address_line"] == "Different private address"
    assert detail["confirmed_meeting_address"] == original
