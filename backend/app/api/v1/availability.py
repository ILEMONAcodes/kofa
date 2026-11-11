from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.core.database import get_db
from app.core.errors import invalid
from app.core.permissions import require_roles
from app.schemas import availability as s
from app.services import availability as service

STAFF = require_roles("staff", "admin")


def strict(request: Request):
    allowed = (
        {"page", "page_size", "q", "assigned_to"}
        if request.url.path.endswith("/availability-queue")
        else set()
    )
    keys = [key for key, _ in request.query_params.multi_items()]
    if set(keys) - allowed or len(keys) != len(set(keys)):
        raise invalid("query", "Unknown or repeated query parameter.")


router = APIRouter(prefix="/api/v1/admin", dependencies=[Depends(STAFF), Depends(strict)])


@router.get("/availability-queue", response_model=s.AvailabilityQueue)
def queue(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=150),
    assigned_to: UUID | None = None,
    actor=Depends(STAFF),
    db=Depends(get_db),
):
    return service.listing(
        db, request.app.state.settings, actor.id, page, page_size, q, assigned_to
    )


@router.get("/properties/{id}/availability-history", response_model=s.AvailabilityHistory)
def history(id: UUID, actor=Depends(STAFF), db=Depends(get_db)):
    return service.history(db, actor.id, id)
