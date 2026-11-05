"""Scoped queries; reporter data stays in the staff-only projection."""

from sqlalchemy import func, or_, select, text

from app.models.appointment import Appointment
from app.models.complaint import Complaint, ComplaintEvent, ComplaintEvidence
from app.models.identity import User
from app.models.inquiry import Inquiry
from app.models.property import Landlord, Property
from app.repositories.property_public import visible


def get(db, case_id, actor=None, lock=False):
    q = select(Complaint).where(Complaint.id == case_id)
    if actor and actor.role == "client":
        q = q.where(Complaint.reporter_user_id == actor.id)
    return db.scalar(q.with_for_update().execution_options(populate_existing=True) if lock else q)


def public_property(db, slug):
    return db.scalar(select(Property).where(Property.slug == slug, visible()))


def subject_property(db, actor, property_id):
    return db.scalar(
        select(Property).where(
            Property.id == property_id,
            or_(
                visible(),
                select(Inquiry.id)
                .where(Inquiry.property_id == Property.id, Inquiry.client_id == actor.id)
                .exists(),
                select(Appointment.id)
                .where(Appointment.property_id == Property.id, Appointment.client_id == actor.id)
                .exists(),
            ),
        )
    )


def own_appointment(db, actor, id):
    return db.scalar(
        select(Appointment).where(Appointment.id == id, Appointment.client_id == actor.id)
    )


def serialize_duplicate(db, key):
    db.execute(text("SELECT pg_advisory_xact_lock(hashtextextended(:key, 0))"), {"key": key})


def duplicate(db, ip, property_id, reason, since, user_id=None):
    return db.scalar(
        select(Complaint.id).where(
            or_(Complaint.reporter_ip_hash == ip, Complaint.reporter_user_id == user_id)
            if user_id
            else Complaint.reporter_ip_hash == ip,
            Complaint.property_id == property_id,
            Complaint.reason == reason,
            Complaint.created_at >= since,
        )
    )


def evidence(db, id):
    return db.scalars(
        select(ComplaintEvidence)
        .where(ComplaintEvidence.complaint_id == id)
        .order_by(ComplaintEvidence.created_at, ComplaintEvidence.id)
    ).all()


def events(db, id):
    return db.scalars(
        select(ComplaintEvent)
        .where(ComplaintEvent.complaint_id == id)
        .order_by(ComplaintEvent.created_at, ComplaintEvent.id)
    ).all()


def staff(db, id=None):
    q = select(User).where(User.is_active.is_(True), User.role.in_(["staff", "admin"]))
    return (
        db.scalar(q.where(User.id == id))
        if id
        else db.scalars(q.order_by(User.full_name, User.id)).all()
    )


def listing(db, actor, filters, page, size):
    q = select(Complaint)
    if actor.role == "client":
        q = q.where(Complaint.reporter_user_id == actor.id)
    for k in ["status", "kind", "reason", "property_id", "outcome"]:
        if filters.get(k) is not None:
            q = q.where(getattr(Complaint, k) == filters[k])
    if filters.get("assigned_to"):
        q = q.where(Complaint.assigned_staff_id == filters["assigned_to"])
    if filters.get("q"):
        # Search references only; never echo descriptions/contact details into lists.
        q = q.where(
            func.concat("CMP-", Complaint.id).ilike(
                "%" + filters["q"].replace("%", "\\%").replace("_", "\\_") + "%", escape="\\"
            )
        )
    if filters.get("overdue_first_response") is not None:
        overdue = (
            (Complaint.first_response_at.is_(None))
            & (Complaint.created_at < filters["deadline"])
            & Complaint.status.in_(["new", "triage", "investigating"])
        )
        q = q.where(overdue if filters["overdue_first_response"] else ~overdue)
    total = db.scalar(select(func.count()).select_from(q.subquery())) or 0
    order = (
        Complaint.created_at.asc()
        if filters.get("sort") == "created_at"
        else Complaint.created_at.desc()
    )
    rows = db.scalars(q.order_by(order, Complaint.id).offset((page - 1) * size).limit(size)).all()
    return rows, total


def other_open_count(db, property_id, case_id):
    if property_id is None:
        return 0
    return (
        db.scalar(
            select(func.count(Complaint.id)).where(
                Complaint.property_id == property_id,
                Complaint.id != case_id,
                Complaint.status.not_in(["resolved", "dismissed"]),
            )
        )
        or 0
    )


def locked_property(db, property_id):
    return db.scalar(
        select(Property)
        .where(Property.id == property_id)
        .with_for_update()
        .execution_options(populate_existing=True)
    )


def locked_owner(db, landlord_id):
    return db.scalar(select(Landlord).where(Landlord.id == landlord_id).with_for_update())


def file_record(db, case_id, file_id):
    return db.scalar(
        select(ComplaintEvidence).where(
            ComplaintEvidence.id == file_id, ComplaintEvidence.complaint_id == case_id
        )
    )


def active_hold(db, property_id):
    return (
        db.scalar(select(Complaint.id).where(Complaint.hold_property_id == property_id).limit(1))
        is not None
    )


def owner_blocked(db, landlord_id):
    return db.scalar(select(Landlord.blocked_at).where(Landlord.id == landlord_id)) is not None
