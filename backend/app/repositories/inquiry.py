"""Object-scoped query construction; message and private note reads never mix."""

from sqlalchemy import String, cast, func, or_, select, tuple_, update

from app.models.identity import User
from app.models.inquiry import Inquiry, InquiryHistory, InquiryMessage, InquiryNote, InquiryRequest
from app.models.property import Property

CLOSED = {"closed_won", "closed_lost", "spam"}


def locked(db, inquiry_id, actor, lock=False):
    stmt = select(Inquiry).where(Inquiry.id == inquiry_id)
    if actor.role == "client":
        stmt = stmt.where(Inquiry.client_id == actor.id)
    return db.scalar(stmt.with_for_update() if lock else stmt)


def page(db, stmt, number, size):
    total = db.scalar(select(func.count()).select_from(stmt.order_by(None).subquery())) or 0
    return list(db.scalars(stmt.offset((number - 1) * size).limit(size))), dict(
        page=number, page_size=size, total_items=total, total_pages=(total + size - 1) // size
    )


def inquiries(db, actor, number, size, status=None, q=None, assigned_to=None):
    stmt = select(Inquiry).outerjoin(Property, Property.id == Inquiry.property_id)
    if actor.role == "client":
        stmt = stmt.where(Inquiry.client_id == actor.id)
    if status:
        stmt = stmt.where(Inquiry.status == status)
    if assigned_to:
        stmt = stmt.where(Inquiry.assigned_staff_id == assigned_to)
    if q:
        term = "%" + escape(q.removeprefix("INQ-")) + "%"
        stmt = stmt.where(
            or_(
                Property.title.ilike(term, escape="\\"),
                cast(Inquiry.id, String).ilike(term, escape="\\"),
            )
        )
    return page(db, stmt.order_by(Inquiry.updated_at.desc(), Inquiry.id), number, size)


def escape(value):
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")


def messages(db, row, number, size, notes=False):
    table = InquiryNote if notes else InquiryMessage
    return page(
        db,
        select(table).where(table.inquiry_id == row.id).order_by(table.created_at, table.id),
        number,
        size,
    )


def history(db, row):
    return list(
        db.scalars(
            select(InquiryHistory)
            .where(InquiryHistory.inquiry_id == row.id)
            .order_by(InquiryHistory.created_at, InquiryHistory.id)
        )
    )


def duplicate(db, actor, property_id):
    return db.scalar(
        select(Inquiry.id).where(
            Inquiry.client_id == actor.id,
            Inquiry.property_id == property_id,
            Inquiry.status.not_in(CLOSED),
        )
    )


def request_key(db, actor, key):
    return db.scalar(
        select(InquiryRequest).where(
            InquiryRequest.client_id == actor.id, InquiryRequest.key_hash == key
        )
    )


def clients(db, number, size, q=None):
    stmt = select(User).where(User.role == "client")
    if q:
        term = "%" + escape(q) + "%"
        stmt = stmt.where(
            or_(
                *(
                    column.ilike(term, escape="\\")
                    for column in [User.full_name, User.email, User.phone]
                )
            )
        )
    return page(db, stmt.order_by(User.created_at.desc(), User.id), number, size)


def unread_count(db, row, role):
    incoming = "staff" if role == "client" else "client"
    return (
        db.scalar(
            select(func.count())
            .select_from(InquiryMessage)
            .where(
                InquiryMessage.inquiry_id == row.id,
                InquiryMessage.sender_role == incoming,
                InquiryMessage.read_at.is_(None),
            )
        )
        or 0
    )


def mark_read(db, row, message_id, role, moment):
    incoming = "staff" if role == "client" else "client"
    target = db.scalar(
        select(InquiryMessage).where(
            InquiryMessage.id == message_id,
            InquiryMessage.inquiry_id == row.id,
            InquiryMessage.sender_role == incoming,
        )
    )
    if target is None:
        return False
    db.execute(
        update(InquiryMessage)
        .where(
            InquiryMessage.inquiry_id == row.id,
            InquiryMessage.sender_role == incoming,
            InquiryMessage.read_at.is_(None),
            tuple_(InquiryMessage.created_at, InquiryMessage.id) <= (target.created_at, target.id),
        )
        .values(read_at=moment)
    )
    return True


def lock_actor(db, actor_id):
    return db.scalar(select(User).where(User.id == actor_id).with_for_update())


def eligible_property(db, property_id):
    from app.repositories.property_public import visible

    return db.scalar(
        select(Property).where(Property.id == property_id, visible()).with_for_update()
    )


def locked_client(db, client_id):
    return db.scalar(
        select(User).where(User.id == client_id, User.role == "client").with_for_update()
    )
