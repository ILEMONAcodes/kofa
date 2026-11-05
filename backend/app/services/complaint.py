"""Verify-before-action complaints; no report-count driven publication changes."""

import hashlib
import hmac
import io
import secrets
from datetime import timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.core.errors import AppError, invalid
from app.core.security import digest, now
from app.models.complaint import Complaint, ComplaintEvent, ComplaintEvidence
from app.models.identity import AuditLog, EmailOutbox
from app.models.property import PropertyStatusHistory, StorageDeletion
from app.repositories import complaint as repo
from app.schemas import complaint as s
from app.services.media_validation import (
    MIB,
    read_bounded,
    unsupported,
    validate_image,
    validate_pdf,
)

CLOSED = {"resolved", "dismissed"}
PERMANENT = {"listing_rejected", "landlord_blocked"}


def missing():
    return AppError(404, "NOT_FOUND", "Case not found.")


def state(message="This action is not available for the current case."):
    return AppError(409, "INVALID_STATE_TRANSITION", message)


def staff(actor):
    if actor.role not in {"staff", "admin"}:
        raise AppError(403, "FORBIDDEN", "Team access required.")


def business_days(value, days):
    v = value.astimezone(ZoneInfo("Africa/Lagos"))
    while days:
        v += timedelta(days=1)
        if v.weekday() < 5:
            days -= 1
    return v


def ip_key(settings, ip):
    return hmac.new(
        settings.auth_secret.get_secret_value().encode(),
        ("complaint-ip:" + ip).encode(),
        hashlib.sha256,
    ).hexdigest()


def summary(c):
    return s.CaseSummary(
        id=c.id,
        reference="CMP-" + str(c.id),
        kind=c.kind,
        status=c.status,
        created_at=c.created_at,
        public_note=c.public_note,
    )


def event(db, c, actor, note, previous=None):
    db.add(
        ComplaintEvent(
            complaint_id=c.id,
            from_status=previous or c.status,
            to_status=c.status,
            actor_user_id=actor.id if actor else None,
            note=note,
        )
    )
    if actor:
        db.add(
            AuditLog(
                actor_user_id=actor.id,
                action="complaint." + note.split(":")[0],
                entity_type="complaint",
                entity_id=c.id,
                after={"status": c.status, "version": c.row_version},
            )
        )


def receipt(c, token, contact):
    return s.Receipt(
        id=c.id,
        reference="CMP-" + str(c.id),
        upload_token=token,
        upload_token_expires_at=c.upload_token_expires_at,
        message="Your report has been received for review."
        if contact
        else "Received for review. Without contact details we cannot follow up.",
    )


def create(db, settings, data, ip, actor=None):
    token = secrets.token_urlsafe(32)
    expiry = now() + timedelta(hours=24)
    identity = ip_key(settings, ip)
    if isinstance(data, s.Report):
        if data.website:
            return s.Receipt(
                id=uuid4(),
                reference="CMP-" + str(uuid4()),
                upload_token=token,
                upload_token_expires_at=expiry,
                message="Received for review.",
            )
        prop = repo.public_property(db, data.property_slug)
        if prop is None:
            raise missing()
        keys = [identity]
        if actor:
            keys.append(str(actor.id))
        for key in sorted(keys):
            repo.serialize_duplicate(db, key + str(prop.id) + data.reason)
        if repo.duplicate(
            db,
            identity,
            prop.id,
            data.reason,
            now() - timedelta(hours=24),
            actor.id if actor else None,
        ):
            raise AppError(
                409,
                "CONFLICT",
                "A matching report was received within the past 24 hours.",
                [
                    {
                        "field": "property_slug",
                        "code": "duplicate_report",
                        "message": "A matching report already exists.",
                    }
                ],
            )
        c = Complaint(
            reporter_user_id=actor.id if actor and actor.role == "client" else None,
            kind="suspicious_listing",
            reason=data.reason,
            property_id=prop.id,
            description=data.description,
            reporter_name=data.reporter.name,
            reporter_email=str(data.reporter.email) if data.reporter.email else None,
            reporter_phone=data.reporter.phone,
        )
    else:
        property_id = None
        appointment_id = None
        if data.subject.type == "property":
            prop = repo.subject_property(db, actor, data.subject.id)
            if not prop:
                raise missing()
            property_id = prop.id
        elif data.subject.type == "appointment":
            appt = repo.own_appointment(db, actor, data.subject.id)
            if not appt:
                raise missing()
            property_id = appt.property_id
            appointment_id = appt.id
        c = Complaint(
            kind=data.kind,
            property_id=property_id,
            appointment_id=appointment_id,
            description=data.description,
            occurred_on=data.occurred_on,
            desired_outcome=data.desired_outcome,
            reporter_user_id=actor.id,
            reporter_name=actor.full_name,
            reporter_email=actor.email,
            reporter_phone=actor.phone,
        )
    c.reporter_ip_hash = identity
    c.upload_token_hash = digest(token)
    c.upload_token_expires_at = expiry
    db.add(c)
    db.flush()
    event(db, c, actor, "created")
    db.commit()
    db.refresh(c)
    return receipt(c, token, bool(c.reporter_email or c.reporter_phone))


