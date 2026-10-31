import secrets

from sqlalchemy.exc import IntegrityError

from app.core.errors import AppError, invalid
from app.core.security import hasher
from app.models.identity import User
from app.repositories import identity
from app.repositories.identity import by_email, revoke_user
from app.services.auth import audit, duplicate_email, queue_token


def create_staff(db, settings, actor, data, ip):
    if by_email(db, str(data.email)):
        duplicate_email(db)
    user = User(
        email=str(data.email).lower(),
        full_name=data.full_name,
        phone=data.phone,
        role=data.role,
        password_hash=hasher.hash(data.temporary_password or secrets.token_urlsafe(48)),
    )
    db.add(user)
    try:
        db.flush()
        if not data.temporary_password:
            queue_token(db, settings, user, "invitation")
        audit(
            db, "admin.user_created", actor, user, ip, after={"role": user.role, "is_active": True}
        )
        db.commit()
    except IntegrityError:
        duplicate_email(db)
    return user


def update_user(db, actor, user_id, data, ip):
    # Serialize role/activity edits so concurrent admins cannot remove the last administrator.
    identity.lock_admin_mutations(db)
    user = identity.locked_user(db, user_id)
    if not user:
        raise AppError(404, "NOT_FOUND", "Account not found.")
    if user.row_version != data.version:
        raise AppError(409, "VERSION_CONFLICT", "This account changed. Reload and try again.")
    removes_admin = data.is_active is False or (data.role is not None and data.role != "admin")
    if user.id == actor.id and removes_admin:
        raise AppError(403, "FORBIDDEN", "You cannot demote or deactivate your own account.")
    if user.role == "admin" and user.is_active and removes_admin:
        count = identity.active_admin_count(db)
        if count <= 1:
            raise AppError(409, "CONFLICT", "Keep at least one active administrator.")
    before = {"role": user.role, "is_active": user.is_active}
    fields = data.model_dump(exclude_unset=True, exclude={"version"})
    if user.role == "client" and "phone" in fields and fields["phone"] is None:
        raise invalid("phone", "A phone number is required for client accounts.", "required")
    for key, value in fields.items():
        if value is None and key != "phone":
            continue
        setattr(user, key, value)
    user.row_version += 1
    if before != {"role": user.role, "is_active": user.is_active}:
        revoke_user(db, user.id)
    audit(
        db,
        "admin.user_updated",
        actor,
        user,
        ip,
        before=before,
        after={"role": user.role, "is_active": user.is_active},
    )
    db.commit()
    return user


def list_users(db, **filters):
    return identity.list_users(db, **filters)
