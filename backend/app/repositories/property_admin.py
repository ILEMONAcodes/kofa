"""Parameterized staff queue and property history queries."""

from sqlalchemy import and_, delete, func, or_, select, update
from sqlalchemy.sql.elements import ColumnElement

from app.models.identity import User
from app.models.property import (
    Amenity,
    Area,
    Landlord,
    LandlordApproval,
    Property,
    PropertyAmenity,
    PropertyDocument,
    PropertyMedia,
    PropertyStatusHistory,
    PropertyVerification,
    VerificationCheck,
)
from app.repositories.availability import stale as stale_clause


def joined_properties():
    return (
        select(Property, Area, Landlord, User, PropertyVerification, PropertyMedia)
        .join(Area, Property.area_id == Area.id)
        .join(Landlord, Property.landlord_id == Landlord.id)
        .outerjoin(User, Property.assigned_staff_id == User.id)
        .outerjoin(
            PropertyVerification,
            and_(
                PropertyVerification.property_id == Property.id,
                PropertyVerification.is_current.is_(True),
            ),
        )
        .outerjoin(
            PropertyMedia,
            and_(PropertyMedia.property_id == Property.id, PropertyMedia.is_cover.is_(True)),
        )
    )


def queue(db, filters, sorts, page, page_size, now, stale_days=14):
    statement = joined_properties()
    conditions: list[ColumnElement[bool]] = []
    if filters.get("status"):
        conditions.append(Property.status.in_(filters["status"]))
    if filters.get("q"):
        search = (
            "%" + filters["q"].replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        )
        conditions.append(
            or_(
                Property.title.ilike(search, escape="\\"),
                Property.description.ilike(search, escape="\\"),
                Area.neighbourhood.ilike(search, escape="\\"),
            )
        )
    if filters.get("area"):
        conditions.append(Area.slug == filters["area"])
    if filters.get("assigned_to"):
        conditions.append(Property.assigned_staff_id == filters["assigned_to"])
    if filters.get("listing_type"):
        conditions.append(Property.listing_type == filters["listing_type"])
    if filters.get("landlord_id"):
        conditions.append(Property.landlord_id == filters["landlord_id"])
    if filters.get("stale_availability") is not None:
        stale = stale_clause(now, stale_days)
        conditions.append(stale if filters["stale_availability"] else ~stale)
    statement = statement.where(*conditions)
    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    orders = []
    for name, descending in sorts:
        column = getattr(Property, name)
        orders.append((column.desc() if descending else column.asc()).nulls_last())
    rows = db.execute(
        statement.order_by(*orders, Property.id).offset((page - 1) * page_size).limit(page_size)
    ).all()
    return rows, total


def detail(db, property_id):
    return db.execute(joined_properties().where(Property.id == property_id)).one_or_none()


def landlord_list(db, q, page, page_size):
    statement = select(Landlord)
    if q:
        search = "%" + q.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_") + "%"
        statement = statement.where(
            or_(
                Landlord.full_name.ilike(search, escape="\\"),
                Landlord.phone.ilike(search, escape="\\"),
                Landlord.email.ilike(search, escape="\\"),
            )
        )
    total = db.scalar(select(func.count()).select_from(statement.subquery())) or 0
    return list(
        db.scalars(
            statement.order_by(Landlord.created_at.desc(), Landlord.id)
            .offset((page - 1) * page_size)
            .limit(page_size)
        )
    ), total


def media_for(db, property_id):
    return list(
        db.scalars(
            select(PropertyMedia)
            .where(PropertyMedia.property_id == property_id)
            .order_by(PropertyMedia.position, PropertyMedia.id)
        )
    )


def documents_for(db, property_id):
    return list(
        db.scalars(
            select(PropertyDocument)
            .where(PropertyDocument.property_id == property_id)
            .order_by(PropertyDocument.created_at, PropertyDocument.id)
        )
    )


def verifications_for(db, property_id):
    return list(
        db.scalars(
            select(PropertyVerification)
            .where(PropertyVerification.property_id == property_id)
            .order_by(PropertyVerification.created_at.desc(), PropertyVerification.id)
        )
    )


def checks_for(db, verification_ids):
    return (
        list(
            db.scalars(
                select(VerificationCheck).where(
                    VerificationCheck.verification_id.in_(verification_ids)
                )
            )
        )
        if verification_ids
        else []
    )


def approval_for(db, property_id):
    return db.scalar(
        select(LandlordApproval).where(
            LandlordApproval.property_id == property_id, LandlordApproval.superseded_at.is_(None)
        )
    )


def statuses_for(db, property_id):
    return list(
        db.scalars(
            select(PropertyStatusHistory)
            .where(PropertyStatusHistory.property_id == property_id)
            .order_by(PropertyStatusHistory.created_at, PropertyStatusHistory.id)
        )
    )


def amenities_for(db, property_id):
    return list(
        db.scalars(
            select(Amenity)
            .join(PropertyAmenity, PropertyAmenity.amenity_id == Amenity.id)
            .where(PropertyAmenity.property_id == property_id)
            .order_by(Amenity.sort_order, Amenity.code)
        )
    )


def replace_amenities(db, property_id, amenities):
    db.execute(delete(PropertyAmenity).where(PropertyAmenity.property_id == property_id))
    db.add_all([PropertyAmenity(property_id=property_id, amenity_id=a.id) for a in amenities])


def supersede_approval(db, property_id, when):
    return bool(
        db.execute(
            update(LandlordApproval)
            .where(
                LandlordApproval.property_id == property_id,
                LandlordApproval.superseded_at.is_(None),
            )
            .values(superseded_at=when)
        ).rowcount
    )


def clear_cover(db, property_id):
    db.execute(
        update(PropertyMedia)
        .where(PropertyMedia.property_id == property_id, PropertyMedia.is_cover.is_(True))
        .values(is_cover=False)
    )


def next_cover(db, property_id):
    return db.scalar(
        select(PropertyMedia)
        .where(PropertyMedia.property_id == property_id, PropertyMedia.kind == "photo")
        .order_by(PropertyMedia.position, PropertyMedia.id)
        .limit(1)
    )


def landlord_properties(db, landlord_id):
    return db.execute(
        joined_properties()
        .where(Landlord.id == landlord_id)
        .order_by(Property.updated_at.desc(), Property.id)
    ).all()


def user_by_id(db, user_id):
    return db.get(User, user_id, populate_existing=True)


def media_by_id(db, media_id):
    return db.get(PropertyMedia, media_id)


def landlord_by_id(db, landlord_id):
    return db.get(Landlord, landlord_id)


def options(db):
    areas = list(
        db.scalars(
            select(Area).where(Area.is_active.is_(True)).order_by(Area.city, Area.neighbourhood)
        )
    )
    amenities = list(
        db.scalars(
            select(Amenity)
            .where(Amenity.is_active.is_(True))
            .order_by(Amenity.sort_order, Amenity.code)
        )
    )
    staff = list(
        db.scalars(
            select(User)
            .where(User.is_active.is_(True), User.role.in_(["staff", "admin"]))
            .order_by(User.full_name, User.id)
        )
    )
    return areas, amenities, staff
