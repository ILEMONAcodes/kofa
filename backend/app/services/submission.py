"""Landlords are contact records, not public accounts; receipts contain no P3 data."""

import re
import uuid
from collections.abc import Callable
from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError, invalid
from app.models.identity import AuditLog, PolicyAcceptance
from app.models.property import (
    Landlord,
    Property,
    PropertyAmenity,
    PropertyMedia,
    PropertyStatusHistory,
    StorageDeletion,
)
from app.repositories import submission as repo
from app.repositories.media import file_counts, locked_property
from app.schemas.submission import SubmissionCreate
from app.services.media import check_upload_token, issue_upload_token
from app.services.storage import Storage


def check_captcha(settings: Settings, verifier: Callable | None, token: str | None, ip: str | None):
    if not settings.captcha_required:
        return
    if verifier is None:
        raise AppError(
            503, "SERVICE_UNAVAILABLE", "Submission checks are unavailable. Try again later."
        )
    if not token or len(token) > 4096:
        raise AppError(403, "FORBIDDEN", "Complete the verification challenge.")
    try:
        accepted = verifier(token, ip)
    except Exception:
        raise AppError(
            503, "SERVICE_UNAVAILABLE", "Submission checks are unavailable. Try again later."
        ) from None
    if not accepted:
        raise AppError(403, "FORBIDDEN", "Complete the verification challenge.")


def create_draft(db: Session, settings: Settings, data: SubmissionCreate, ip: str | None):
    if settings.app_env == "production" and not settings.policies_approved:
        raise AppError(503, "SERVICE_UNAVAILABLE", "Submissions are not available yet.")
    accepted = {policy.type: policy.version for policy in data.accepted_policies}
    if accepted != {"terms": settings.terms_version, "privacy": settings.privacy_version}:
        raise invalid(
            "accepted_policies",
            "Accept the current Terms and Privacy Policy versions.",
            "invalid_choice",
        )
    value = data.property
    if repo.active_area(db, value.area_id) is None:
        raise invalid("property.area_id", "Choose an available location.", "invalid_choice")
    amenities = repo.active_amenities(db, value.amenity_codes)
    if len(amenities) != len(value.amenity_codes):
        raise invalid("property.amenity_codes", "Choose available amenities.", "invalid_choice")
    blocked = repo.blocked_contact(
        db,
        data.landlord.phone,
        str(data.landlord.email).lower() if data.landlord.email else None,
    )
    contact = Landlord(
        notes="Contact matches a previously blocked landlord; staff review required."
        if blocked
        else None,
        full_name=data.landlord.full_name,
        phone=data.landlord.phone,
        email=str(data.landlord.email).lower() if data.landlord.email else None,
    )
    db.add(contact)
    db.flush()
    property_id = uuid.uuid4()
    slug = re.sub(r"[^a-z0-9]+", "-", value.title.lower()).strip("-")[:100] or "property"
    prop = Property(
        id=property_id,
        slug=f"{slug}-{property_id.hex[:12]}",
        landlord_id=contact.id,
        area_id=value.area_id,
        title=value.title,
        description=value.description,
        listing_type=value.listing_type,
        property_type=value.property_type,
        intended_use=value.intended_use,
        relationship=data.landlord.relationship,
        price_amount=value.price.amount,
        currency=value.price.currency,
        price_period=value.price.period,
        price_negotiable=value.price_negotiable,
        payment_terms=value.payment_terms,
        extra_charges=[charge.model_dump() for charge in value.extra_charges],
        bedrooms=value.bedrooms,
        bathrooms=value.bathrooms,
        furnishing=value.furnishing,
        address_line=value.address_line,
        address_hint=value.address_hint,
        landlord_conditions=value.landlord_conditions,
        availability_status=value.availability_status,
        status="draft",
    )
    db.add(prop)
    db.flush()
    db.add_all(
        [PropertyAmenity(property_id=prop.id, amenity_id=amenity.id) for amenity in amenities]
    )
    db.add_all(
        [
            PolicyAcceptance(
                landlord_id=contact.id, policy_type=policy.type, version=policy.version, ip=ip
            )
            for policy in data.accepted_policies
        ]
    )
    db.add(PropertyStatusHistory(property_id=prop.id, from_status=None, to_status="draft"))
    db.add(
        AuditLog(
            action="landlord.draft_created",
            entity_type="property",
            entity_id=prop.id,
            actor_ip=ip,
            after={"blocked_contact_match": blocked},
        )
    )
    token, expiry = issue_upload_token(settings, prop.id)
    db.commit()
    return {
        "id": prop.id,
        "status": "draft",
        "upload_token": token,
        "upload_token_expires_at": datetime.fromtimestamp(expiry, UTC),
    }


