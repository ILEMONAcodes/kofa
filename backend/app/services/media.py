"""Authorized upload units of work; future routers must also enforce CSRF/rate limits."""

import io
import logging
import time
import uuid
from typing import BinaryIO

import jwt
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import AppError, invalid
from app.models.identity import AuditLog, User
from app.models.property import PropertyDocument, PropertyMedia
from app.repositories.media import file_counts, locked_property
from app.services.media_validation import DOCUMENTS, validate_file
from app.services.storage import ReadGrant, Storage

logger = logging.getLogger("kofa")


def issue_upload_token(settings: Settings, property_id: uuid.UUID) -> tuple[str, int]:
    """Called only after the draft endpoint creates and authorizes the property."""
    expires = int(time.time()) + 86400
    token = jwt.encode(
        {
            "sub": str(property_id),
            "exp": expires,
            "aud": "kofa-property-upload",
            "scope": "upload",
            "jti": str(uuid.uuid4()),
        },
        settings.auth_secret.get_secret_value(),
        algorithm="HS256",
    )
    return token, expires


def check_upload_token(settings: Settings, property_id: uuid.UUID, token: str) -> None:
    try:
        data = jwt.decode(
            token,
            settings.auth_secret.get_secret_value(),
            algorithms=["HS256"],
            audience="kofa-property-upload",
            options={"require": ["sub", "exp", "aud", "scope", "jti"]},
        )
        if data["sub"] != str(property_id) or data["scope"] != "upload":
            raise ValueError("scope")
    except (jwt.PyJWTError, ValueError, TypeError) as exc:
        raise AppError(
            404, "NOT_FOUND", "Submission is unavailable or the upload link has expired."
        ) from exc


def current_staff(db: Session, actor_id: uuid.UUID) -> User:
    user = db.get(User, actor_id, populate_existing=True)
    if user is None or not user.is_active or user.role not in {"staff", "admin"}:
        raise AppError(403, "FORBIDDEN", "You do not have access to these files.")
    return user


def _cleanup(storage: Storage, keys: list[str]) -> None:
    for key in keys:
        try:
            storage.delete(key)
        except Exception:
            # No key, filename, credential or provider response in logs.
            logger.error("upload_cleanup_failed; private storage reconciliation required")


def add_file(
    db: Session,
    settings: Settings,
    storage: Storage,
    property_id: uuid.UUID,
    stream: BinaryIO,
    kind: str,
    filename: str,
    declared_mime: str | None = None,
    *,
    actor_id: uuid.UUID | None = None,
    upload_token: str | None = None,
    caption: str | None = None,
) -> PropertyMedia | PropertyDocument:
    # Public callers must possess a signed property-scoped capability; no role field accepted.
    if actor_id is not None:
        actor = current_staff(db, actor_id)
    else:
        check_upload_token(settings, property_id, upload_token or "")
        actor = None
    if caption and len(caption) > 200:
        raise invalid("caption", "Use at most 200 characters.")
    validated = validate_file(stream, kind, filename, declared_mime, settings.ffprobe_binary)
    keys: list[str] = []
    try:
        prop = locked_property(db, property_id)
        if prop is None:
            raise AppError(404, "NOT_FOUND", "Property not found.")
        if actor is None and prop.status not in {"draft", "changes_requested"}:
            raise AppError(
                409, "INVALID_STATE_TRANSITION", "This submission no longer accepts uploads."
            )
        if actor is not None and prop.status in {"published", "archived", "rejected"}:
            raise AppError(
                409,
                "INVALID_STATE_TRANSITION",
                "Unpublish or reopen the property before changing its files.",
            )
        photos, videos, documents = file_counts(db, property_id)
        count, limit = (
            (photos, 20) if kind == "photo" else (videos, 1) if kind == "video" else (documents, 10)
        )
        if count >= limit:
            raise invalid(
                "file",
                f"This property already has the maximum of {limit} files for this category.",
                "max_items",
            )
        file_id = uuid.uuid4()
        prefix = f"private/properties/{property_id}/{file_id}"
        key = f"{prefix}.{validated.extension}"
        keys.append(key)
        storage.put(key, io.BytesIO(validated.data), validated.mime)
        if kind in DOCUMENTS:
            row: PropertyMedia | PropertyDocument = PropertyDocument(
                id=file_id,
                property_id=property_id,
                kind=kind,
                storage_key=key,
                mime_type=validated.mime,
                size_bytes=len(validated.data),
            )
        else:
            thumb_key = None
            if validated.thumbnail:
                thumb_key = f"{prefix}_thumb.webp"
                keys.append(thumb_key)
                storage.put(thumb_key, io.BytesIO(validated.thumbnail), "image/webp")
            row = PropertyMedia(
                id=file_id,
                property_id=property_id,
                kind=kind,
                storage_key=key,
                thumb_key=thumb_key,
                original_filename=validated.filename,
                mime_type=validated.mime,
                size_bytes=len(validated.data),
                width=validated.width,
                height=validated.height,
                alt_text=caption,
                position=photos + videos,
                is_cover=kind == "photo" and photos == 0,
                uploaded_by="staff" if actor is not None else "landlord_submission",
            )
        if actor is not None:
            prop.row_version += 1
        db.add(row)
        db.add(
            AuditLog(
                actor_user_id=actor.id if actor else None,
                action="property.file_uploaded",
                entity_type="property",
                entity_id=property_id,
                after={"file_id": str(file_id), "kind": kind},
            )
        )
        db.commit()
        return row
    except Exception:
        db.rollback()
        _cleanup(storage, keys)
        raise


def document_read_grant(
    db: Session, storage: Storage, actor_id: uuid.UUID, document_id: uuid.UUID
) -> ReadGrant:
    actor = current_staff(db, actor_id)
    doc = db.get(PropertyDocument, document_id)
    if doc is None:
        raise AppError(404, "NOT_FOUND", "Document not found.")
    grant = storage.signed_read(doc.storage_key, 300)
    db.add(
        AuditLog(
            actor_user_id=actor.id,
            action="property.document_accessed",
            entity_type="property",
            entity_id=doc.property_id,
            after={"document_id": str(doc.id)},
        )
    )
    db.commit()
    return grant
