"""Real PostgreSQL inquiry workflow, privacy and object-scoped authorization."""

import uuid
from datetime import timedelta

import pytest
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.core.security import now
from app.models.inquiry import Inquiry, InquiryHistory, InquiryMessage, InquiryRequest
from tests.test_public_properties import publish
from tests.test_staff_properties import h, login
from tests.test_staff_properties import record as record


def write(c, path, body=None, method="post", headers=None):
    return getattr(c, method)("/api/v1" + path, json=body, headers={**h(c), **(headers or {})})


def create(c, prop=None, key=None):
    return write(
        c,
        "/inquiries",
        {
            "kind": "property_interest" if prop else "general",
            "property_id": str(prop.id) if prop else None,
            "body": "Please arrange a viewing.",
            "budget_min": 10000000,
            "budget_max": 300000000,
        },
        headers={"Idempotency-Key": key} if key else None,
    )


def test_full_workflow_messages_notes_privacy_idempotency(db, client, record):
    prop, photo, doc = record
    publish(db, prop)
    owner = login(client, db, "client")
    first = create(client, prop, "same-request")
    assert first.status_code == 201, first.text
    receipt = first.json()["data"]
    iid = receipt["id"]
    assert create(client, prop, "same-request").json()["data"] == receipt
    assert create(client, prop).status_code == 409
    assert (
        write(
            client,
            "/inquiries",
            {"kind": "general", "body": "Changed"},
            headers={"Idempotency-Key": "same-request"},
        ).status_code
        == 409
    )
    mine = client.get("/api/v1/inquiries").json()
    assert mine["meta"]["total_items"] == 1
    team = login(client, db, "staff")
    base = f"/admin/inquiries/{iid}"
    detail = client.get("/api/v1" + base).json()["data"]
    assert detail["client"]["email"] == owner.email
    assert write(client, base + "/notes", {"body": "PRIVATE INTERNAL NOTE"}).status_code == 201
    assert write(client, base + "/messages", {"body": "Our team can help you."}).status_code == 201
    detail = client.get("/api/v1" + base).json()["data"]
    assert (
        write(
            client,
            base + "/assign",
            {"version": detail["version"], "assigned_staff_id": str(team.id)},
        ).status_code
        == 200
    )
    assert (
        write(client, base + "/assign", {"version": 1, "assigned_staff_id": None}).status_code
        == 409
    )
    for action in ["start", "qualify", "negotiate", "close_won"]:
        detail = client.get("/api/v1" + base).json()["data"]
        assert action in detail["allowed_actions"]
        result = write(
            client, base + "/transitions", {"version": detail["version"], "action": action}
        )
        assert result.status_code == 200, result.text
    assert write(client, base + "/messages", {"body": "Late"}).status_code == 409
    # Authenticate as the original client, rather than manufacture a role cookie.
    assert (
        write(client, "/auth/login", {"email": owner.email, "password": "Goodpass8!"}).status_code
        == 200
    )
    for path in ["/inquiries", f"/inquiries/{iid}", f"/inquiries/{iid}/messages"]:
        r = client.get("/api/v1" + path)
        assert r.status_code == 200, r.text
        assert r.headers["cache-control"] == "no-store"
        for secret in [
            "PRIVATE INTERNAL NOTE",
            "assigned_staff",
            "client_id",
            "sender_id",
            "closed_reason",
            "password_hash",
            "documents",
            "address_line",
            prop.address_line,
            str(doc.id),
            "Fictional Owner",
            "+2348000000000",
        ]:
            assert secret not in r.text
    assert "Our team can help you." in client.get("/api/v1" + f"/inquiries/{iid}/messages").text
    assert create(client, prop).status_code == 201  # terminal permits a new inquiry
    assert db.scalar(select(InquiryHistory).where(InquiryHistory.to_status == "closed_won"))
    assert db.get(Inquiry, uuid.UUID(iid)).qualified_at
    # History cannot be altered even by normal application SQL.
    with pytest.raises(DBAPIError):
        db.execute(text("UPDATE inquiry_status_history SET reason='tampered'"))
    db.rollback()


@pytest.mark.parametrize("role", [None, "client", "staff", "admin"])
def test_role_matrix(db, client, role):
    login(client, db, role)
    expected = 401 if role is None else 200 if role == "client" else 403
    assert client.get("/api/v1/inquiries").status_code == expected
    staff_expected = 401 if role is None else 403 if role == "client" else 200
    assert client.get("/api/v1/admin/inquiries").status_code == staff_expected
    assert client.get("/api/v1/admin/clients").status_code == staff_expected


