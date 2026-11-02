"""Staff-only property operations. Publication/verification transitions are separate."""

from datetime import UTC, datetime
from urllib.parse import urlencode

from pydantic import ValidationError

from app.core.errors import AppError, invalid
from app.models.identity import AuditLog
from app.models.property import (
    PropertyMedia,
    StorageDeletion,
)
from app.repositories import property_admin as repo
from app.repositories.media import locked_property
from app.repositories.submission import active_amenities, active_area, property_file
from app.schemas import property_admin as schema
from app.schemas.submission import PropertyInput
from app.services.media import current_staff
from app.services.storage import LocalStorage, Storage, build_storage
from app.services.submission import drain_deletions


def moment():
    return datetime.now(UTC)


def metadata(page, size, total):
    return schema.PageMeta(
        page=page, page_size=size, total_items=total, total_pages=(total + size - 1) // size
    )


class FileLinks:
    def __init__(self, settings, storage: Storage | None = None):
        self.settings = settings
        self.storage = storage

    def link(self, property_id, file_id, key, thumbnail=False):
        if self.storage is None:
            self.storage = build_storage(self.settings)
        grant = self.storage.signed_read(key)
        if isinstance(self.storage, LocalStorage):
            query = urlencode({"token": grant.token, "thumbnail": str(thumbnail).lower()})
            url = f"{self.settings.public_origin}/api/v1/admin/properties/{property_id}/files/{file_id}?{query}"
        else:
            if grant.url is None:
                raise AppError(503, "SERVICE_UNAVAILABLE", "File link is unavailable.")
            url = grant.url
        return url, datetime.fromtimestamp(grant.expires_at, UTC)


def landlord_out(row):
    return schema.LandlordOut(
        **{name: getattr(row, name) for name in schema.LandlordOut.model_fields}
    )


def summary(row, links):
    prop, area, owner, staff, verification, cover = row
    image = None
    if cover:
        url, _ = links.link(prop.id, cover.id, cover.storage_key)
        thumb = links.link(prop.id, cover.id, cover.thumb_key, True)[0] if cover.thumb_key else None
        image = schema.ImageOut(url=url, thumb_url=thumb, alt=cover.alt_text)
    verified = verification is not None and verification.status == "passed"
    return schema.AdminPropertySummary(
        id=prop.id,
        slug=prop.slug,
        title=prop.title,
        listing_type=prop.listing_type,
        property_type=prop.property_type,
        price={"amount": prop.price_amount, "currency": prop.currency, "period": prop.price_period},
        location={
            "state": area.state,
            "city": area.city,
            "neighbourhood": area.neighbourhood,
            "address_hint": prop.address_hint,
        },
        bedrooms=prop.bedrooms,
        bathrooms=prop.bathrooms,
        furnishing=prop.furnishing,
        availability_status=prop.availability_status,
        is_verified=verified,
        verified_at=verification.verified_at if verified else None,
        cover_image=image,
        published_at=prop.published_at,
        status=prop.status,
        landlord_id=owner.id,
        assigned_staff=schema.StaffRef(id=staff.id, full_name=staff.full_name) if staff else None,
        submitted_at=prop.submitted_at,
        updated_at=prop.updated_at,
        version=prop.row_version,
        submission_reference=prop.submission_reference,
    )


def list_properties(db, settings, actor_id, filters, sorts, page, size, storage=None):
    current_staff(db, actor_id)
    rows, total = repo.queue(db, filters, sorts, page, size, moment())
    links = FileLinks(settings, storage)
    return schema.PropertyPage(
        data=[summary(row, links) for row in rows], meta=metadata(page, size, total)
    )


