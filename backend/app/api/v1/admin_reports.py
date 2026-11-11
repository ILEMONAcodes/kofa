"""Private, aggregate-only operational reporting."""

from typing import Annotated

from fastapi import APIRouter, Depends, Query, Request

from app.core.database import get_db
from app.core.errors import invalid
from app.core.permissions import require_roles
from app.schemas.report import Envelope
from app.services.report import dashboard


def strict(request: Request):
    keys = [key for key, _ in request.query_params.multi_items()]
    if set(keys) - {"from", "to"} or len(keys) != len(set(keys)):
        raise invalid("query", "Unknown or repeated query parameter.")


router = APIRouter(
    prefix="/api/v1/admin/reports",
    dependencies=[Depends(require_roles("staff", "admin")), Depends(strict)],
)


@router.get("/kpis", response_model=Envelope)
def kpis(
    from_date: Annotated[str | None, Query(alias="from")] = None,
    to_date: Annotated[str | None, Query(alias="to")] = None,
    db=Depends(get_db),
    actor=Depends(require_roles("staff", "admin")),
):
    return {"data": dashboard(db, actor, from_date, to_date)}