def get(db, actor, id, version=None):
    c = repo.get(db, id, actor, lock=version is not None)
    if c is None:
        raise missing()
    if version is not None and c.row_version != version:
        raise AppError(409, "CONFLICT", "This case changed. Refresh before continuing.")
    return c


def allowed(c, actor):
    actions = []
    if c.status == "new":
        actions += ["start_triage"]
    if c.status in {"new", "triage"} and c.assigned_staff_id:
        actions += ["start_investigation"]
    if c.status == "investigating" and (
        actor.role == "admin" or not PERMANENT.intersection(c.actions_taken)
    ):
        actions += ["resolve"]
    if c.status not in CLOSED:
        actions += ["dismiss"]
        if (
            c.property_id
            and c.reason in {"fake_listing", "asked_to_pay_outside"}
            and not c.hold_property_id
            and c.status in {"triage", "investigating"}
        ):
            actions += ["place_hold"]
    elif actor.role == "admin":
        actions += ["reopen"]
    if c.hold_property_id:
        actions += ["release_hold"]
    return actions


def case_actions(c, actor):
    result = ["no_action"]
    if c.reporter_user_id:
        result.append("client_warned")
    if c.property_id:
        result.extend(["listing_corrected", "landlord_warned"])
        if c.reason in {"fake_listing", "asked_to_pay_outside"}:
            result.append("listing_unpublished")
        if actor.role == "admin":
            result.extend(sorted(PERMANENT))
    return result


def detail(db, actor, id):
    c = get(db, actor, id)
    if actor.role == "client":
        return summary(c)
    staff(actor)
    other = repo.other_open_count(db, c.property_id, c.id)
    return s.StaffDetail(
        **summary(c).model_dump(),
        reason=c.reason,
        description=c.description,
        reporter=s.ReporterOut(
            name=c.reporter_name, email=c.reporter_email, phone=c.reporter_phone
        ),
        reporter_user_id=c.reporter_user_id,
        property_id=c.property_id,
        appointment_id=c.appointment_id,
        occurred_on=c.occurred_on,
        desired_outcome=c.desired_outcome,
        assigned_staff_id=c.assigned_staff_id,
        findings=c.investigation_findings,
        evidence_reviewed=c.evidence_reviewed,
        outcome=c.outcome,
        actions=c.actions_taken,
        dismiss_reason=c.dismiss_reason,
        hold_review_due_at=c.hold_review_due_at,
        version=c.row_version,
        other_open_reports=other,
        evidence=[
            s.Evidence(id=e.id, mime_type=e.mime_type, size_bytes=e.size_bytes)
            for e in repo.evidence(db, c.id)
        ],
        events=[
            s.Event(
                from_status=e.from_status,
                to_status=e.to_status,
                note=e.note,
                created_at=e.created_at,
            )
            for e in repo.events(db, c.id)
        ],
        allowed_actions=allowed(c, actor),
        allowed_case_actions=case_actions(c, actor),
    )


