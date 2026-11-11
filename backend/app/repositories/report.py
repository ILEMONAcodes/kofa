"""One SELECT provides four aggregate counts from a single statement snapshot."""

from sqlalchemy import func, select

from app.models.appointment import Appointment
from app.models.complaint import Complaint
from app.models.inquiry import Inquiry
from app.models.property import Property


def counts(db, as_of, start=None, end=None):
    def total(model, timestamp, *conditions):
        if start is not None:
            conditions += (timestamp >= start, timestamp < end)
        return select(func.count()).select_from(model).where(*conditions).scalar_subquery()

    statement = select(
        total(
            Property, Property.submitted_at, Property.status.in_(["submitted", "in_review"])
        ).label("listings_awaiting_review"),
        total(
            Inquiry,
            Inquiry.created_at,
            Inquiry.status.in_(
                ["new", "in_progress", "qualified", "inspection_scheduled", "negotiating"]
            ),
        ).label("open_inquiries"),
        total(
            Appointment,
            Appointment.scheduled_at,
            Appointment.status.in_(["proposed", "confirmed", "reschedule_requested"]),
            Appointment.scheduled_at >= as_of,
        ).label("upcoming_inspections"),
        total(
            Complaint,
            Complaint.created_at,
            Complaint.status.in_(["new", "triage", "investigating"]),
        ).label("active_complaints"),
    )
    return db.execute(statement).mappings().one()