def drain_deletions(db: Session, storage: Storage, limit: int = 20) -> int:
    rows = list(
        db.scalars(
            select(StorageDeletion)
            .order_by(StorageDeletion.created_at)
            .limit(limit)
            .with_for_update(skip_locked=True)
        )
    )
    completed = 0
    for row in rows:
        try:
            storage.delete(row.storage_key)
        except Exception:
            row.attempts += 1
        else:
            db.delete(row)
            completed += 1
    db.commit()
    return completed


def remove_file(
    db: Session,
    settings: Settings,
    storage: Storage,
    property_id: uuid.UUID,
    file_id: uuid.UUID,
    token: str,
):
    check_upload_token(settings, property_id, token)
    prop = locked_property(db, property_id)
    if prop is None:
        raise AppError(404, "NOT_FOUND", "Submission not found.")
    if prop.status not in {"draft", "changes_requested"}:
        raise AppError(
            409, "INVALID_STATE_TRANSITION", "This submission no longer accepts file changes."
        )
    row = repo.property_file(db, property_id, file_id)
    if row is None:
        raise AppError(404, "NOT_FOUND", "File not found.")
    keys = [row.storage_key]
    was_cover = isinstance(row, PropertyMedia) and row.is_cover
    if isinstance(row, PropertyMedia) and row.thumb_key:
        keys.append(row.thumb_key)
    db.delete(row)
    db.flush()
    if was_cover:
        replacement = db.scalar(
            select(PropertyMedia)
            .where(PropertyMedia.property_id == property_id, PropertyMedia.kind == "photo")
            .order_by(PropertyMedia.position, PropertyMedia.created_at)
            .limit(1)
        )
        if replacement:
            replacement.is_cover = True
    db.add_all([StorageDeletion(storage_key=key) for key in keys])
    db.add(
        AuditLog(
            action="landlord.file_removed",
            entity_type="property",
            entity_id=property_id,
            after={"file_id": str(file_id)},
        )
    )
    db.commit()
    # Failed private object deletion remains durable for the cleanup-files worker.
    drain_deletions(db, storage, limit=2)


def submit(db: Session, settings: Settings, property_id: uuid.UUID, token: str, ip: str | None):
    check_upload_token(settings, property_id, token)
    prop = locked_property(db, property_id)
    if prop is None:
        raise AppError(404, "NOT_FOUND", "Submission not found.")
    if prop.submission_reference:
        return {"id": prop.id, "status": "submitted", "reference": prop.submission_reference}
    if prop.status not in {"draft", "changes_requested"}:
        raise AppError(409, "INVALID_STATE_TRANSITION", "This submission cannot be sent.")
    photos, _, _ = file_counts(db, property_id)
    if photos < 5:
        raise invalid("photos", "Upload at least five property photos.", "min_items")
    if repo.evidence_count(db, property_id) < 1:
        raise invalid(
            "documents", "Upload ownership proof or an authorisation letter.", "min_items"
        )
    moment = datetime.now(UTC)
    previous = prop.status
    prop.status = "submitted"
    prop.submitted_at = moment
    prop.submission_reference = repo.next_reference(db, moment.year)
    prop.row_version += 1
    db.add(PropertyStatusHistory(property_id=prop.id, from_status=previous, to_status=prop.status))
    db.add(
        AuditLog(
            action="landlord.submitted",
            entity_type="property",
            entity_id=prop.id,
            actor_ip=ip,
            after={"reference": prop.submission_reference},
        )
    )
    db.commit()
    return {"id": prop.id, "status": "submitted", "reference": prop.submission_reference}