def get_detail(db, settings, actor_id, property_id, storage=None):
    actor = current_staff(db, actor_id)
    row = repo.detail(db, property_id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "Property not found.")
    prop, area, owner, staff, current, cover = row
    links = FileLinks(settings, storage)
    base = summary(row, links).model_dump()
    media = []
    for item in repo.media_for(db, prop.id):
        media.append(
            schema.MediaOut(
                id=item.id,
                kind=item.kind,
                position=item.position,
                is_cover=item.is_cover,
                url=links.link(prop.id, item.id, item.storage_key)[0],
                thumb_url=links.link(prop.id, item.id, item.thumb_key, True)[0]
                if item.thumb_key
                else None,
                alt=item.alt_text,
            )
        )
    documents = []
    for item in repo.documents_for(db, prop.id):
        url, expiry = links.link(prop.id, item.id, item.storage_key)
        documents.append(
            schema.DocumentOut(
                id=item.id,
                kind=item.kind,
                signed_url=url,
                expires_at=expiry,
                review_note=item.review_note,
            )
        )
    verifications = repo.verifications_for(db, prop.id)
    checks = repo.checks_for(db, [v.id for v in verifications])
    history = [
        schema.VerificationOut(
            id=v.id,
            status=v.status,
            method=v.method,
            scope_summary=v.scope_summary,
            verified_by=v.verified_by,
            verified_at=v.verified_at,
            is_current=v.is_current,
            checks=[
                schema.CheckOut(
                    code=c.code,
                    result=c.result,
                    note=c.note,
                    evidence_document_id=c.evidence_document_id,
                )
                for c in checks
                if c.verification_id == v.id
            ],
        )
        for v in verifications
    ]
    approval = repo.approval_for(db, prop.id)
    approval_out = None
    if approval:
        approval_out = schema.ApprovalOut(
            id=approval.id,
            approved_price={
                "amount": approval.approved_price_amount,
                "currency": "NGN",
                "period": approval.approved_price_period,
            },
            description_approved=approval.description_approved,
            method=approval.method,
            note=approval.note,
            recorded_by=approval.recorded_by,
            approved_at=approval.approved_at,
        )
    statuses = [
        schema.StatusOut(
            from_status=item.from_status,
            to_status=item.to_status,
            actor_user_id=item.actor_user_id,
            reason=item.reason,
            created_at=item.created_at,
        )
        for item in repo.statuses_for(db, prop.id)
    ]
    amenities = [
        schema.AmenityOut(code=a.code, label=a.label) for a in repo.amenities_for(db, prop.id)
    ]
    verification = None
    if current:
        verification = schema.VerificationSummary(
            status=current.status,
            method=current.method,
            verified_at=current.verified_at,
            scope=[
                c.code
                for c in checks
                if c.verification_id == current.id and c.result in {"pass", "na"}
            ],
        )
    detail = schema.AdminPropertyDetail(
        **base,
        description=prop.description,
        intended_use=prop.intended_use,
        area_id=prop.area_id,
        payment_terms=prop.payment_terms,
        price_negotiable=prop.price_negotiable,
        extra_charges=prop.extra_charges,
        amenities=amenities,
        media=media,
        approximate_location=schema.ApproximateLocation(lat=area.latitude, lng=area.longitude)
        if area.latitude is not None and area.longitude is not None
        else None,
        verification=verification,
        last_availability_confirmed_at=prop.last_availability_confirmed_at,
        landlord=schema.PropertyLandlord(
            **landlord_out(owner).model_dump(), relationship=prop.relationship
        ),
        address_line=prop.address_line,
        latitude=prop.latitude,
        longitude=prop.longitude,
        landlord_conditions=prop.landlord_conditions,
        documents=documents,
        verification_history=history,
        landlord_approval=approval_out,
        status_history=statuses,
    )
    db.add(
        AuditLog(
            action="property.private_detail_viewed",
            actor_user_id=actor.id,
            entity_type="property",
            entity_id=prop.id,
        )
    )
    db.commit()
    return detail


def locked(db, actor_id, property_id, version=None, details_edit=False):
    actor = current_staff(db, actor_id)
    prop = locked_property(db, property_id)
    if prop is None:
        raise AppError(404, "NOT_FOUND", "Property not found.")
    if version is not None and prop.row_version != version:
        raise AppError(409, "VERSION_CONFLICT", "This property changed. Reload and try again.")
    if details_edit and prop.status in {"published", "archived", "rejected"}:
        raise AppError(
            409,
            "INVALID_STATE_TRANSITION",
            "Unpublish or reopen the property before editing its details.",
        )
    return actor, prop


