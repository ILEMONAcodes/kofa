import secrets
import uuid
from datetime import timedelta

from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError, invalid
from app.core.security import (
    DUMMY_HASH,
    REFRESH_SECONDS,
    access_token,
    decode_access,
    digest,
    hasher,
    now,
    verify_password,
)
from app.models.identity import (
    AuditLog,
    AuthSession,
    EmailOutbox,
    OneTimeToken,
    PolicyAcceptance,
    User,
)
from app.repositories import identity
from app.repositories.identity import by_email, revoke_family, revoke_user, session_by_token


def audit(db, action, actor=None, entity=None, ip=None, before=None, after=None):
    db.add(
        AuditLog(
            action=action,
            actor_user_id=actor.id if actor else None,
            entity_id=entity.id if entity else None,
            actor_ip=ip,
            before=before,
            after=after,
        )
    )


def duplicate_email(db):
    db.rollback()
    raise AppError(
        409,
        "CONFLICT",
        "An account with this email already exists.",
        [{"field": "email", "code": "not_unique", "message": "Email is already registered."}],
    )


def create_session(db, settings, user, ip=None, agent=None, family=None):
    raw = secrets.token_urlsafe(48)
    session = AuthSession(
        user_id=user.id,
        token_hash=digest(raw),
        family_id=family or uuid.uuid4(),
        expires_at=now() + timedelta(seconds=REFRESH_SECONDS),
        ip=ip,
        user_agent=(agent or "")[:255],
    )
    db.add(session)
    db.flush()
    access = access_token(settings, user.id, session.id, session.family_id)
    return session, access, raw


def register(db, settings, data, ip, agent):
    if settings.app_env == "production" and not settings.policies_approved:
        raise AppError(503, "SERVICE_UNAVAILABLE", "Registration is not available yet.")
    accepted = {p.type: p.version for p in data.accepted_policies}
    if accepted != {"terms": settings.terms_version, "privacy": settings.privacy_version}:
        raise invalid(
            "accepted_policies",
            "Accept the current Terms and Privacy Policy versions.",
            "invalid_choice",
        )
    if by_email(db, str(data.email)):
        duplicate_email(db)
    user = User(
        email=str(data.email).lower(),
        full_name=data.full_name,
        phone=data.phone,
        role="client",
        password_hash=hasher.hash(data.password),
    )
    db.add(user)
    try:
        db.flush()
        for kind, version in accepted.items():
            db.add(PolicyAcceptance(user_id=user.id, policy_type=kind, version=version, ip=ip))
        audit(db, "auth.register", user, user, ip)
        _, access, raw = create_session(db, settings, user, ip, agent)
        queue_token(db, settings, user, "verification")
        db.commit()
    except IntegrityError:
        duplicate_email(db)
    return user, access, raw


def login(db, settings, data, ip, agent):
    user = by_email(db, str(data.email))
    correct = verify_password(data.password, user.password_hash if user else DUMMY_HASH)
    if not user or not correct or not user.is_active:
        raise AppError(401, "UNAUTHENTICATED", "Invalid email or password.")
    if hasher.check_needs_rehash(user.password_hash):
        user.password_hash = hasher.hash(data.password)
    user.last_login_at = now()
    _, access, raw = create_session(db, settings, user, ip, agent)
    audit(db, "auth.login", user, user, ip)
    db.commit()
    return user, access, raw


def current_user(db, settings, token):
    claims = decode_access(settings, token or "")
    session = identity.session_by_id(db, claims["sid"])
    user = identity.user_by_id(db, claims["sub"])
    if (
        not user
        or not user.is_active
        or not session
        or session.user_id != user.id
        or session.family_id != claims["fid"]
        or session.revoked_at
        or session.expires_at <= now()
    ):
        raise AppError(401, "UNAUTHENTICATED", "Please sign in to continue.")
    return user


def refresh(db, settings, token, ip, agent):
    session = session_by_token(db, token or "", lock=True)
    if not session:
        raise AppError(401, "UNAUTHENTICATED", "Please sign in to continue.")
    if session.revoked_at or session.replaced_by_id or session.expires_at <= now():
        revoke_family(db, session.family_id)
        db.commit()  # Reuse revocation must survive the rejected request.
        raise AppError(401, "UNAUTHENTICATED", "Please sign in to continue.")
    user = identity.user_by_id(db, session.user_id)
    if not user or not user.is_active:
        revoke_family(db, session.family_id)
        db.commit()
        raise AppError(401, "UNAUTHENTICATED", "Please sign in to continue.")
    next_session, access, raw = create_session(db, settings, user, ip, agent, session.family_id)
    session.revoked_at = now()
    session.replaced_by_id = next_session.id
    db.commit()
    return user, access, raw


def logout(db, settings, refresh_token, access, ip):
    session = session_by_token(db, refresh_token or "")
    family = session.family_id if session else None
    user = identity.user_by_id(db, session.user_id) if session else None
    if not family and access:
        try:
            claims = decode_access(settings, access, allow_expired=True)
            family = claims["fid"]
            user = identity.user_by_id(db, claims["sub"])
        except AppError:
            pass
    if family:
        revoke_family(db, family)
        audit(db, "auth.logout", user, user, ip)
        db.commit()


def queue_token(db, settings, user, purpose):
    # Supersede earlier links for the same operation.
    identity.invalidate_links(db, user.id, [purpose])
    token = secrets.token_urlsafe(48)
    expires = now() + timedelta(hours=1)
    db.add(
        OneTimeToken(user_id=user.id, token_hash=digest(token), purpose=purpose, expires_at=expires)
    )
    route = "verify-email" if purpose == "verification" else "reset-password"
    # Fragments are not sent in HTTP requests/access logs.
    link = f"{settings.public_origin}/{route}#token={token}&purpose={purpose}"
    db.add(EmailOutbox(to_email=user.email, template=purpose, payload={"link": link}))


def request_reset(db, settings, email):
    user = by_email(db, str(email))
    if user and user.is_active:
        queue_token(db, settings, user, "reset")
        db.commit()


def consume_token(db, settings, token, purposes, password=None, ip=None):
    row = identity.one_time_token(db, token)
    if not row or row.used_at or row.expires_at <= now() or row.purpose not in purposes:
        raise invalid("token", "This link has expired or has already been used.")
    user = identity.user_by_id(db, row.user_id)
    if not user or not user.is_active:
        raise invalid("token", "This link has expired or has already been used.")
    row.used_at = now()
    if password is not None:
        user.password_hash = hasher.hash(password)
        user.row_version += 1
        revoke_user(db, user.id)
        # All outstanding password/invitation links become unusable.
        identity.invalidate_links(db, user.id, ["reset", "invitation"])
        audit(db, "auth.password_changed", user, user, ip)
    else:
        user.email_verified_at = now()
        audit(db, "auth.email_verified", user, user, ip)
    db.commit()


def request_verification(db, settings, user):
    if not user.email_verified_at:
        queue_token(db, settings, user, "verification")
        db.commit()
