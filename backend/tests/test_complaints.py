"""Real local database tests for privacy, evidence and verified case actions."""

import io
from datetime import timedelta
from uuid import UUID, uuid4

import pytest
from PIL import Image
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.core.security import now
from app.models.complaint import Complaint, ComplaintEvent
from app.models.identity import EmailOutbox
from app.services.complaint import business_days
from app.services.storage import LocalStorage
from tests.conftest import csrf
from tests.test_inquiries import write
from tests.test_public_properties import publish
from tests.test_staff_properties import login
from tests.test_staff_properties import record as record


@pytest.fixture
def setup(client, db, record):
    prop, _, _ = record
    publish(db, prop)
    csrf(client)
    return prop


def report(client, prop, **kw):
    return write(
        client,
        "/reports",
        {
            "property_slug": prop.slug,
            "reason": "fake_listing",
            "description": "This listing appears to use misleading photographs.",
            **kw,
        },
    )


def created(client, prop):
    r = report(
        client,
        prop,
        reporter={
            "name": "Private Reporter",
            "email": "private@example.com",
            "phone": "+2348012345678",
        },
    )
    assert r.status_code == 201, r.text
    return r.json()["data"]


def change(client, id, version, action, **kw):
    return write(
        client, f"/admin/complaints/{id}/transitions", {"version": version, "action": action, **kw}
    )


def investigate(client, db, id):
    staff = login(client, db, "staff")
    r = write(client, f"/admin/complaints/{id}/assign", {"version": 1, "staff_id": str(staff.id)})
    assert r.status_code == 200, r.text
    r = change(client, id, 2, "start_investigation")
    assert r.status_code == 200, r.text
    return r.json()["data"]


def findings(client, id, version, actions=None, outcome="inconclusive"):
    return write(
        client,
        f"/admin/complaints/{id}/investigation",
        {
            "version": version,
            "findings": "Private investigation findings",
            "evidence_reviewed": "Photo evidence and owner records reviewed",
            "outcome": outcome,
            "actions": actions or ["no_action"],
            "public_note": "Our team has reviewed this concern.",
        },
        method="put",
    )


def test_report_investigate_resolve_outbox_and_privacy(client, db, setup):
    row = created(client, setup)
    id = row["id"]
    assert row["status"] == "new" and "private@example.com" not in str(row)
    assert client.get("/api/v1/complaints/" + id).status_code == 401
    case = investigate(client, db, id)
    assert case["reporter"]["email"] == "private@example.com"
    assert change(client, id, case["version"], "resolve").status_code == 422
    saved = findings(client, id, case["version"])
    assert saved.status_code == 200, saved.text
    resolved = change(client, id, saved.json()["data"]["version"], "resolve")
    assert resolved.status_code == 200, resolved.text
    assert resolved.json()["data"]["status"] == "resolved"
    mail = db.scalar(select(EmailOutbox).where(EmailOutbox.template == "complaint_reviewed"))
    assert mail and mail.to_email == "private@example.com" and "findings" not in str(mail.payload)
    db.refresh(setup)
    assert setup.status == "published"
    assert "other_open_reports" not in client.get("/api/v1/properties/" + setup.slug).text
    assert len(db.scalars(select(ComplaintEvent)).all()) == 5


def test_client_own_tracker_and_private_fields(client, db, setup):
    owner = login(client, db, "client")
    r = write(
        client,
        "/complaints",
        {
            "kind": "service_complaint",
            "subject": {"type": "general"},
            "description": "I would like help with a concern about the service.",
        },
    )
    assert r.status_code == 201, r.text
    id = r.json()["data"]["id"]
    for path in ["/complaints", "/complaints/" + id]:
        response = client.get("/api/v1" + path)
        assert response.status_code == 200
        for field in [
            "reporter",
            "description",
            "findings",
            "evidence",
            "outcome",
            "upload_token",
            "ip_hash",
        ]:
            assert field not in response.text
    from app.core.security import hasher
    from app.models.identity import User

    another = User(
        email="another@example.com",
        full_name="Other Client",
        phone="+2348011111111",
        password_hash=hasher.hash("Goodpass8!"),
        role="client",
    )
    db.add(another)
    db.commit()
    assert (
        write(client, "/auth/login", {"email": another.email, "password": "Goodpass8!"}).status_code
        == 200
    )
    assert client.get("/api/v1/complaints/" + id).status_code == 404
    assert client.get("/api/v1/admin/complaints").status_code == 403
    assert owner.id != another.id