@pytest.mark.parametrize("suffix", ["", "/messages"])
def test_other_client_cannot_read_or_write_thread(db, client, suffix):
    login(client, db, "client")
    iid = create(client).json()["data"]["id"]
    login(client, db, "client")
    assert client.get(f"/api/v1/inquiries/{iid}{suffix}").status_code == 404
    assert write(client, f"/inquiries/{iid}/messages", {"body": "Intrusion"}).status_code == 404
    assert client.get(f"/api/v1/admin/inquiries/{iid}/notes").status_code == 403
    assert client.get("/api/v1/inquiries").json()["data"] == []


@pytest.mark.parametrize(
    "body",
    [
        {"kind": "general", "body": " "},
        {"kind": "general", "body": "a" * 4001},
        {"kind": "property_interest", "body": "Test"},
        {"kind": "general", "body": "Test", "property_id": str(uuid.uuid4())},
        {"kind": "general", "body": "Test", "budget_min": 50, "budget_max": 1},
        {"kind": "general", "body": "Test", "budget_min": 1.2},
        {"kind": "general", "body": "Test", "budget_min": True},
        {"kind": "general", "body": "Test", "status": "closed_won"},
        {"kind": "general", "body": "Test", "client_id": str(uuid.uuid4())},
    ],
)
def test_invalid_inputs(db, client, body):
    login(client, db, "client")
    r = write(client, "/inquiries", body)
    assert r.status_code == 422, r.text
    assert r.json()["error"]["request_id"]


@pytest.mark.parametrize(
    "query",
    [
        "unknown=yes",
        "page=0",
        "page_size=101",
        "page=1&page=2",
        "status=nope",
        "assigned_to=invalid",
    ],
)
def test_invalid_queries(db, client, query):
    login(client, db, "staff")
    assert client.get("/api/v1/admin/inquiries?" + query).status_code == 422


def test_unpublished_inquiry_denied_and_message_pagination(db, client, record):
    prop, _, _ = record
    login(client, db, "client")
    assert create(client, prop).status_code == 404
    publish(db, prop)
    iid = create(client, prop).json()["data"]["id"]
    for i in range(3):
        assert (
            write(client, f"/inquiries/{iid}/messages", {"body": f"Question {i}"}).status_code
            == 201
        )
    r = client.get(f"/api/v1/inquiries/{iid}/messages?page_size=2").json()
    assert len(r["data"]) == 2 and r["meta"]["total_items"] == 4
    prop.status = "unpublished"
    db.commit()
    assert client.get(f"/api/v1/inquiries/{iid}").json()["data"]["property"]["slug"] is None
    assert (
        write(
            client, f"/inquiries/{iid}/messages", {"body": "Is there an alternative?"}
        ).status_code
        == 201
    )


def test_qualification_assignment_transition_guards_and_directory(db, client):
    owner = login(client, db, "client")
    iid = create(client).json()["data"]["id"]
    staff = login(client, db, "staff")
    base = f"/admin/inquiries/{iid}"
    assert (
        write(
            client, base + "/assign", {"version": 1, "assigned_staff_id": str(owner.id)}
        ).status_code
        == 422
    )
    assert (
        write(client, base + "/transitions", {"version": 1, "action": "close_won"}).status_code
        == 409
    )
    assert (
        write(client, base + "/transitions", {"version": 1, "action": "close_lost"}).status_code
        == 422
    )
    assert (
        write(
            client,
            base + "/qualification",
            {"version": 1, "budget_min": 100, "budget_max": 200},
            method="put",
        ).status_code
        == 200
    )
    assert (
        write(
            client,
            base + "/transitions",
            {"version": 2, "action": "close_lost", "reason": "Client changed plans"},
        ).status_code
        == 200
    )
    directory = client.get("/api/v1/admin/clients").json()["data"]
    assert len(directory) == 1
    assert directory[0]["email"] == owner.email
    cbase = f"/admin/clients/{owner.id}"
    assert client.get("/api/v1" + cbase).json()["data"]["inquiry_count"] == 1
    assert (
        write(
            client, f"/admin/clients/{staff.id}", {"version": 1, "is_active": False}, method="patch"
        ).status_code
        == 404
    )
    assert (
        write(client, cbase, {"version": 1, "is_active": False}, method="patch").status_code == 200
    )
    assert (
        write(client, cbase, {"version": 1, "is_active": True}, method="patch").status_code == 409
    )
    assert (
        write(client, "/auth/login", {"email": owner.email, "password": "Goodpass8!"}).status_code
        == 401
    )


