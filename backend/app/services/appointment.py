"""Inspection state machine, independent of email, storage and fee collection."""

from datetime import timedelta

from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError, invalid
from app.core.security import now
from app.models.appointment import Appointment, AppointmentHistory
from app.models.identity import AuditLog
from app.models.inquiry import InquiryHistory
from app.repositories import appointment as repo
from app.schemas import appointment as schema
from app.schemas.inquiry import PropertyRef
from app.services.inquiry import client_out, require_staff


def conflict(message):
    return AppError(409, "INVALID_STATE_TRANSITION", message)


def get(db, actor, appointment_id, lock=False):
    row = repo.get(db, actor, appointment_id, lock)
    if not row:
        raise AppError(404, "NOT_FOUND", "Inspection not found.")
    return row


def allowed(row, role):
    if role == "client":
        actions = ["cancel", "request_reschedule"] if row.status in repo.ACTIVE else []
        if row.status == "proposed" and row.scheduled_at > now():
            actions.insert(0, "confirm")
        return actions
    actions = ["reschedule", "cancel"] if row.status in repo.ACTIVE else []
    if row.status == "confirmed" and row.ends_at <= now():
        actions += ["complete", "no_show"]
    return actions


def summary(db, row, role):
    prop = repo.property_record(db, row.property_id)
    staff = repo.user(db, row.staff_id)
    return schema.SummaryClient(
        id=row.id,
        reference=f"APT-{row.id}",
        inquiry_id=row.inquiry_id,
        property=PropertyRef(
            id=prop.id, slug=prop.slug if prop.status == "published" else None, title=prop.title
        ),
        staff_name=staff.full_name,
        scheduled_at=row.scheduled_at,
        ends_at=row.ends_at,
        duration_minutes=row.duration_minutes,
        status=row.status,
        version=row.row_version,
        fee=schema.Fee(),
        allowed_actions=allowed(row, role),
        requested_scheduled_at=row.requested_scheduled_at,
        outcome=row.outcome,
        created_at=row.created_at,
        updated_at=row.updated_at,
    )


def detail(db, actor, appointment_id):
    row = get(db, actor, appointment_id)
    out = summary(db, row, actor.role)
    if actor.role == "client":
        disclosed = (
            row.status in {"confirmed", "completed"} and row.address_disclosed_at is not None
        )
        return schema.DetailClient(
            **out.model_dump(),
            meeting_address=row.meeting_address if disclosed else None,
            meeting_instructions=row.meeting_instructions if disclosed else None,
        )
    prop = repo.property_record(db, row.property_id)
    return schema.DetailStaff(
        **out.model_dump(),
        confirmed_meeting_address=row.meeting_address,
        client=client_out(repo.user(db, row.client_id)),
        staff_id=row.staff_id,
        address_line=prop.address_line,
        landlord_rep_name=row.landlord_rep_name,
        landlord_rep_phone=row.landlord_rep_phone,
        meeting_instructions=row.meeting_instructions,
        address_disclosed_at=row.address_disclosed_at,
        reschedule_reason=row.reschedule_reason,
        cancellation_reason=row.cancellation_reason,
        outcome_notes=row.outcome_notes,
        history=[
            schema.History(**{k: getattr(h, k) for k in schema.History.model_fields})
            for h in repo.history(db, row.id)
        ],
    )


def listing(db, actor, **filters):
    rows, meta = repo.appointments(db, actor, **filters)
    return {"data": [summary(db, row, actor.role) for row in rows], "meta": meta}


def audit(db, actor, row, action):
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            entity_type="appointment",
            entity_id=row.id,
            action="appointment." + action,
            after={"status": row.status, "version": row.row_version},
        )
    )


def history(db, actor, row, previous, reason=None):
    db.add(
        AppointmentHistory(
            appointment_id=row.id,
            from_status=previous,
            to_status=row.status,
            actor_user_id=actor.id,
            reason=reason,
        )
    )


def database_conflict(db, exc):
    db.rollback()
    name = getattr(getattr(exc.orig, "diag", None), "constraint_name", None)
    if name in {
        "ex_appointment_staff_slot",
        "ex_appointment_property_slot",
        "uq_appointment_active_inquiry",
    }:
        raise AppError(
            409,
            "CONFLICT",
            "This staff member, property or inquiry already has an overlapping active inspection. Choose another slot.",
        ) from None
    raise exc


def commit(db):
    try:
        db.commit()
    except IntegrityError as exc:
        database_conflict(db, exc)


def check_version(row, value):
    if row.row_version != value:
        raise AppError(
            409, "VERSION_CONFLICT", "This inspection changed. Refresh before continuing."
        )


def slot(db, data):
    if data.scheduled_at <= now():
        raise invalid("scheduled_at", "Choose a future appointment time.")
    staff = repo.active_staff(db, data.staff_id)
    if not staff:
        raise invalid("staff_id", "Choose an active staff member.")
    return data.scheduled_at + timedelta(minutes=data.duration_minutes)