def mutation(prop, invalidated=False):
    return schema.MutationOut(
        id=prop.id,
        status=prop.status,
        version=prop.row_version,
        approval_invalidated=invalidated,
        assigned_staff_id=prop.assigned_staff_id,
        availability_status=prop.availability_status,
        last_availability_confirmed_at=prop.last_availability_confirmed_at,
    )


def record(db, prop, actor, action, after=None):
    db.add(
        AuditLog(
            action=action,
            actor_user_id=actor.id,
            entity_type="property",
            entity_id=prop.id,
            after=after,
        )
    )
    prop.row_version += 1
    db.commit()


def edit(db, actor_id, property_id, data):
    actor, prop = locked(db, actor_id, property_id, data.version, True)
    fields = data.model_dump(exclude_unset=True, exclude={"version"})
    snapshot = dict(
        title=prop.title,
        description=prop.description,
        listing_type=prop.listing_type,
        property_type=prop.property_type,
        intended_use=prop.intended_use,
        area_id=prop.area_id,
        address_line=prop.address_line,
        address_hint=prop.address_hint,
        price={"amount": prop.price_amount, "currency": prop.currency, "period": prop.price_period},
        price_negotiable=prop.price_negotiable,
        payment_terms=prop.payment_terms,
        extra_charges=prop.extra_charges,
        bedrooms=prop.bedrooms,
        bathrooms=prop.bathrooms,
        furnishing=prop.furnishing,
        landlord_conditions=prop.landlord_conditions,
    )
    merged = snapshot | {
        key: value for key, value in fields.items() if key in PropertyInput.model_fields
    }
    try:
        PropertyInput.model_validate(merged)
    except ValidationError:
        raise invalid("property", "Check the property details and price period.") from None
    if "area_id" in fields and active_area(db, fields["area_id"]) is None:
        raise invalid("area_id", "Choose an available area.", "invalid_choice")
    if "amenity_codes" in fields:
        codes = fields.pop("amenity_codes")
        amenities = active_amenities(db, codes)
        if len(set(codes)) != len(codes) or len(amenities) != len(codes):
            raise invalid("amenity_codes", "Choose unique active amenities.", "invalid_choice")
        repo.replace_amenities(db, prop.id, amenities)
    changed_price = "price" in fields and fields["price"] != snapshot["price"]
    changed_description = "description" in fields and fields["description"] != prop.description
    invalidated = False
    if changed_price or changed_description:
        invalidated = repo.supersede_approval(db, prop.id, moment())
    if "price" in fields:
        price = fields.pop("price")
        prop.price_amount = price["amount"]
        prop.currency = price["currency"]
        prop.price_period = price["period"]
    for name, value in fields.items():
        setattr(prop, name, value)
    record(
        db,
        prop,
        actor,
        "property.details_updated",
        {
            "fields": sorted(data.model_fields_set - {"version"}),
            "approval_invalidated": invalidated,
        },
    )
    return mutation(prop, invalidated)


def assign(db, actor_id, property_id, data):
    actor, prop = locked(db, actor_id, property_id, data.version)
    if data.staff_id is not None:
        assignee = repo.user_by_id(db, data.staff_id)
        if assignee is None or not assignee.is_active or assignee.role not in {"staff", "admin"}:
            raise invalid("staff_id", "Choose an active staff or admin account.", "invalid_choice")
    prop.assigned_staff_id = data.staff_id
    record(
        db,
        prop,
        actor,
        "property.assigned",
        {"staff_id": str(data.staff_id) if data.staff_id else None},
    )
    return mutation(prop)


