"""Inquiry workflow and audience-specific serializers. Never serialize ORM objects."""

import hashlib
from datetime import timedelta

from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError, invalid
from app.core.security import now
from app.models.identity import AuditLog, User
from app.models.inquiry import Inquiry, InquiryHistory, InquiryMessage, InquiryNote, InquiryRequest
from app.models.property import Property
from app.repositories import inquiry as repo
from app.repositories.identity import revoke_user
from app.schemas import inquiry as schema

TRANSITIONS = {
    "start": ({"new"}, "in_progress"),
    "qualify": ({"in_progress"}, "qualified"),
    "negotiate": ({"qualified", "inspection_scheduled"}, "negotiating"),
    "close_won": ({"negotiating"}, "closed_won"),
    "close_lost": (
        {"new", "in_progress", "qualified", "inspection_scheduled", "negotiating"},
        "closed_lost",
    ),
    "mark_spam": (
        {"new", "in_progress", "qualified", "inspection_scheduled", "negotiating"},
        "spam",
    ),
}


def require_staff(actor):
    if actor.role not in {"staff", "admin"}:
        raise AppError(403, "FORBIDDEN", "Staff access required.")


def get(db, actor, inquiry_id, lock=False):
    row = repo.locked(db, inquiry_id, actor, lock)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Inquiry not found.")
    return row


def receipt(row):
    return schema.Receipt(id=row.id, reference=f"INQ-{row.id}")


def client_out(user):
    return schema.Client(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        phone=user.phone,
        is_active=user.is_active,
        version=user.row_version,
        created_at=user.created_at,
    )


def summary(db, row, role="client"):
    prop = db.get(Property, row.property_id) if row.property_id else None
    # Existing clients retain a conversation after unpublication; no private property data.
    target = (
        schema.PropertyRef(
            id=prop.id, slug=prop.slug if prop.status == "published" else None, title=prop.title
        )
        if prop
        else None
    )
    return schema.Summary(
        **{
            k: getattr(row, k)
            for k in [
                "id",
                "kind",
                "status",
                "budget_min",
                "budget_max",
                "desired_move_in",
                "created_at",
                "updated_at",
                "last_client_message_at",
                "last_staff_message_at",
            ]
        },
        unread_count=repo.unread_count(db, row, role),
        reference=f"INQ-{row.id}",
        property=target,
    )


def detail(db, actor, inquiry_id):
    row = get(db, actor, inquiry_id)
    out = summary(db, row, actor.role)
    if actor.role == "client":
        return out
    user = db.get(User, row.client_id)
    assigned = db.get(User, row.assigned_staff_id) if row.assigned_staff_id else None
    return schema.Detail(
        **out.model_dump(),
        client=client_out(user),
        assigned_staff=schema.StaffRef(id=assigned.id, full_name=assigned.full_name)
        if assigned
        else None,
        version=row.row_version,
        closed_reason=row.closed_reason,
        allowed_actions=[a for a, (sources, _) in TRANSITIONS.items() if row.status in sources],
        history=[
            schema.History(**{k: getattr(h, k) for k in schema.History.model_fields})
            for h in repo.history(db, row)
        ],
    )


def audit(db, actor, row, action):
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action=action,
            entity_type="inquiry",
            entity_id=row.id,
            after={"status": row.status, "version": row.row_version},
        )
    )


def mutation(row):
    return schema.Mutation(id=row.id, version=row.row_version, status=row.status)


def version(row, supplied):
    if row.row_version != supplied:
        raise AppError(409, "VERSION_CONFLICT", "This inquiry changed. Refresh and try again.")


def open_thread(row):
    if row.status in repo.CLOSED:
        raise AppError(
            409,
            "INVALID_STATE_TRANSITION",
            "This inquiry is closed. Start a new inquiry for further help.",
        )


def create(db, actor, data, key=None):
    if actor.role != "client":
        raise AppError(403, "FORBIDDEN", "Use a client account to send an inquiry.")
    # User lock serializes per-client duplicate creation and concurrent key reuse.
    repo.lock_actor(db, actor.id)
    fingerprint = hashlib.sha256(data.model_dump_json().encode()).hexdigest()
    key_hash = hashlib.sha256(key.encode()).hexdigest() if key else None
    previous = repo.request_key(db, actor, key_hash) if key_hash else None
    if previous and previous.created_at >= now() - timedelta(hours=24):
        if previous.body_hash != fingerprint:
            raise AppError(409, "CONFLICT", "Use a new request key for changed inquiry details.")
        return receipt(db.get(Inquiry, previous.inquiry_id))
    if previous:
        db.delete(previous)
        db.flush()
    if data.property_id:
        prop = repo.eligible_property(db, data.property_id)
        if prop is None:
            raise AppError(404, "NOT_FOUND", "This property is not available for inquiries.")
        if repo.duplicate(db, actor, data.property_id):
            raise AppError(
                409,
                "CONFLICT",
                "You already have an open inquiry for this property. Open your inquiries to continue.",
            )
    row = Inquiry(
        client_id=actor.id, **data.model_dump(exclude={"body"}), last_client_message_at=now()
    )
    db.add(row)
    try:
        db.flush()
        db.add(
            InquiryMessage(
                inquiry_id=row.id, sender_id=actor.id, sender_role="client", body=data.body
            )
        )
        db.add(
            InquiryHistory(
                inquiry_id=row.id, from_status=None, to_status="new", actor_user_id=actor.id
            )
        )
        if key_hash:
            db.add(
                InquiryRequest(
                    client_id=actor.id, inquiry_id=row.id, key_hash=key_hash, body_hash=fingerprint
                )
            )
        audit(db, actor, row, "inquiry.created")
        db.commit()
    except IntegrityError:
        db.rollback()
        raise AppError(
            409, "CONFLICT", "An inquiry already exists. Refresh your inquiries."
        ) from None
    return receipt(row)