def update_inquiry(db, actor, row, target, reason):
    inquiry = repo.inquiry(db, row.inquiry_id, True)
    # Never reopen a closed inquiry just because an appointment is cancelled.
    if inquiry.status not in {"qualified", "inspection_scheduled"}:
        return
    if inquiry.status == target:
        return
    before = inquiry.status
    inquiry.status = target
    inquiry.row_version += 1
    inquiry.updated_at = now()
    db.add(
        InquiryHistory(
            inquiry_id=inquiry.id,
            from_status=before,
            to_status=target,
            actor_user_id=actor.id,
            reason=reason,
        )
    )
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            entity_type="inquiry",
            entity_id=inquiry.id,
            action="inquiry.appointment_status_changed",
            after={"status": target, "version": inquiry.row_version},
        )
    )


def create(db, actor, data):
    require_staff(actor)
    inquiry = repo.inquiry(db, data.inquiry_id, True)
    if not inquiry:
        raise AppError(404, "NOT_FOUND", "Inquiry not found.")
    if inquiry.row_version != data.version:
        raise AppError(409, "VERSION_CONFLICT", "This inquiry changed. Refresh before scheduling.")
    if inquiry.status != "qualified" or not inquiry.property_id:
        raise conflict("Qualify a property inquiry before scheduling an inspection.")
    client = repo.user(db, inquiry.client_id)
    if not client.is_active:
        raise conflict("This client account is inactive.")
    prop = repo.published_property(db, inquiry.property_id)
    if not prop or prop.availability_status != "available":
        raise conflict("Choose an available published property before scheduling.")
    end = slot(db, data)
    landlord = repo.owner(db, prop.id)
    row = Appointment(
        inquiry_id=inquiry.id,
        property_id=prop.id,
        client_id=inquiry.client_id,
        staff_id=data.staff_id,
        scheduled_at=data.scheduled_at,
        ends_at=end,
        duration_minutes=data.duration_minutes,
        meeting_instructions=data.meeting_instructions,
        landlord_rep_name=data.landlord_rep_name or landlord.full_name,
        landlord_rep_phone=data.landlord_rep_phone or landlord.phone,
    )
    db.add(row)
    try:
        db.flush()
    except IntegrityError as exc:
        database_conflict(db, exc)
    history(db, actor, row, None)
    update_inquiry(db, actor, row, "inspection_scheduled", "Inspection proposed by the team.")
    audit(db, actor, row, "created")
    commit(db)
    return detail(db, actor, row.id)


def change(db, actor, appointment_id, data, action):
    if actor.role != "client":
        require_staff(actor)
    # Consistent lock order: inquiry before appointment, then property.
    peek = get(db, actor, appointment_id)
    repo.inquiry(db, peek.inquiry_id, True)
    row = get(db, actor, appointment_id, True)
    check_version(row, data.version)
    if action not in allowed(row, actor.role):
        raise conflict("This action is unavailable for the current inspection.")
    previous = row.status
    reason = getattr(data, "reason", None)
    if action == "confirm":
        prop = repo.published_property(db, row.property_id)
        if not prop or prop.availability_status != "available":
            raise conflict("This property is unavailable. Please speak to our team.")
        row.status = "confirmed"
        row.address_disclosed_at = now()
        row.meeting_address = prop.address_line
    elif action == "cancel":
        row.status = (
            "cancelled_by_client" if actor.role == "client" else "cancelled_by_" + data.cancelled_by
        )
        row.cancellation_reason = reason
        update_inquiry(
            db, actor, row, "qualified", "Inspection cancelled; another slot may be proposed."
        )
    elif action == "request_reschedule":
        if data.preferred_at is not None and data.preferred_at <= now():
            raise invalid("preferred_at", "Choose a future preferred time.")
        row.status = "reschedule_requested"
        row.requested_scheduled_at = data.preferred_at
        row.reschedule_reason = reason
    elif action == "reschedule":
        end = slot(db, data)
        prop = repo.published_property(db, row.property_id)
        if not prop or prop.availability_status != "available":
            raise conflict("This property is unavailable for a new proposal.")
        row.scheduled_at = data.scheduled_at
        row.ends_at = end
        row.staff_id = data.staff_id
        row.duration_minutes = data.duration_minutes
        for name in ["meeting_instructions", "landlord_rep_name", "landlord_rep_phone"]:
            setattr(row, name, getattr(data, name))
        row.status = "proposed"
        row.address_disclosed_at = None
        row.meeting_address = None
        row.requested_scheduled_at = None
        row.reschedule_reason = reason
    else:
        if data.no_show:
            row.status = "no_show"
            row.outcome = None
            if not (data.notes or "").strip():
                raise invalid("notes", "Provide a no-show note.")
            update_inquiry(
                db, actor, row, "qualified", "Inspection recorded as no-show; follow-up required."
            )
        else:
            if data.outcome is None:
                raise invalid("outcome", "Choose the inspection outcome.")
            row.status = "completed"
            row.outcome = data.outcome
        row.outcome_notes = data.notes
    row.row_version += 1
    row.updated_at = now()
    history(db, actor, row, previous, reason)
    audit(db, actor, row, action)
    commit(db)
    return detail(db, actor, row.id)
