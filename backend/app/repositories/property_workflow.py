"""Workflow query helpers; services serialize all writes with the property row lock."""

from sqlalchemy import select

from app.models.property import (
    LandlordApproval,
    PropertyDocument,
    PropertyVerification,
    VerificationCheck,
)


def current_verification(db, property_id):
    return db.scalar(
        select(PropertyVerification).where(
            PropertyVerification.property_id == property_id,
            PropertyVerification.is_current.is_(True),
        )
    )


def checks(db, verification_id):
    return list(
        db.scalars(
            select(VerificationCheck).where(VerificationCheck.verification_id == verification_id)
        )
    )


def current_approval(db, property_id):
    return db.scalar(
        select(LandlordApproval).where(
            LandlordApproval.property_id == property_id, LandlordApproval.superseded_at.is_(None)
        )
    )


def evidence_ids(db, property_id):
    return set(
        db.scalars(select(PropertyDocument.id).where(PropertyDocument.property_id == property_id))
    )
