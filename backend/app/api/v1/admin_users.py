from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from app.api.v1.auth import client_ip
from app.core.database import get_db
from app.core.errors import invalid
from app.core.permissions import require_roles
from app.schemas.auth import CreateStaff, UpdateUser, user_out
from app.services import admin_users

router = APIRouter(prefix="/api/v1/admin/users", dependencies=[Depends(require_roles("admin"))])


@router.get("")
def list_users(
    request: Request,
    role: Literal["client", "staff", "admin"] | None = None,
    is_active: bool | None = None,
    q: str | None = Query(None, max_length=150),
    sort: Literal["created_at", "-created_at", "full_name", "-full_name"] = "-created_at",
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
):
    unknown = set(request.query_params) - {"role", "is_active", "q", "sort", "page", "page_size"}
    if unknown:
        raise invalid(sorted(unknown)[0], "Unknown filter.", "invalid_choice")
    users, total = admin_users.list_users(
        db, role=role, is_active=is_active, q=q, sort=sort, page=page, page_size=page_size
    )
    return {
        "data": [user_out(user, admin=True) for user in users],
        "meta": {
            "page": page,
            "page_size": page_size,
            "total": total,
            "total_pages": (total + page_size - 1) // page_size,
        },
    }


@router.post("", status_code=201)
def create(
    data: CreateStaff,
    request: Request,
    actor=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    user = admin_users.create_staff(db, request.app.state.settings, actor, data, client_ip(request))
    return {"data": user_out(user, admin=True)}


@router.patch("/{user_id}")
def update(
    user_id: UUID,
    data: UpdateUser,
    request: Request,
    actor=Depends(require_roles("admin")),
    db: Session = Depends(get_db),
):
    return {
        "data": user_out(
            admin_users.update_user(db, actor, user_id, data, client_ip(request)), admin=True
        )
    }