def listing(db, actor, filters, page, size):
    deadline = now()
    left = 2
    while left:
        deadline -= timedelta(days=1)
        if deadline.astimezone(ZoneInfo("Africa/Lagos")).weekday() < 5:
            left -= 1
    filters["deadline"] = deadline
    rows, total = repo.listing(db, actor, filters, page, size)
    return {
        "data": [summary(c) for c in rows],
        "meta": {
            "page": page,
            "page_size": size,
            "total_items": total,
            "total_pages": (total + size - 1) // size,
        },
    }


def prop_lock(db, c):
    p = repo.locked_property(db, c.property_id)
    if p is None:
        raise invalid("actions", "This action requires a property.")
    return p


def property_status(db, p, actor, c, status):
    old = p.status
    p.status = status
    p.row_version += 1
    if status != "published":
        p.published_at = None
    db.add(
        PropertyStatusHistory(
            property_id=p.id,
            from_status=old,
            to_status=status,
            actor_user_id=actor.id,
            reason="Complaint " + str(c.id) + " reviewed action",
        )
    )


def validate_actions(c, actor, actions, outcome):
    if "client_warned" in actions and c.reporter_user_id is None:
        raise invalid("actions", "This case does not identify a client to warn.")
    if PERMANENT.intersection(actions):
        if actor.role != "admin":
            raise AppError(403, "FORBIDDEN", "Only an admin can take permanent action.")
        if outcome not in {"substantiated", "partially_substantiated"}:
            raise invalid("outcome", "Permanent actions require substantiated findings.")
    if (
        any(a.startswith("listing_") or a.startswith("landlord_") for a in actions)
        and not c.property_id
    ):
        raise invalid("actions", "Choose actions relevant to this case.")
    if "listing_unpublished" in actions and c.reason not in {
        "fake_listing",
        "asked_to_pay_outside",
    }:
        raise invalid(
            "actions", "A precautionary hold is only available for high-risk listing reports."
        )


def hold(db, c, actor):
    p = prop_lock(db, c)
    if p.status != "published":
        raise state("Only a published property can be placed on hold.")
    property_status(db, p, actor, c, "unpublished")
    c.hold_property_id = p.id
    c.hold_review_due_at = business_days(now(), 2)


def mutate(db, actor, id, data, operation):
    staff(actor)
    c = get(db, actor, id, data.version)
    previous = c.status
    if operation == "assign":
        if c.status in CLOSED:
            raise state()
        if not repo.staff(db, data.staff_id):
            raise invalid("staff_id", "Choose an active team member.")
        c.assigned_staff_id = data.staff_id
    elif operation == "investigation":
        if c.status != "investigating":
            raise state("Start the investigation before saving findings.")
        validate_actions(c, actor, data.actions, data.outcome)
        c.investigation_findings = data.findings
        c.evidence_reviewed = data.evidence_reviewed
        c.outcome = data.outcome
        c.actions_taken = data.actions
        c.public_note = data.public_note
    else:
        action = data.action
        if (
            action == "resolve"
            and PERMANENT.intersection(c.actions_taken)
            and actor.role != "admin"
        ):
            raise AppError(403, "FORBIDDEN", "Only an admin can take permanent action.")
        if action == "reopen" and actor.role != "admin":
            raise AppError(403, "FORBIDDEN", "Only an admin may reopen cases.")
        if action not in allowed(c, actor):
            raise state()
        if action in {"place_hold", "release_hold", "reopen"} and not (data.reason or "").strip():
            raise invalid("reason", "Provide a reason.")
        if action == "start_triage":
            c.status = "triage"
        elif action == "start_investigation":
            c.status = "investigating"
        elif action == "place_hold":
            hold(db, c, actor)
        elif action == "release_hold":
            prop_lock(db, c)  # serialize against publication/other holds
            c.hold_property_id = None
            c.hold_review_due_at = None
        elif action == "dismiss":
            if data.dismiss_reason is None:
                raise invalid("dismiss_reason", "Choose a dismissal reason.")
            c.status = "dismissed"
            c.dismiss_reason = data.dismiss_reason
        elif action == "reopen":
            c.status = "investigating"
            c.resolved_at = None
            c.dismiss_reason = None
            c.investigation_findings = None
            c.evidence_reviewed = None
            c.outcome = None
            c.actions_taken = []
        elif action == "resolve":
            if (
                not c.investigation_findings
                or not c.evidence_reviewed
                or not c.outcome
                or not c.actions_taken
            ):
                raise invalid(
                    "findings",
                    "Save findings, evidence reviewed, outcome and actions before resolving.",
                )
            validate_actions(c, actor, c.actions_taken, c.outcome)
            if "listing_unpublished" in c.actions_taken and not c.hold_property_id:
                hold(db, c, actor)
            if PERMANENT.intersection(c.actions_taken):
                p = prop_lock(db, c)
                if "listing_rejected" in c.actions_taken:
                    property_status(db, p, actor, c, "rejected")
                if "landlord_blocked" in c.actions_taken:
                    owner = repo.locked_owner(db, p.landlord_id)
                    owner.blocked_at = now()
                    owner.blocked_reason = "Substantiated complaint " + str(c.id)
            c.status = "resolved"
        if c.status in CLOSED and previous not in CLOSED:
            c.resolved_at = now()
            if c.reporter_email:
                db.add(
                    EmailOutbox(
                        to_email=c.reporter_email,
                        template="complaint_reviewed",
                        payload={"public_note": c.public_note or ""},
                    )
                )
    c.first_response_at = c.first_response_at or now()
    c.row_version += 1
    event(
        db,
        c,
        actor,
        operation
        + (
            ":" + data.action + (":" + data.reason if data.reason else "")
            if operation == "transition"
            else ""
        ),
        previous,
    )
    db.commit()
    return detail(db, actor, id)


