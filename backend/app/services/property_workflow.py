"""Server-owned listing workflow. No storage publication or notification side effects."""

from app.core.errors import AppError, invalid
from app.models.property import (
    LandlordApproval,
    PropertyStatusHistory,
    PropertyVerification,
    VerificationCheck,
)
from app.repositories import property_workflow as repo
from app.services.property_admin import locked, moment, mutation, record

REQUIRED = {"identity", "ownership_docs", "location", "price", "features"}
TRANSITIONS = {
    "start_review": ({"submitted", "changes_requested"}, "in_review"),
    "request_changes": ({"in_review"}, "changes_requested"),
    "approve": ({"in_review"}, "approved"),
    "publish": ({"approved", "unpublished"}, "published"),
    "unpublish": ({"published"}, "unpublished"),
    "reject": ({"in_review", "submitted", "changes_requested"}, "rejected"),
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
REASONS = {"request_changes", "unpublish", "reject", "reopen"}


def conflict(message):
    return AppError(409, "INVALID_STATE_TRANSITION", message)


def in_review(prop):
    if prop.status != "in_review":
        raise conflict(
            "Start or reopen the review before recording verification or landlord approval."
        )


def valid_checks(checks):
    by_code = {check.code: check for check in checks}
    return REQUIRED <= by_code.keys() and all(
        c.result in {"pass", "na"} and (c.result != "na" or (c.note or "").strip()) for c in checks
    )


def blockers(db, prop):
    result = []
    verification = repo.current_verification(db, prop.id)
    if verification is None or verification.status != "passed" or verification.verified_at is None:
        result.append("Complete a passing verification.")
    elif not valid_checks(repo.checks(db, verification.id)):
        result.append("Complete all required verification checks without failures.")
    else:
        evidence = repo.evidence_ids(db, prop.id)
        if any(
            c.evidence_document_id and c.evidence_document_id not in evidence
            for c in repo.checks(db, verification.id)
        ):
            result.append("Verification evidence must belong to this property.")
    approval = repo.current_approval(db, prop.id)
    if (
        approval is None
        or not approval.description_approved
        or approval.approved_price_amount != prop.price_amount
        or approval.approved_price_period != prop.price_period
        or approval.approved_at > moment()
    ):
        result.append("Record landlord approval of the current price and description.")
    return result


def capabilities(db, prop, role):
    missing = blockers(db, prop)
    actions = [
        action
        for action, (sources, _) in TRANSITIONS.items()
        if prop.status in sources
        and (action != "reopen" or role == "admin")
        and (action not in {"approve", "publish"} or not missing)
    ]
    workflows = (
        ["record_landlord_approval"]
        if prop.status in {"in_review", "approved", "unpublished"}
        else []
    )
    if prop.status == "in_review":
        workflows.append("save_verification")
        current = repo.current_verification(db, prop.id)
        if current is not None and current.status == "in_progress":
            workflows.append("complete_verification")
    return dict(allowed_actions=actions, allowed_workflows=workflows, publication_blockers=missing)


def save_verification(db, actor_id, property_id, data):
    actor, prop = locked(db, actor_id, property_id, data.version)
    in_review(prop)
    documents = repo.evidence_ids(db, prop.id)
    for check in data.checks:
        if check.evidence_document_id and check.evidence_document_id not in documents:
            raise invalid(
                "checks.evidence_document_id",
                "Choose evidence belonging to this property.",
                "invalid_choice",
            )
    current = repo.current_verification(db, prop.id)
    if current:
        current.is_current = False
        db.flush()
    verification = PropertyVerification(
        property_id=prop.id,
        method=data.method,
        scope_summary=data.scope_summary.strip(),
        verified_by=actor.id,
        status="in_progress",
        is_current=True,
    )
    db.add(verification)
    db.flush()
    db.add_all(
        [
            VerificationCheck(verification_id=verification.id, **check.model_dump())
            for check in data.checks
        ]
    )
    prop.verified_at = None
    record(
        db, prop, actor, "property.verification_saved", {"verification_id": str(verification.id)}
    )
    return mutation(prop)


def complete_verification(db, actor_id, property_id, data):
    actor, prop = locked(db, actor_id, property_id, data.version)
    in_review(prop)
    current = repo.current_verification(db, prop.id)
    if current is None or current.status != "in_progress":
        raise conflict("Save a working verification before completing it.")
    checks = repo.checks(db, current.id)
    if data.outcome == "passed" and not valid_checks(checks):
        raise conflict(
            "Passing requires identity, ownership, location, price and features checks, with notes for not-applicable results and no failures."
        )
    documents = repo.evidence_ids(db, prop.id)
    if any(c.evidence_document_id and c.evidence_document_id not in documents for c in checks):
        raise conflict("Verification evidence must belong to this property.")
    current.status = data.outcome
    current.verified_at = moment()
    current.verified_by = actor.id
    prop.verified_at = current.verified_at if data.outcome == "passed" else None
    record(
        db,
        prop,
        actor,
        "property.verification_completed",
        {"verification_id": str(current.id), "outcome": data.outcome},
    )
    return mutation(prop)


def approve_landlord(db, actor_id, property_id, data):
    actor, prop = locked(db, actor_id, property_id, data.version)
    if prop.status not in {"in_review", "approved", "unpublished"}:
        raise conflict("Start the review or unpublish before recording landlord approval.")
    if (
        data.approved_at.tzinfo is None
        or data.approved_at.utcoffset() is None
        or data.approved_at > moment()
    ):
        raise invalid("approved_at", "Use a timezone-aware time that is not in the future.")
    if (data.approved_price.amount, data.approved_price.currency, data.approved_price.period) != (
        prop.price_amount,
        prop.currency,
        prop.price_period,
    ):
        raise invalid("approved_price", "Approval must match the current listing price and period.")
    current = repo.current_approval(db, prop.id)
    if current:
        current.superseded_at = moment()
        db.flush()
    approval = LandlordApproval(
        property_id=prop.id,
        approved_price_amount=data.approved_price.amount,
        approved_price_period=data.approved_price.period,
        description_approved=True,
        method=data.method,
        note=data.note,
        recorded_by=actor.id,
        approved_at=data.approved_at,
    )
    db.add(approval)
    record(db, prop, actor, "property.landlord_approval_recorded", {"method": data.method})
    return mutation(prop)


def transition(db, actor_id, property_id, data):
    actor, prop = locked(db, actor_id, property_id, data.version)
    if data.action == "reopen" and actor.role != "admin":
        raise AppError(403, "FORBIDDEN", "Only an admin can reopen a listing.")
    sources, target = TRANSITIONS[data.action]
    if prop.status not in sources:
        raise conflict("This action is unavailable for the current listing status.")
    if data.action in REASONS and not data.reason:
        raise invalid("reason", "Explain why this action is needed.")
    if data.action in {"approve", "publish"}:
        missing = blockers(db, prop)
        if missing:
            raise conflict(" ".join(missing))
    previous = prop.status
    prop.status = target
    if target == "published":
        prop.published_at = moment()
        prop.verified_at = repo.current_verification(db, prop.id).verified_at
    db.add(
        PropertyStatusHistory(
            property_id=prop.id,
            from_status=previous,
            to_status=target,
            actor_user_id=actor.id,
            reason=data.reason,
        )
    )
    record(
        db,
        prop,
        actor,
        "property." + data.action,
        {"from_status": previous, "to_status": target, "reason": data.reason},
    )
    return mutation(prop)