def test_idempotency_expiry_and_attempt_limits(db, client):
    login(client, db, "client")
    first = create(client, key="expired").json()
    key = db.scalar(select(InquiryRequest))
    key.created_at = now() - timedelta(hours=25)
    db.commit()
    assert create(client, key="expired").json() != first
    for _ in range(18):
        assert create(client).status_code == 201
    assert create(client).status_code == 429


def test_message_limits_csrf_size_and_openapi(db, client):
    login(client, db, "client")
    iid = create(client).json()["data"]["id"]
    assert (
        client.post(f"/api/v1/inquiries/{iid}/messages", json={"body": "No csrf"}).status_code
        == 403
    )
    assert write(client, f"/inquiries/{iid}/messages", {"body": "x" * 70000}).status_code == 413
    for _ in range(60):
        assert write(client, f"/inquiries/{iid}/messages", {"body": "Message"}).status_code == 201
    assert write(client, f"/inquiries/{iid}/messages", {"body": "Too many"}).status_code == 429
    schema = client.app.openapi()
    assert "/api/v1/inquiries/{inquiry_id}/messages" in schema["paths"]
    assert "notes" not in schema["components"]["schemas"]["Summary"]["properties"]


@pytest.mark.parametrize("role", [None, "client", "staff", "admin"])
@pytest.mark.parametrize(
    "path,method,body",
    [
        ("/admin/inquiries/{id}", "get", None),
        ("/admin/inquiries/{id}/messages", "get", None),
        ("/admin/inquiries/{id}/notes", "get", None),
        ("/admin/inquiries/{id}/messages", "post", {"body": "Reply"}),
        ("/admin/inquiries/{id}/notes", "post", {"body": "Note"}),
        ("/admin/inquiries/{id}/assign", "post", {"version": 1, "assigned_staff_id": None}),
        ("/admin/inquiries/{id}/qualification", "put", {"version": 1}),
        ("/admin/inquiries/{id}/transitions", "post", {"version": 1, "action": "start"}),
        ("/admin/clients/{id}", "get", None),
        ("/admin/clients/{id}", "patch", {"version": 1, "is_active": False}),
    ],
)
def test_every_staff_route_default_deny(db, client, role, path, method, body):
    login(client, db, role)
    path = path.replace("{id}", str(uuid.uuid4()))
    r = client.get("/api/v1" + path) if method == "get" else write(client, path, body, method)
    assert r.status_code == (401 if role is None else 403 if role == "client" else 404), r.text


def test_concurrent_idempotent_creation(db, client):
    from concurrent.futures import ThreadPoolExecutor

    login(client, db, "client")
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: create(client, key="parallel-request"), range(2)))
    assert [r.status_code for r in results] == [201, 201]
    assert results[0].json() == results[1].json()
    assert len(list(db.scalars(select(Inquiry)))) == 1
    assert len(list(db.scalars(select(InquiryMessage)))) == 1


def test_note_rate_limit_and_blank_message(db, client):
    login(client, db, "client")
    iid = create(client).json()["data"]["id"]
    assert write(client, f"/inquiries/{iid}/messages", {"body": "   "}).status_code == 422
    login(client, db, "staff")
    for _ in range(60):
        assert (
            write(client, f"/admin/inquiries/{iid}/notes", {"body": "Private note"}).status_code
            == 201
        )
    assert write(client, f"/admin/inquiries/{iid}/notes", {"body": "Overflow"}).status_code == 429


def test_inquiry_migration_roundtrip_preserves_identity(engine, db, client):
    from pathlib import Path

    from alembic.config import Config
    from sqlalchemy import inspect

    from alembic import command
    from tests.conftest import TEST_URL

    owner = login(client, db, "client")
    assert create(client).status_code == 201
    uid = owner.id
    db.close()
    cfg = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
    cfg.attributes["database_url"] = TEST_URL
    try:
        command.downgrade(cfg, "be44_submissions")
        assert "inquiries" not in inspect(engine).get_table_names()
        with engine.connect() as c:
            assert (
                c.execute(text("SELECT count(*) FROM users WHERE id=:id"), {"id": uid}).scalar()
                == 1
            )
    finally:
        command.upgrade(cfg, "head")
    assert {
        "inquiries",
        "inquiry_messages",
        "inquiry_notes",
        "inquiry_status_history",
        "inquiry_requests",
    } <= set(inspect(engine).get_table_names())


