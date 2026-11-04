"""Contract state-machine and publish guards against isolated real PostgreSQL."""

import uuid
from datetime import UTC, datetime, timedelta

import pytest
from sqlalchemy import func, select

from app.models.identity import AuditLog
from app.models.property import (
    LandlordApproval,
    PropertyStatusHistory,
    PropertyVerification,
    VerificationCheck,
)
from tests.test_staff_properties import h, login
from tests.test_staff_properties import record as record

# Independent oracle transcribed from API contract §4.6, not implementation data.
EXPECTED = {
    "start_review": ({"submitted", "changes_requested"}, "in_review"),
    "request_changes": ({"in_review"}, "changes_requested"),
    "approve": ({"in_review"}, "approved"),
    "publish": ({"approved", "unpublished"}, "published"),
    "unpublish": ({"published"}, "unpublished"),
    "reject": ({"submitted", "in_review", "changes_requested"}, "rejected"),
    "archive": (
        {
            "draft",
            "submitted",
            "in_review",
            "changes_requested",
            "approved",
            "published",
            "unpublished",
            "rejected",
        },
        "archived",
    ),
    "reopen": ({"archived", "rejected"}, "in_review"),
}
ACTIONS = list(EXPECTED)
STATUSES = [
    "draft",
    "submitted",
    "in_review",
    "changes_requested",
    "approved",
    "published",
    "unpublished",
    "rejected",
    "archived",
]


def url(prop, suffix=""):
    return f"/api/v1/admin/properties/{prop.id}{suffix}"


def version(client, prop):
    return client.get(url(prop)).json()["data"]["version"]


def act(client, prop, action, reason="Recorded test reason"):
    return client.post(
        url(prop, "/transitions"),
        headers=h(client),
        json={"action": action, "reason": reason, "version": version(client, prop)},
    )


def checklist(doc=None):
    return [
        {"code": code, "result": "pass", "evidence_document_id": str(doc.id) if doc else None}
        for code in ["identity", "ownership_docs", "location", "price", "features"]
    ]


def save(client, prop, checks=None, doc=None):
    return client.put(
        url(prop, "/verification"),
        headers=h(client),
        json={
            "method": "desk_review",
            "scope_summary": "Identity, ownership records and property details checked.",
            "checks": checklist(doc) if checks is None else checks,
            "version": version(client, prop),
        },
    )


def complete(client, prop, outcome="passed"):
    return client.post(
        url(prop, "/verification/complete"),
        headers=h(client),
        json={"outcome": outcome, "version": version(client, prop)},
    )


def approval(client, prop, **changes):
    body = {
        "approved_price": {
            "amount": prop.price_amount,
            "currency": "NGN",
            "period": prop.price_period,
        },
        "description_approved": True,
        "method": "phone",
        "approved_at": datetime.now(UTC).isoformat(),
        "version": version(client, prop),
    }
    body.update(changes)
    return client.post(url(prop, "/landlord-approval"), headers=h(client), json=body)


def prepare(client, prop):
    assert act(client, prop, "start_review").status_code == 200
    assert save(client, prop).status_code == 200
    assert complete(client, prop).status_code == 200
    assert approval(client, prop).status_code == 201