def list_inquiries(db, actor, **filters):
    rows, meta = repo.inquiries(db, actor, **filters)
    return {"data": [summary(db, r, actor.role) for r in rows], "meta": meta}


def text_out(row, notes=False):
    output = schema.Note if notes else schema.Message
    return output(**{k: getattr(row, k) for k in output.model_fields})


def thread(db, actor, inquiry_id, number, size, notes=False):
    if notes:
        require_staff(actor)
    row = get(db, actor, inquiry_id)
    rows, meta = repo.messages(db, row, number, size, notes)
    return {"data": [text_out(m, notes) for m in rows], "meta": meta}


def send(db, actor, inquiry_id, data, notes=False):
    if notes:
        require_staff(actor)
    row = get(db, actor, inquiry_id, True)
    open_thread(row)
    message: InquiryMessage | InquiryNote
    if notes:
        message = InquiryNote(inquiry_id=row.id, author_id=actor.id, body=data.body)
    else:
        role = "client" if actor.role == "client" else "staff"
        message = InquiryMessage(
            inquiry_id=row.id, sender_id=actor.id, sender_role=role, body=data.body
        )
        setattr(row, "last_" + role + "_message_at", now())
    row.row_version += 1
    row.updated_at = now()
    db.add(message)
    audit(db, actor, row, "inquiry.note_added" if notes else "inquiry.message_sent")
    db.commit()
    return text_out(message, notes)


def change(db, actor, inquiry_id, data, operation):
    require_staff(actor)
    row = get(db, actor, inquiry_id, True)
    version(row, data.version)
    open_thread(row)
    if operation == "assign":
        target = db.get(User, data.assigned_staff_id) if data.assigned_staff_id else None
        if data.assigned_staff_id and (
            not target or not target.is_active or target.role not in {"staff", "admin"}
        ):
            raise invalid("assigned_staff_id", "Choose an active team member.")
        row.assigned_staff_id = data.assigned_staff_id
    elif operation == "qualification":
        for name in ["budget_min", "budget_max", "desired_move_in"]:
            setattr(row, name, getattr(data, name))
    else:
        sources, target = TRANSITIONS[data.action]
        if row.status not in sources:
            raise AppError(
                409,
                "INVALID_STATE_TRANSITION",
                "This action is unavailable for the current inquiry status.",
            )
        if data.action in {"close_lost", "mark_spam"} and not (data.reason or "").strip():
            raise invalid("reason", "Provide a reason.")
        db.add(
            InquiryHistory(
                inquiry_id=row.id,
                from_status=row.status,
                to_status=target,
                actor_user_id=actor.id,
                reason=data.reason,
            )
        )
        row.status = target
        if target == "qualified":
            row.qualified_at = now()
        if target in repo.CLOSED:
            row.closed_at = now()
            row.closed_reason = data.reason
    row.row_version += 1
    row.updated_at = now()
    audit(db, actor, row, "inquiry." + operation)
    db.commit()
    return mutation(row)


def client_detail(db, actor, client_id):
    require_staff(actor)
    user = db.get(User, client_id)
    if not user or user.role != "client":
        raise AppError(404, "NOT_FOUND", "Client not found.")
    rows, meta = repo.inquiries(db, user, 1, 20)
    return schema.ClientDetail(
        **client_out(user).model_dump(),
        inquiries=[summary(db, r, actor.role) for r in rows],
        inquiry_count=meta["total_items"],
    )


def update_client(db, actor, client_id, data):
    require_staff(actor)
    user = repo.locked_client(db, client_id)
    if not user:
        raise AppError(404, "NOT_FOUND", "Client not found.")
    if user.row_version != data.version:
        raise AppError(409, "VERSION_CONFLICT", "This client changed. Refresh and try again.")
    user.is_active = data.is_active
    user.row_version += 1
    if not user.is_active:
        revoke_user(db, user.id)
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            entity_type="user",
            entity_id=user.id,
            action="client.activity_changed",
            after={"is_active": user.is_active},
        )
    )
    db.commit()
    return client_out(user)


def mark_read(db, actor, inquiry_id, message_id):
    row = get(db, actor, inquiry_id, True)
    if not repo.mark_read(db, row, message_id, actor.role, now()):
        raise AppError(404, "NOT_FOUND", "Incoming message not found.")
    audit(db, actor, row, "inquiry.messages_read")
    db.commit()
    return schema.ReadReceipt(unread_count=repo.unread_count(db, row, actor.role))