@pytest.mark.parametrize(
    "payload",
    [
        {"description": "too short"},
        {"description": "My card number is 4111 1111 1111 1111 please inspect it"},
        {"reason": "bad"},
        {"property_slug": "missing"},
        {"description": "<b>short</b>"},
    ],
)
def test_report_validation(client, db, setup, payload):
    assert report(client, setup, **payload).status_code in {422, 404}


def test_duplicate_honeypot_and_no_automatic_action(client, db, setup):
    assert report(client, setup, website="bot").status_code == 201
    assert db.scalar(select(Complaint.id)) is None
    assert report(client, setup).status_code == 201
    assert report(client, setup).status_code == 409
    assert report(client, setup, reason="wrong_price").status_code == 429
    db.refresh(setup)
    assert setup.status == "published"
    assert report(client, setup, reason="other").status_code == 429


@pytest.mark.parametrize("action", ["resolve", "place_hold", "reopen", "release_hold"])
def test_invalid_states(client, db, setup, action):
    id = created(client, setup)["id"]
    login(client, db, "staff")
    assert change(client, id, 1, action, reason="Reviewed reason").status_code in {403, 409}


def test_hold_release_prevents_publication_and_withdraws_media(client, db, setup):
    id = created(client, setup)["id"]
    case = investigate(client, db, id)
    r = change(
        client,
        id,
        case["version"],
        "place_hold",
        reason="Investigating an apparent fraudulent listing",
    )
    assert r.status_code == 200, r.text
    held = r.json()["data"]
    assert held["hold_review_due_at"]
    assert client.get("/api/v1/properties/" + setup.slug).status_code == 404
    from app.services.property_workflow import blockers

    db.refresh(setup)
    assert any("hold" in x for x in blockers(db, setup))
    r = change(
        client,
        id,
        held["version"],
        "release_hold",
        reason="Completed checks; hold is no longer needed",
    )
    assert r.status_code == 200, r.text
    db.refresh(setup)
    assert setup.status == "unpublished"
    assert r.json()["data"]["hold_review_due_at"] is None


def test_admin_only_permanent_actions_and_reopen(client, db, setup):
    id = created(client, setup)["id"]
    case = investigate(client, db, id)
    assert (
        findings(client, id, case["version"], ["listing_rejected"], "substantiated").status_code
        == 403
    )
    login(client, db, "admin")
    assert (
        findings(client, id, case["version"], ["listing_rejected"], "inconclusive").status_code
        == 422
    )
    r = findings(
        client, id, case["version"], ["listing_rejected", "landlord_blocked"], "substantiated"
    )
    assert r.status_code == 200, r.text
    db.refresh(setup)
    assert setup.status == "published"  # save stages only
    r = change(client, id, r.json()["data"]["version"], "resolve")
    assert r.status_code == 200, r.text
    db.refresh(setup)
    assert setup.status == "rejected"
    from app.models.property import Landlord

    assert db.get(Landlord, setup.landlord_id).blocked_at
    resolved = r.json()["data"]
    login(client, db, "staff")
    assert (
        change(client, id, resolved["version"], "reopen", reason="Fresh evidence").status_code
        == 403
    )
    login(client, db, "admin")
    r = change(client, id, resolved["version"], "reopen", reason="Fresh evidence")
    assert r.status_code == 200
    assert r.json()["data"]["findings"] is None


def test_version_assignment_dismissal_guards(client, db, setup):
    id = created(client, setup)["id"]
    login(client, db, "staff")
    assert change(client, id, 9, "start_triage").status_code == 409
    assert change(client, id, 1, "start_investigation").status_code == 409
    assert change(client, id, 1, "dismiss").status_code == 422
    assert (
        write(
            client, f"/admin/complaints/{id}/assign", {"version": 1, "staff_id": str(uuid4())}
        ).status_code
        == 422
    )
    r = change(client, id, 1, "dismiss", dismiss_reason="insufficient_information")
    assert r.status_code == 200
    assert r.json()["data"]["status"] == "dismissed"