@pytest.mark.parametrize("status", STATUSES)
@pytest.mark.parametrize("action", ACTIONS)
def test_all_transition_pairs(db, client, record, status, action):
    actor = login(client, db, "admin")
    prop, _, _ = record
    prop.status = status
    db.commit()
    # Install valid verification/approval so the state table is tested independently.
    verification = PropertyVerification(
        property_id=prop.id,
        status="passed",
        method="desk_review",
        verified_by=actor.id,
        verified_at=datetime.now(UTC),
    )
    db.add(verification)
    db.flush()
    db.add_all(
        [
            VerificationCheck(verification_id=verification.id, code=c["code"], result="pass")
            for c in checklist()
        ]
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
    response = act(client, prop, action)
    legal = status in EXPECTED[action][0]
    assert response.status_code == (200 if legal else 409), response.text
    db.expire_all()
    assert prop.status == (EXPECTED[action][1] if legal else status)
    history = list(
        db.scalars(
            select(PropertyStatusHistory).where(PropertyStatusHistory.property_id == prop.id)
        )
    )
    assert len(history) == (1 if legal else 0)
    if legal:
        assert history[0].from_status == status and history[0].to_status == prop.status
        assert history[0].actor_user_id == actor.id
        assert (
            db.scalar(
                select(func.count())
                .select_from(AuditLog)
                .where(AuditLog.action == "property." + action)
            )
            == 1
        )
        if action == "publish":
            assert prop.published_at and prop.verified_at == verification.verified_at


@pytest.mark.parametrize("role", [None, "client", "staff", "admin"])
@pytest.mark.parametrize("route", ["transition", "verification", "complete", "approval"])
def test_workflow_role_matrix(db, client, record, role, route):
    login(client, db, role)
    prop, _, _ = record
    requests = {
        "transition": ("POST", "/transitions", {"action": "start_review", "version": 1}),
        "verification": (
            "PUT",
            "/verification",
            {"method": "desk_review", "scope_summary": "Review", "checks": []},
        ),
        "complete": ("POST", "/verification/complete", {"outcome": "failed"}),
        "approval": (
            "POST",
            "/landlord-approval",
            {
                "approved_price": {
                    "amount": prop.price_amount,
                    "currency": "NGN",
                    "period": "year",
                },
                "description_approved": True,
                "method": "phone",
                "approved_at": datetime.now(UTC).isoformat(),
            },
        ),
    }
    method, suffix, body = requests[route]
    response = client.request(method, url(prop, suffix), headers=h(client), json=body)
    if role not in {"staff", "admin"}:
        assert response.status_code == (401 if role is None else 403)
    else:
        assert response.status_code == (200 if route == "transition" else 409)


@pytest.mark.parametrize(
    "action,status",
    [
        ("request_changes", "in_review"),
        ("reject", "submitted"),
        ("unpublish", "published"),
        ("reopen", "archived"),
    ],
)
def test_reasons_required(db, client, record, action, status):
    login(client, db, "admin")
    prop, _, _ = record
    prop.status = status
    db.commit()
    assert act(client, prop, action, "  ").status_code == 422


def test_staff_reopen_forbidden_and_capabilities_are_server_owned(db, client, record):
    login(client, db, "staff")
    prop, _, _ = record
    prop.status = "rejected"
    db.commit()
    assert "reopen" not in client.get(url(prop)).json()["data"]["allowed_actions"]
    assert act(client, prop, "reopen").status_code == 403


def test_full_workflow_edit_invalidation_and_publish_recheck(db, client, record):
    login(client, db, "staff")
    prop, _, doc = record
    assert act(client, prop, "approve").status_code == 409
    assert act(client, prop, "start_review").status_code == 200
    assert act(client, prop, "approve").status_code == 409
    assert save(client, prop, doc=doc).status_code == 200
    assert complete(client, prop).status_code == 200
    assert act(client, prop, "approve").status_code == 409
    assert approval(client, prop).status_code == 201
    detail = client.get(url(prop)).json()["data"]
    assert "approve" in detail["allowed_actions"] and detail["publication_blockers"] == []
    assert act(client, prop, "approve").status_code == 200
    response = client.patch(
        url(prop),
        headers=h(client),
        json={
            "version": version(client, prop),
            "description": "Changed description requires renewed owner confirmation.",
        },
    )
    assert response.json()["data"]["approval_invalidated"]
    assert act(client, prop, "publish").status_code == 409
    # Return through an explicit admin archive/reopen to record fresh approval.
    assert act(client, prop, "archive").status_code == 200
    login(client, db, "admin")
    assert act(client, prop, "reopen").status_code == 200
    assert approval(client, prop).status_code == 201
    assert act(client, prop, "approve").status_code == 200
    assert act(client, prop, "publish").status_code == 200
    assert act(client, prop, "unpublish").status_code == 200
    assert act(client, prop, "publish").status_code == 200


@pytest.mark.parametrize(
    "checks",
    [
        [],
        [{"code": "identity", "result": "fail"}],
        [{"code": "identity", "result": "na", "note": "Not applicable"}],
    ],
)
def test_incomplete_checklist_cannot_pass(db, client, record, checks):
    login(client, db, "staff")
    prop, _, _ = record
    assert act(client, prop, "start_review").status_code == 200
    assert save(client, prop, checks).status_code == 200
    assert complete(client, prop).status_code == 409
    assert complete(client, prop, "failed").status_code == 200
    assert complete(client, prop, "failed").status_code == 409


def test_check_validation_evidence_and_immutable_history(db, client, record):
    login(client, db, "staff")
    prop, _, doc = record
    assert act(client, prop, "start_review").status_code == 200
    assert save(client, prop, [{"code": "identity", "result": "na"}]).status_code == 422
    assert save(client, prop, [{"code": "identity", "result": "pass"}] * 2).status_code == 422
    checks = checklist()
    checks[0]["evidence_document_id"] = str(uuid.uuid4())
    assert save(client, prop, checks).status_code == 422
    assert save(client, prop, doc=doc).status_code == 200
    assert complete(client, prop).status_code == 200
    first = client.get(url(prop)).json()["data"]["verification_history"][0]
    assert save(client, prop).status_code == 200
    history = client.get(url(prop)).json()["data"]["verification_history"]
    previous = next(v for v in history if v["id"] == first["id"])
    assert (
        not previous["is_current"]
        and previous["status"] == "passed"
        and previous["checks"] == first["checks"]
    )
    assert not client.get(url(prop)).json()["data"]["is_verified"]


@pytest.mark.parametrize(
    "change",
    [
        {"approved_price": {"amount": 100000, "currency": "NGN", "period": "year"}},
        {"description_approved": False},
        {"approved_at": "2020-01-01T00:00:00"},
        {"approved_at": (datetime.now(UTC) + timedelta(days=1)).isoformat()},
    ],
)
def test_approval_matches_current_listing_and_time(db, client, record, change):
    login(client, db, "staff")
    prop, _, _ = record
    assert act(client, prop, "start_review").status_code == 200
    assert approval(client, prop, **change).status_code == 422


def test_versions_csrf_and_approval_supersession(db, client, record):
    login(client, db, "staff")
    prop, _, _ = record
    prepare(client, prop)
    first = db.scalar(select(LandlordApproval).where(LandlordApproval.property_id == prop.id))
    assert approval(client, prop).status_code == 201
    db.expire_all()
    assert first.superseded_at
    assert (
        client.post(
            url(prop, "/transitions"), headers=h(client), json={"action": "approve", "version": 1}
        ).status_code
        == 409
    )
    assert (
        client.post(
            url(prop, "/transitions"), json={"action": "approve", "version": version(client, prop)}
        ).status_code
        == 403
    )
    assert (
        client.put(
            url(prop, "/verification"),
            headers=h(client),
            json={"method": "desk_review", "checks": [], "scope_summary": "test", "version": 1},
        ).status_code
        == 409
    )


def test_approved_price_change_can_be_reconfirmed_without_reopen(db, client, record):
    login(client, db, "staff")
    prop, _, _ = record
    prepare(client, prop)
    assert act(client, prop, "approve").status_code == 200
    assert (
        client.patch(
            url(prop),
            headers=h(client),
            json={
                "version": version(client, prop),
                "description": "Updated details reconfirmed by the property owner.",
            },
        ).status_code
        == 200
    )
    assert approval(client, prop).status_code == 201
    assert act(client, prop, "publish").status_code == 200


def test_concurrent_transition_only_one_wins(db, client, engine, record):
    from concurrent.futures import ThreadPoolExecutor

    from app.core.database import session_factory
    from app.core.errors import AppError
    from app.schemas.property_workflow import Transition
    from app.services.property_workflow import transition

    actor = login(client, db, "staff")
    prop, _, _ = record
    actor_id, property_id = actor.id, prop.id
    factory = session_factory(engine)

    def run(_):
        with factory() as session:
            try:
                transition(
                    session, actor_id, property_id, Transition(action="start_review", version=1)
                )
                return 200
            except AppError as error:
                return error.status

    with ThreadPoolExecutor(max_workers=2) as pool:
        assert sorted(pool.map(run, range(2))) == [200, 409]


def test_cross_property_document_reference_is_rejected(db, client, record):
    from app.models.property import PropertyDocument
    from tests.test_staff_properties import clone

    login(client, db, "staff")
    prop, _, _ = record
    other = clone(db, prop)
    doc = PropertyDocument(
        property_id=other.id,
        kind="ownership_proof",
        storage_key=f"private/{uuid.uuid4()}.pdf",
        mime_type="application/pdf",
        size_bytes=1,
    )
    db.add(doc)
    db.commit()
    assert act(client, prop, "start_review").status_code == 200
    assert save(client, prop, doc=doc).status_code == 422


@pytest.mark.parametrize(
    "checks",
    [
        [
            {"code": c, "result": "na", "note": "Outside the recorded review scope."}
            for c in ["identity", "ownership_docs", "location", "price", "features"]
        ],
        checklist() + [{"code": "availability", "result": "fail"}],
    ],
)
def test_na_notes_and_optional_failures(db, client, record, checks):
    login(client, db, "staff")
    prop, _, _ = record
    assert act(client, prop, "start_review").status_code == 200
    assert save(client, prop, checks).status_code == 200
    assert complete(client, prop).status_code == (
        409 if any(c["result"] == "fail" for c in checks) else 200
    )


def test_missing_property_unknown_query_and_openapi(client, db):
    login(client, db, "staff")
    missing = f"/api/v1/admin/properties/{uuid.uuid4()}"
    assert (
        client.post(
            missing + "/transitions",
            headers=h(client),
            json={"action": "start_review", "version": 1},
        ).status_code
        == 404
    )
    assert (
        client.post(
            missing + "/transitions?unknown=yes",
            headers=h(client),
            json={"action": "start_review", "version": 1},
        ).status_code
        == 422
    )
    schema = client.app.openapi()
    for path, method in [
        ("transitions", "post"),
        ("verification", "put"),
        ("verification/complete", "post"),
        ("landlord-approval", "post"),
    ]:
        assert "requestBody" in schema["paths"][f"/api/v1/admin/properties/{{id}}/{path}"][method]
