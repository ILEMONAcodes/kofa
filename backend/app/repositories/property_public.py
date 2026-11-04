"""Public-only query paths; publication eligibility is rechecked on every read."""

from sqlalchemy import and_, exists, func, or_, select

from app.models.property import (
    Amenity,
    Area,
    LandlordApproval,
    Property,
    PropertyAmenity,
    PropertyDocument,
    PropertyMedia,
    PropertyVerification,
    VerificationCheck,
)


def visible():
    # Recheck checklist integrity on reads too: a stale/imported passed flag alone
    # must never bypass the publication workflow.
    required_checks = [
        exists(
            select(VerificationCheck.id).where(
                VerificationCheck.verification_id == PropertyVerification.id,
                VerificationCheck.code == code,
            )
        )
        for code in ("identity", "ownership_docs", "location", "price", "features")
    ]
    invalid_check = exists(
        select(VerificationCheck.id).where(
            VerificationCheck.verification_id == PropertyVerification.id,
            or_(
                VerificationCheck.result == "fail",
                and_(
                    VerificationCheck.result == "na",
                    func.length(func.trim(func.coalesce(VerificationCheck.note, ""))) == 0,
                ),
                and_(
                    VerificationCheck.evidence_document_id.is_not(None),
                    ~exists(
                        select(PropertyDocument.id).where(
                            PropertyDocument.id == VerificationCheck.evidence_document_id,
                            PropertyDocument.property_id == PropertyVerification.property_id,
                        )
                    ),
                ),
            ),
        )
    )
    verification = exists(
        select(PropertyVerification.id)
        .correlate(Property)
        .where(
            PropertyVerification.property_id == Property.id,
            PropertyVerification.is_current.is_(True),
            PropertyVerification.status == "passed",
            PropertyVerification.verified_at.is_not(None),
            *required_checks,
            ~invalid_check,
        )
    )
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
    return and_(Property.status == "published", verification, approval)


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
    total = db.scalar(select(func.count()).select_from(stmt.subquery())) or 0
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
    return db.execute(
        stmt.order_by(*ordering, Property.id).offset((page - 1) * size).limit(size)
    ).all(), total


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