def availability(db, actor_id, property_id, data):
    actor, prop = locked(db, actor_id, property_id, data.version)
    confirmed = data.confirmed_at or moment()
    if confirmed.tzinfo is None or confirmed > moment():
        raise invalid(
            "confirmed_at", "Use a timezone-aware confirmation time that is not in the future."
        )
    prop.availability_status = data.availability_status
    prop.last_availability_confirmed_at = confirmed
    record(
        db,
        prop,
        actor,
        "property.availability_confirmed",
        {"availability_status": data.availability_status},
    )
    return mutation(prop)


def update_media(db, actor_id, property_id, media_id, data):
    actor, prop = locked(db, actor_id, property_id, data.version)
    item = repo.media_by_id(db, media_id)
    if item is None or item.property_id != prop.id:
        raise AppError(404, "NOT_FOUND", "Media not found.")
    if prop.status in {"archived", "rejected"}:
        raise AppError(409, "INVALID_STATE_TRANSITION", "Reopen the property before editing media.")
    if data.is_cover:
        if item.kind != "photo":
            raise invalid("is_cover", "Only a photo can be the cover.")
        repo.clear_cover(db, prop.id)
        db.flush()
    if "alt" in data.model_fields_set:
        item.alt_text = data.alt
    if data.position is not None:
        item.position = data.position
    if data.is_cover is not None:
        item.is_cover = data.is_cover
    record(db, prop, actor, "property.media_updated", {"media_id": str(item.id)})
    return mutation(prop)


def remove_media(db, storage, actor_id, property_id, media_id):
    actor, prop = locked(db, actor_id, property_id, details_edit=True)
    item = repo.media_by_id(db, media_id)
    if item is None or item.property_id != prop.id:
        raise AppError(404, "NOT_FOUND", "Media not found.")
    keys = [item.storage_key] + ([item.thumb_key] if item.thumb_key else [])
    cover = item.is_cover
    db.delete(item)
    db.flush()
    if cover:
        replacement = repo.next_cover(db, prop.id)
        if replacement:
            replacement.is_cover = True
    db.add_all([StorageDeletion(storage_key=key) for key in keys])
    record(db, prop, actor, "property.media_removed", {"media_id": str(media_id)})
    drain_deletions(db, storage, limit=2)


def list_landlords(db, actor_id, q, page, size):
    current_staff(db, actor_id)
    owners, total = repo.landlord_list(db, q, page, size)
    return schema.LandlordPage(
        data=[landlord_out(owner) for owner in owners], meta=metadata(page, size, total)
    )


def get_landlord(db, settings, actor_id, landlord_id, storage=None):
    actor = current_staff(db, actor_id)
    owner = repo.landlord_by_id(db, landlord_id)
    if owner is None:
        raise AppError(404, "NOT_FOUND", "Landlord not found.")
    rows = repo.landlord_properties(db, landlord_id)
    links = FileLinks(settings, storage)
    result = schema.LandlordDetail(
        **landlord_out(owner).model_dump(), properties=[summary(row, links) for row in rows]
    )
    db.add(
        AuditLog(
            action="landlord.private_detail_viewed",
            actor_user_id=actor.id,
            entity_type="landlord",
            entity_id=owner.id,
        )
    )
    db.commit()
    return result


def local_download(db, storage, actor_id, property_id, file_id, token, thumbnail):
    current_staff(db, actor_id)
    item = property_file(db, property_id, file_id)
    if item is None or not isinstance(storage, LocalStorage):
        raise AppError(404, "NOT_FOUND", "File not found.")
    key = (
        item.thumb_key
        if thumbnail and isinstance(item, PropertyMedia)
        else item.storage_key
        if not thumbnail
        else None
    )
    if key is None:
        raise AppError(404, "NOT_FOUND", "File not found.")
    path = storage.verified_path(token)
    if path != storage.path(key):
        raise AppError(404, "NOT_FOUND", "File not found.")
    db.add(
        AuditLog(
            action="property.private_file_downloaded",
            actor_user_id=actor_id,
            entity_type="property",
            entity_id=property_id,
            after={"file_id": str(file_id)},
        )
    )
    db.commit()
    return path, "image/webp" if thumbnail else item.mime_type