def test_upload_remove_access_scope_limits_and_private_grants(client, db, setup, tmp_path):
    row = created(client, setup)
    id = row["id"]
    store = LocalStorage(tmp_path, "test-private-storage-secret-at-least32")
    client.app.state.storage = store
    data = io.BytesIO()
    Image.new("RGB", (10, 10)).save(data, format="PNG")
    raw = data.getvalue()

    def upload(token=row["upload_token"]):
        return client.post(
            f"/api/v1/reports/{id}/files",
            files={"file": ("evidence.png", raw, "image/png")},
            headers={**csrf(client), "X-Upload-Token": token},
        )

    assert upload("wrong").status_code == 404
    files = []
    for _ in range(3):
        r = upload()
        assert r.status_code == 201, r.text
        files.append(r.json()["data"]["id"])
    assert upload().status_code == 422
    assert client.get(f"/api/v1/admin/complaints/{id}/files/{files[0]}").status_code == 401
    login(client, db, "staff")
    r = client.get(f"/api/v1/admin/complaints/{id}/files/{files[0]}")
    assert r.status_code == 200, r.text
    link = r.json()["data"]["url"]
    assert client.get(link).status_code == 200
    assert client.get(link.replace(files[0], files[1])).status_code == 404
    assert (
        client.delete(
            f"/api/v1/reports/{id}/files/{files[0]}",
            headers={**csrf(client), "X-Upload-Token": row["upload_token"]},
        ).status_code
        == 204
    )
    assert client.get(link).status_code == 404


@pytest.mark.parametrize(
    "query", ["bad=1", "status=invalid", "page=0", "page_size=101", "status=new&status=triage"]
)
def test_strict_query(client, db, setup, query):
    login(client, db, "staff")
    assert client.get("/api/v1/admin/complaints?" + query).status_code == 422


def test_event_immutable_and_business_days(client, db, setup):
    created(client, setup)
    with pytest.raises(DBAPIError):
        db.execute(text("UPDATE complaint_events SET note='tampered'"))
        db.commit()
    db.rollback()
    from datetime import UTC, datetime

    assert business_days(datetime(2026, 11, 6, 10, tzinfo=UTC), 2).weekday() == 1


def test_client_rate_sensitive_and_deferred_subject(client, db, setup):
    login(client, db, "client")
    for _ in range(5):
        assert (
            write(
                client,
                "/complaints",
                {
                    "kind": "other",
                    "subject": {"type": "general"},
                    "description": "A separate concern about service handling.",
                },
            ).status_code
            == 201
        )
    assert (
        write(
            client,
            "/complaints",
            {
                "kind": "other",
                "subject": {"type": "general"},
                "description": "A separate concern about service handling.",
            },
        ).status_code
        == 429
    )
    assert (
        write(
            client,
            "/complaints",
            {
                "kind": "dispute",
                "subject": {"type": "transaction", "id": str(uuid4())},
                "description": "This transaction case remains deferred.",
            },
        ).status_code
        == 422
    )


@pytest.mark.parametrize("role", [None, "client", "staff", "admin"])
def test_staff_permission_matrix(client, db, setup, role):
    row = created(client, setup)
    if role:
        login(client, db, role)
    expected = 401 if role is None else 403 if role == "client" else 200
    for path in ["/admin/complaints", "/admin/complaints/" + row["id"], "/admin/complaint-options"]:
        assert client.get("/api/v1" + path).status_code == expected


def test_client_subject_ownership_and_signed_report_tracking(client, db, setup):
    owner = login(client, db, "client")
    row = created(client, setup)
    assert client.get("/api/v1/complaints/" + row["id"]).status_code == 200
    for subject in [
        {"type": "appointment", "id": str(uuid4())},
        {"type": "property", "id": str(uuid4())},
    ]:
        assert (
            write(
                client,
                "/complaints",
                {
                    "kind": "other",
                    "subject": subject,
                    "description": "Please investigate this concern with my property.",
                },
            ).status_code
            == 404
        )
    assert db.get(Complaint, UUID(row["id"])).reporter_user_id == owner.id


