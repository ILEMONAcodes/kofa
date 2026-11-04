"""Public data serialization; contacts, evidence, exact locations never enter DTOs."""

from app.core.errors import AppError
from app.repositories import property_public as repo
from app.schemas import property_public as schema


def media_url(origin, item, thumbnail=False):
    return f"{origin}/api/v1/property-media/{item.id}" + ("?thumbnail=true" if thumbnail else "")


def image(origin, item):
    return schema.ImagePublic(
        url=media_url(origin, item),
        thumb_url=media_url(origin, item, True) if item.thumb_key else None,
        alt=item.alt_text,
    )


def summary(row, origin):
    prop, area, verification, cover = row
    return schema.PropertySummaryPublic(
        id=prop.id,
        slug=prop.slug,
        title=prop.title,
        listing_type=prop.listing_type,
        property_type=prop.property_type,
        price=dict(amount=prop.price_amount, currency=prop.currency, period=prop.price_period),
        location=dict(
            state=area.state,
            city=area.city,
            neighbourhood=area.neighbourhood,
            address_hint=prop.address_hint,
        ),
        bedrooms=prop.bedrooms,
        bathrooms=prop.bathrooms,
        furnishing=prop.furnishing,
        availability_status=prop.availability_status,
        is_verified=True,
        verified_at=verification.verified_at,
        cover_image=image(origin, cover) if cover else None,
        published_at=prop.published_at,
    )


def search(db, origin, filters, sorts, page, size):
    rows, total = repo.search(db, filters, sorts, page, size)
    return schema.PropertyPagePublic(
        data=[summary(row, origin) for row in rows],
        meta=schema.PageMetaPublic(
            page=page, page_size=size, total_items=total, total_pages=(total + size - 1) // size
        ),
    )


def detail(db, origin, slug):
    row = repo.detail(db, slug)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Property not found.")
    prop, _, verification, _ = row
    approximate = None
    if prop.latitude is not None and prop.longitude is not None:
        approximate = schema.ApproximatePublic(
            lat=round(float(prop.latitude), 2), lng=round(float(prop.longitude), 2)
        )
    return schema.DetailEnvelopePublic(
        data=schema.PropertyDetailPublic(
            **summary(row, origin).model_dump(),
            description=prop.description,
            payment_terms=prop.payment_terms,
            price_negotiable=prop.price_negotiable,
            extra_charges=prop.extra_charges,
            amenities=[dict(code=a.code, label=a.label) for a in repo.amenities(db, prop.id)],
            media=[
                schema.MediaPublic(
                    **image(origin, m).model_dump(), id=m.id, kind=m.kind, position=m.position
                )
                for m in repo.media(db, prop.id)
            ],
            approximate_location=approximate,
            verification=schema.VerificationPublic(
                status=verification.status,
                verified_at=verification.verified_at,
                method=verification.method,
                scope=repo.checks(db, verification.id),
            ),
            last_availability_confirmed_at=prop.last_availability_confirmed_at,
        )
    )


def taxonomy(db):
    areas, amenities = repo.taxonomy(db)
    return schema.TaxonomyEnvelopePublic(
        data=schema.TaxonomyPublic(
            listing_types=["rent", "sale"],
            property_types=[
                "apartment",
                "house",
                "duplex",
                "bungalow",
                "terrace",
                "studio",
                "room",
            ],
            furnishing=["furnished", "semi_furnished", "unfurnished"],
            availability_statuses=["available", "under_offer", "unavailable"],
            areas=[
                schema.AreaPublic(**{k: getattr(a, k) for k in schema.AreaPublic.model_fields})
                for a in areas
            ],
            amenities=[
                schema.TaxonomyAmenityPublic(code=a.code, label=a.label, category=a.category)
                for a in amenities
            ],
        )
    )
