"""Public-only query paths; publication eligibility is rechecked on every read."""

from sqlalchemy import and_, exists, func, or_, select

from app.models.property import (
    Amenity,
    Area,
    Landlord,
    LandlordApproval,
    Property,
    PropertyAmenity,
    PropertyDocument,
    PropertyMedia,
    PropertyVerification,
    VerificationCheck,
)


def visible():
    # Aggregate verification checks once instead of running correlated counts
    # for every candidate listing. The unique (verification_id, code) key means
    # five required-code rows cover the whole required checklist.
    eligible = (
        select(PropertyVerification.property_id)
        .join(VerificationCheck, VerificationCheck.verification_id == PropertyVerification.id)
        .outerjoin(
            PropertyDocument,
            and_(
                PropertyDocument.id == VerificationCheck.evidence_document_id,
                PropertyDocument.property_id == PropertyVerification.property_id,
            ),
        )
        .where(
            PropertyVerification.is_current.is_(True),
            PropertyVerification.status == "passed",
            PropertyVerification.verified_at.is_not(None),
        )
        .group_by(PropertyVerification.id, PropertyVerification.property_id)
        .having(
            func.count(VerificationCheck.id).filter(
                VerificationCheck.code.in_(
                    ("identity", "ownership_docs", "location", "price", "features")
                )
            )
            == 5,
            func.bool_and(
                or_(
                    VerificationCheck.result == "pass",
                    and_(
                        VerificationCheck.result == "na",
                        func.length(func.trim(func.coalesce(VerificationCheck.note, ""))) > 0,
                    ),
                )
            ),
            func.bool_and(
                or_(
                    VerificationCheck.evidence_document_id.is_(None),
                    PropertyDocument.id.is_not(None),
                )
            ),
        )
    )
    # Keep membership as a filter: pulling the aggregate into a nested-loop
    # join can compare every listing against every verified-property group.
    # Both IDs are non-null, so IS TRUE preserves the same visibility rule.
    verification = Property.id.in_(eligible).is_(True)
    approval = exists(
        select(LandlordApproval.id)
        .correlate(Property)
        .where(
            LandlordApproval.property_id == Property.id,
            LandlordApproval.superseded_at.is_(None),
            LandlordApproval.description_approved.is_(True),
            LandlordApproval.approved_price_amount == Property.price_amount,
            LandlordApproval.approved_price_period == Property.price_period,
            LandlordApproval.approved_at <= func.now(),
        )
    )
    return and_(
        Property.status == "published",
        verification,
        approval,
        ~exists(
            select(Landlord.id).where(
                Landlord.id == Property.landlord_id, Landlord.blocked_at.is_not(None)
            )
        ),
    )


def joined():
    return (
        select(Property, Area, PropertyVerification, PropertyMedia)
        .join(Area, Area.id == Property.area_id)
        .join(
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
        .where(visible())
    )


def search_statement(filters):
    stmt = joined()
    if filters.get("q"):
        value = filters["q"].replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        stmt = stmt.where(
            or_(
                (Property.title + " " + Property.description).ilike(f"%{value}%", escape="\\"),
                Area.neighbourhood.ilike(f"%{value}%", escape="\\"),
            )
        )
    for name in ("listing_type", "property_type", "furnishing", "availability"):
        value = filters.get(name)
        if value:
            column = getattr(Property, "availability_status" if name == "availability" else name)
            stmt = stmt.where(column.in_(value) if isinstance(value, list) else column == value)
    for name in ("state", "city"):
        if filters.get(name):
            stmt = stmt.where(func.lower(getattr(Area, name)) == filters[name].lower())
    if filters.get("area"):
        stmt = stmt.where(Area.slug.in_(filters["area"]))
    for name, column, lower in [
        ("price_min", Property.price_amount, True),
        ("price_max", Property.price_amount, False),
        ("bedrooms_min", Property.bedrooms, True),
        ("bedrooms_max", Property.bedrooms, False),
        ("bathrooms_min", Property.bathrooms, True),
    ]:
        value = filters.get(name)
        if value is not None:
            stmt = stmt.where(column >= value if lower else column <= value)
    for code in filters.get("amenities") or []:
        stmt = stmt.where(
            exists(
                select(PropertyAmenity.property_id)
                .join(Amenity, Amenity.id == PropertyAmenity.amenity_id)
                .where(PropertyAmenity.property_id == Property.id, Amenity.code == code)
            )
        )
    return stmt


def search(db, filters, sorts, page, size):
    stmt = search_statement(filters)
    ordering = []
    for name, desc in sorts:
        column = (
            Property.price_amount
            if name == "price"
            else (
                PropertyVerification.verified_at if name == "verified_at" else Property.published_at
            )
        )
        ordering.append((column.desc() if desc else column.asc()).nulls_last())
    # Count the same eligible rows in the page query instead of repeating all
    # verification/privacy predicates in a separate count query on every request.
    rows = db.execute(
        stmt.add_columns(func.count().over().label("total_items"))
        .order_by(*ordering, Property.id)
        .offset((page - 1) * size)
        .limit(size)
    ).all()
    if rows:
        return [tuple(row[:4]) for row in rows], int(rows[0][4])
    # An offset beyond the last page has no window row from which to read total.
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) if page > 1 else 0
    return [], total or 0


def detail(db, slug):
    return db.execute(joined().where(Property.slug == slug)).one_or_none()


def media(db, property_id):
    return list(
        db.scalars(
            select(PropertyMedia)
            .where(PropertyMedia.property_id == property_id)
            .order_by(PropertyMedia.position, PropertyMedia.id)
        )
    )


def media_file(db, media_id):
    return db.execute(
        select(PropertyMedia)
        .join(Property, Property.id == PropertyMedia.property_id)
        .where(PropertyMedia.id == media_id, visible())
    ).scalar_one_or_none()


def checks(db, verification_id):
    return list(
        db.scalars(
            select(VerificationCheck.code)
            .where(
                VerificationCheck.verification_id == verification_id,
                VerificationCheck.result.in_(["pass", "na"]),
            )
            .order_by(VerificationCheck.code)
        )
    )


def amenities(db, property_id):
    return list(
        db.scalars(
            select(Amenity)
            .join(PropertyAmenity, PropertyAmenity.amenity_id == Amenity.id)
            .where(PropertyAmenity.property_id == property_id)
            .order_by(Amenity.label)
        )
    )


def taxonomy(db):
    return (
        list(
            db.scalars(
                select(Area)
                .where(Area.is_active.is_(True))
                .order_by(Area.state, Area.city, Area.neighbourhood)
            )
        ),
        list(
            db.scalars(select(Amenity).where(Amenity.is_active.is_(True)).order_by(Amenity.label))
        ),
    )