def test_evidence_invalid_expired_cross_case_and_closed(client, db, setup, tmp_path):
    row = created(client, setup)
    id = row["id"]
    client.app.state.storage = LocalStorage(tmp_path, "test-private-storage-secret-at-least32")

    def upload(data, token=row["upload_token"], case=id):
        return client.post(
            f"/api/v1/reports/{case}/files",
            files={"file": ("evidence.pdf", data, "application/pdf")},
            headers={**csrf(client), "X-Upload-Token": token},
        )

    assert upload(b"<html>not a pdf</html>").status_code == 415
    assert upload(b"x" * (5 * 1024 * 1024 + 1)).status_code == 413
    assert upload(b"x", case=str(uuid4())).status_code == 404
    c = db.get(Complaint, UUID(id))
    c.upload_token_expires_at = now() - timedelta(seconds=1)
    db.commit()
    assert upload(b"x").status_code == 404
    c.upload_token_expires_at = now() + timedelta(hours=1)
    db.commit()
    login(client, db, "staff")
    assert change(client, id, 1, "dismiss", dismiss_reason="out_of_scope").status_code == 200
    assert upload(b"x").status_code == 409


def test_wrong_risk_cannot_hold_and_saves_do_not_apply_actions(client, db, setup):
    r = report(client, setup, reason="wrong_price")
    assert r.status_code == 201
    id = r.json()["data"]["id"]
    case = investigate(client, db, id)
    assert (
        change(client, id, case["version"], "place_hold", reason="Concern review").status_code
        == 409
    )
    assert findings(client, id, case["version"], ["listing_unpublished"]).status_code == 422
    assert (
        findings(client, id, case["version"], ["no_action", "listing_corrected"]).status_code == 422
    )


def test_csrf_and_json_limits(client, db, setup):
    assert client.post("/api/v1/reports", json={}).status_code == 403
    r = client.post(
        "/api/v1/reports",
        content="x" * 70000,
        headers={**csrf(client), "Content-Type": "application/json"},
    )
    assert r.status_code == 413


def test_migration_roundtrip_preserves_existing_properties(engine, db, client, setup):
    from pathlib import Path

    from alembic.config import Config
    from sqlalchemy import inspect

    from alembic import command
    from tests.conftest import TEST_URL

    created(client, setup)
    pid = setup.id
    db.close()
    cfg = Config(str(Path(__file__).parents[1] / "alembic.ini"))
    cfg.set_main_option("script_location", str(Path(__file__).parents[1] / "alembic"))
    cfg.attributes["database_url"] = TEST_URL
    try:
        command.downgrade(cfg, "be62_appointments")
        assert "complaints" not in inspect(engine).get_table_names()
        with engine.connect() as conn:
            assert (
                conn.scalar(text("SELECT count(*) FROM properties WHERE id=:id"), {"id": pid}) == 1
            )
    finally:
        command.upgrade(cfg, "head")
    assert {"complaints", "complaint_evidence", "complaint_events"} <= set(
        inspect(engine).get_table_names()
    )


def test_concurrent_duplicate_reports_create_one_case(client, db, setup):
    from concurrent.futures import ThreadPoolExecutor

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: report(client, setup), range(2)))
    assert sorted(r.status_code for r in results) == [201, 409], [r.text for r in results]
    assert len(db.scalars(select(Complaint)).all()) == 1


def test_client_evidence_requires_auth_and_private_endpoint(client, db, setup, tmp_path):
    login(client, db, "client")
    result = write(
        client,
        "/complaints",
        {
            "kind": "other",
            "subject": {"type": "general"},
            "description": "Please review this concern about the service.",
        },
    )
    assert result.status_code == 201
    row = result.json()["data"]
    client.app.state.storage = LocalStorage(tmp_path, "test-private-storage-secret-at-least32")
    raw = io.BytesIO()
    Image.new("RGB", (4, 4)).save(raw, format="PNG")
    headers = {**csrf(client), "X-Upload-Token": row["upload_token"]}
    assert (
        client.post(
            f"/api/v1/reports/{row['id']}/files",
            headers=headers,
            files={"file": ("e.png", raw.getvalue(), "image/png")},
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/complaints/{row['id']}/files",
            headers=headers,
            files={"file": ("e.png", raw.getvalue(), "image/png")},
        ).status_code
        == 201
    )
    login(client, db, "staff")
    assert change(client, row["id"], 1, "start_triage").status_code == 409
    assert change(client, row["id"], 2, "start_triage").status_code == 200


