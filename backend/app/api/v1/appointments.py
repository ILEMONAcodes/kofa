"""Appointment endpoints; authorization precedes every private read/write."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.core.database import get_db
from app.core.errors import invalid
from app.core.permissions import require_roles
from app.schemas import appointment as s
from app.schemas.inquiry import Envelope, Page
from app.services import appointment as service
from app.services.rate_limit import consume

CLIENT = require_roles("client")
STAFF = require_roles("staff", "admin")
Number = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]


def strict(request: Request):
    path = request.scope["route"].path
    allowed = (
        {"page", "page_size", "status", "date_from", "date_to"}
        if request.method == "GET" and path.endswith("/appointments")
        else set()
    )
    if request.method == "GET" and path == "/api/v1/admin/appointments":
        allowed |= {"staff_id", "inquiry_id"}
    names = [k for k, _ in request.query_params.multi_items()]
    if set(names) - allowed or len(names) != len(set(names)):
        raise invalid("query", "Unknown or repeated query parameter.")


client_router = APIRouter(
    prefix="/api/v1/appointments", dependencies=[Depends(CLIENT), Depends(strict)]
)
staff_router = APIRouter(
    prefix="/api/v1/admin/appointments", dependencies=[Depends(STAFF), Depends(strict)]
)


def dates(start, end):
    for value in [start, end]:
        if value and (value.tzinfo is None or value.utcoffset() is None):
            raise invalid("date", "Include a timezone in date filters.")
    if start and end and start >= end:
        raise invalid("date_to", "End date must be after start date.")


def limit(request, db, actor):
    consume(db, request.app.state.settings, "appointment-write", str(actor.id), 120, 3600)


@client_router.get("", response_model=Page[s.SummaryClient])
def mine(
    page: Number = 1,
    page_size: Size = 20,
    status: s.Status | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db=Depends(get_db),
    actor=Depends(CLIENT),
):
    dates(date_from, date_to)
    return service.listing(
        db, actor, number=page, size=page_size, status=status, date_from=date_from, date_to=date_to
    )


@staff_router.get("", response_model=Page[s.SummaryClient])
def calendar(
    page: Number = 1,
    page_size: Size = 20,
    status: s.Status | None = None,
    staff_id: UUID | None = None,
    inquiry_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    db=Depends(get_db),
    actor=Depends(STAFF),
):
    dates(date_from, date_to)
    return service.listing(
        db,
        actor,
        number=page,
        size=page_size,
        status=status,
        staff_id=staff_id,
        inquiry_id=inquiry_id,
        date_from=date_from,
        date_to=date_to,
    )


@client_router.get("/{appointment_id}", response_model=Envelope[s.DetailClient])
def own_detail(appointment_id: UUID, db=Depends(get_db), actor=Depends(CLIENT)):
    return {"data": service.detail(db, actor, appointment_id)}


@staff_router.get("/{appointment_id}", response_model=Envelope[s.DetailStaff])
def staff_detail(appointment_id: UUID, db=Depends(get_db), actor=Depends(STAFF)):
    return {"data": service.detail(db, actor, appointment_id)}


@staff_router.post("", status_code=201, response_model=Envelope[s.DetailStaff])
def create(data: s.Create, request: Request, db=Depends(get_db), actor=Depends(STAFF)):
    limit(request, db, actor)
    return {"data": service.create(db, actor, data)}


@staff_router.patch("/{appointment_id}", response_model=Envelope[s.DetailStaff])
def reschedule(
    appointment_id: UUID,
    data: s.Reschedule,
    request: Request,
    db=Depends(get_db),
    actor=Depends(STAFF),
):
    limit(request, db, actor)
    return {"data": service.change(db, actor, appointment_id, data, "reschedule")}


@staff_router.post("/{appointment_id}/cancel", response_model=Envelope[s.DetailStaff])
def cancel_staff(
    appointment_id: UUID, data: s.Cancel, request: Request, db=Depends(get_db), actor=Depends(STAFF)
):
    limit(request, db, actor)
    return {"data": service.change(db, actor, appointment_id, data, "cancel")}


@staff_router.post("/{appointment_id}/outcome", response_model=Envelope[s.DetailStaff])
def outcome(
    appointment_id: UUID, data: s.Result, request: Request, db=Depends(get_db), actor=Depends(STAFF)
):
    limit(request, db, actor)
    return {
        "data": service.change(
            db, actor, appointment_id, data, "no_show" if data.no_show else "complete"
        )
    }


@client_router.post("/{appointment_id}/confirm", response_model=Envelope[s.DetailClient])
def confirm(
    appointment_id: UUID,
    data: s.Version,
    request: Request,
    db=Depends(get_db),
    actor=Depends(CLIENT),
):
    limit(request, db, actor)
    return {"data": service.change(db, actor, appointment_id, data, "confirm")}


@client_router.post("/{appointment_id}/cancel", response_model=Envelope[s.DetailClient])
def cancel_client(
    appointment_id: UUID,
    data: s.Reason,
    request: Request,
    db=Depends(get_db),
    actor=Depends(CLIENT),
):
    limit(request, db, actor)
    return {"data": service.change(db, actor, appointment_id, data, "cancel")}


@client_router.post("/{appointment_id}/request-reschedule", response_model=Envelope[s.DetailClient])
def request_reschedule(
    appointment_id: UUID,
    data: s.RequestReschedule,
    request: Request,
    db=Depends(get_db),
    actor=Depends(CLIENT),
):
    limit(request, db, actor)
    return {"data": service.change(db, actor, appointment_id, data, "request_reschedule")}


options_router = APIRouter(
    prefix="/api/v1/admin/appointment-options", dependencies=[Depends(STAFF), Depends(strict)]
)


@options_router.get("", response_model=Envelope[s.Options])
def options(db=Depends(get_db)):
    from app.repositories.appointment import staff_options

    return {
        "data": s.Options(
            staff=[
                s.StaffMember(id=user.id, full_name=user.full_name) for user in staff_options(db)
            ],
            fee=s.Fee(),
        )
    }