def test_filter_reference_pagination_and_literal_wildcards(db, client):
    login(client, db, "client")
    first = create(client).json()["data"]
    assert create(client).status_code == 201
    r = client.get("/api/v1/inquiries?page_size=1").json()
    assert r["meta"]["total_pages"] == 2 and len(r["data"]) == 1
    assert client.get("/api/v1/inquiries?page=99").json()["data"] == []
    assert client.get("/api/v1/inquiries?status=qualified").json()["data"] == []
    assert (
        client.get("/api/v1/inquiries", params={"q": first["reference"]}).json()["meta"][
            "total_items"
        ]
        == 1
    )
    assert client.get("/api/v1/inquiries", params={"q": "%"}).json()["data"] == []


def test_open_property_constraint_is_enforced_by_postgres(db, client, record):
    from sqlalchemy.exc import IntegrityError

    prop, _, _ = record
    publish(db, prop)
    owner = login(client, db, "client")
    assert create(client, prop).status_code == 201
    db.add(Inquiry(client_id=owner.id, property_id=prop.id, kind="inspection_request"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()


def test_client_deactivation_revokes_an_existing_session(db, client):
    owner = login(client, db, "client")
    old_cookies = dict(client.cookies)
    login(client, db, "admin")
    r = write(
        client, f"/admin/clients/{owner.id}", {"version": 1, "is_active": False}, method="patch"
    )
    assert r.status_code == 200
    client.cookies.clear()
    client.cookies.update(old_cookies)
    assert client.get("/api/v1/inquiries").status_code == 401


def test_read_acknowledgement_is_scoped_and_never_marks_future_messages(db, client):
    owner = login(client, db, "client")
    iid = create(client).json()["data"]["id"]
    staff = login(client, db, "staff")
    base = f"/admin/inquiries/{iid}"
    assert client.get("/api/v1" + base).json()["data"]["unread_count"] == 1
    initial = client.get("/api/v1" + base + "/messages").json()["data"][0]
    assert (
        write(client, base + "/read", {"through_message_id": initial["id"]}).json()["data"][
            "unread_count"
        ]
        == 0
    )
    reply = write(client, base + "/messages", {"body": "First team reply"}).json()["data"]
    assert (
        write(client, "/auth/login", {"email": owner.email, "password": "Goodpass8!"}).status_code
        == 200
    )
    assert client.get(f"/api/v1/inquiries/{iid}").json()["data"]["unread_count"] == 1
    # A client cannot acknowledge their own outbound message as a team reply.
    assert (
        write(client, f"/inquiries/{iid}/read", {"through_message_id": initial["id"]}).status_code
        == 404
    )
    # A later staff message remains unread if only an older message was seen.
    assert (
        write(client, "/auth/login", {"email": staff.email, "password": "Goodpass8!"}).status_code
        == 200
    )
    assert write(client, base + "/messages", {"body": "Later team reply"}).status_code == 201
    assert (
        write(client, "/auth/login", {"email": owner.email, "password": "Goodpass8!"}).status_code
        == 200
    )
    r = write(client, f"/inquiries/{iid}/read", {"through_message_id": reply["id"]})
    assert r.status_code == 200 and r.json()["data"]["unread_count"] == 1
    assert (
        write(
            client, f"/inquiries/{iid}/read", {"through_message_id": str(uuid.uuid4())}
        ).status_code
        == 404
    )
    login(client, db, "client")
    assert (
        write(client, f"/inquiries/{iid}/read", {"through_message_id": reply["id"]}).status_code
        == 404
    )


@pytest.mark.parametrize("role", [None, "client", "staff", "admin"])
def test_read_acknowledgement_staff_guard(db, client, role):
    login(client, db, role)
    r = write(
        client, f"/admin/inquiries/{uuid.uuid4()}/read", {"through_message_id": str(uuid.uuid4())}
    )
    assert r.status_code == (401 if role is None else 403 if role == "client" else 404)