def test_sensitive_data_field_code_and_canonical_utc(client, db, setup):
    bad = report(
        client, setup, description="Card number 4111 1111 1111 1111 should not be submitted."
    )
    assert bad.status_code == 422 and bad.json()["error"]["details"][0]["code"] == "sensitive_data"
    row = created(client, setup)
    login(client, db, "staff")
    detail = client.get("/api/v1/admin/complaints/" + row["id"]).json()["data"]
    assert detail["created_at"].endswith("Z") and detail["events"][0]["created_at"].endswith("Z")


def test_captcha_interface_is_fail_closed_without_provider(client, db, setup):
    from unittest.mock import patch

    settings = client.app.state.settings
    with patch.object(settings, "captcha_required", True):
        assert report(client, setup).status_code == 503
        client.app.state.captcha_verifier = lambda token, ip: token == "verified-test-token"
        assert report(client, setup).status_code == 403
        r = write(
            client,
            "/reports",
            {
                "property_slug": setup.slug,
                "reason": "other",
                "description": "Please investigate this concern with the property.",
            },
            headers={"X-Captcha-Token": "verified-test-token"},
        )
        assert r.status_code == 201, r.text


def test_release_closed_hold_keeps_resolution_timestamp_and_notice_count(client, db, setup):
    row = created(client, setup)
    id = row["id"]
    case = investigate(client, db, id)
    held = change(
        client, id, case["version"], "place_hold", reason="Reviewing a high-risk allegation"
    ).json()["data"]
    saved = findings(client, id, held["version"])
    assert saved.status_code == 200
    closed = change(client, id, saved.json()["data"]["version"], "resolve")
    assert closed.status_code == 200
    c = db.get(Complaint, UUID(id))
    resolved_at = c.resolved_at
    before = len(db.scalars(select(EmailOutbox)).all())
    released = change(
        client,
        id,
        closed.json()["data"]["version"],
        "release_hold",
        reason="Precautionary hold reviewed and no longer required",
    )
    assert released.status_code == 200, released.text
    db.refresh(c)
    assert c.resolved_at == resolved_at
    assert len(db.scalars(select(EmailOutbox)).all()) == before


def test_blocked_landlord_cannot_republish(client, db, setup):
    from app.models.property import Landlord
    from app.services.property_workflow import blockers

    owner = db.get(Landlord, setup.landlord_id)
    owner.blocked_at = now()
    db.commit()
    assert any("blocked landlord" in message for message in blockers(db, setup))
    assert client.get("/api/v1/properties/" + setup.slug).status_code == 404


def test_capabilities_match_case_subject_and_admin_staged_actions(client, db, setup):
    login(client, db, "client")
    result = write(
        client,
        "/complaints",
        {
            "kind": "other",
            "subject": {"type": "general"},
            "description": "Please review this general concern about the service.",
        },
    )
    assert result.status_code == 201
    generic_id = result.json()["data"]["id"]
    login(client, db, "admin")
    generic = client.get("/api/v1/admin/complaints/" + generic_id).json()["data"]
    assert set(generic["allowed_case_actions"]) == {"no_action", "client_warned"}
    id = created(client, setup)["id"]
    case = investigate(client, db, id)
    login(client, db, "admin")
    saved = findings(client, id, case["version"], ["landlord_blocked"], "substantiated")
    assert saved.status_code == 200
    login(client, db, "staff")
    current = client.get("/api/v1/admin/complaints/" + id).json()["data"]
    assert "resolve" not in current["allowed_actions"]
    assert "landlord_blocked" not in current["allowed_case_actions"]
    assert change(client, id, current["version"], "resolve").status_code == 403
