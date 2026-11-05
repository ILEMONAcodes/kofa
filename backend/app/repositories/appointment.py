"""Scoped appointment queries and lock order. Exclusion constraints own overlap safety."""

from sqlalchemy import select

from app.models.appointment import Appointment, AppointmentHistory
from app.models.identity import User
from app.models.inquiry import Inquiry
from app.models.property import Landlord, Property
from app.repositories.inquiry import page
from app.repositories.property_public import visible

ACTIVE = {"proposed", "confirmed", "reschedule_requested"}


def get(db, actor, appointment_id, lock=False):
    stmt = select(Appointment).where(Appointment.id == appointment_id)
    if actor.role == "client":
        stmt = stmt.where(Appointment.client_id == actor.id)
    return db.scalar(
        stmt.with_for_update().execution_options(populate_existing=True) if lock else stmt
    )


def inquiry(db, inquiry_id, lock=False):
    stmt = select(Inquiry).where(Inquiry.id == inquiry_id)
    return db.scalar(
        stmt.with_for_update().execution_options(populate_existing=True) if lock else stmt
    )


def published_property(db, property_id):
    return db.scalar(
        select(Property).where(Property.id == property_id, visible()).with_for_update()
    )


def active_staff(db, staff_id):
    return db.scalar(
        select(User).where(
            User.id == staff_id, User.role.in_(["staff", "admin"]), User.is_active.is_(True)
        )
    )


def property_record(db, property_id):
    return db.get(Property, property_id)


def owner(db, property_id):
    return db.scalar(
        select(Landlord)
        .join(Property, Property.landlord_id == Landlord.id)
        .where(Property.id == property_id)
    )


def user(db, user_id):
    return db.get(User, user_id)


def appointments(
    db,
    actor,
    number,
    size,
    status=None,
    staff_id=None,
    date_from=None,
    date_to=None,
    inquiry_id=None,
):
    stmt = select(Appointment)
    if actor.role == "client":
        stmt = stmt.where(Appointment.client_id == actor.id)
    if status:
        stmt = stmt.where(Appointment.status == status)
    if staff_id:
        stmt = stmt.where(Appointment.staff_id == staff_id)
    if date_from:
        stmt = stmt.where(Appointment.scheduled_at >= date_from)
    if date_to:
        stmt = stmt.where(Appointment.scheduled_at < date_to)
    if inquiry_id:
        stmt = stmt.where(Appointment.inquiry_id == inquiry_id)
    return page(db, stmt.order_by(Appointment.scheduled_at, Appointment.id), number, size)


def history(db, appointment_id):
    return list(
        db.scalars(
            select(AppointmentHistory)
            .where(AppointmentHistory.appointment_id == appointment_id)
            .order_by(AppointmentHistory.created_at, AppointmentHistory.id)
        )
    )


def staff_options(db):
    return list(
        db.scalars(
            select(User)
            .where(User.is_active.is_(True), User.role.in_(["staff", "admin"]))
            .order_by(User.full_name, User.id)
        )
    )