def upload_case(db, id, token, actor=None):
    c = repo.get(db, id, actor, lock=True)
    if (
        c is None
        or (actor is None and c.kind != "suspicious_listing")
        or not secrets.compare_digest(c.upload_token_hash, digest(token))
        or c.upload_token_expires_at <= now()
    ):
        raise missing()
    if c.status in CLOSED:
        raise state("Evidence cannot be changed after case closure.")
    return c


def upload(db, storage, id, token, file, actor=None):
    c = upload_case(db, id, token, actor)
    if len(repo.evidence(db, id)) >= 3:
        raise invalid("file", "A case may contain up to three evidence files.")
    raw = read_bounded(file.file, 5 * MIB)
    if raw.startswith(b"%PDF-"):
        validated = validate_pdf(raw, "evidence.pdf")
    else:
        validated = validate_image(raw, "other", "evidence")
    if validated.mime not in {"image/jpeg", "image/png", "application/pdf"}:
        raise unsupported()
    if len(validated.data) > 5 * MIB:
        raise invalid("file", "Evidence exceeds the five-megabyte limit.")
    e = ComplaintEvidence(
        id=uuid4(),
        complaint_id=id,
        mime_type=validated.mime,
        size_bytes=len(validated.data),
        storage_key="pending",
    )
    e.storage_key = f"private/complaints/{id}/{e.id}.{validated.extension}"
    storage.put(e.storage_key, io.BytesIO(validated.data), validated.mime)
    try:
        db.add(e)
        c.row_version += 1
        event(db, c, actor, "evidence_uploaded")
        db.commit()
    except Exception:
        db.rollback()
        storage.delete(e.storage_key)
        raise
    return s.Evidence(id=e.id, mime_type=e.mime_type, size_bytes=e.size_bytes)


def remove(db, id, file_id, token, actor=None):
    c = upload_case(db, id, token, actor)
    e = repo.file_record(db, id, file_id)
    if e is None:
        raise missing()
    db.add(StorageDeletion(storage_key=e.storage_key))
    db.delete(e)
    c.row_version += 1
    event(db, c, actor, "evidence_removed")
    db.commit()


def evidence_record(db, actor, id, file_id):
    staff(actor)
    get(db, actor, id)
    e = repo.file_record(db, id, file_id)
    if e is None:
        raise missing()
    return e
