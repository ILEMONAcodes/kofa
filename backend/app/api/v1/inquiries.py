"""Thin, default-deny inquiry and client-directory routes."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request

from app.core.database import get_db
from app.core.errors import invalid
from app.core.permissions import require_roles
from app.repositories import inquiry as repo
from app.schemas import inquiry as s
from app.services import inquiry as service
from app.services.rate_limit import consume

CLIENT = require_roles("client")
STAFF = require_roles("staff", "admin")


def strict(request: Request):
    path = request.scope["route"].path
    allowed = (
        {"page", "page_size"}
        if request.method == "GET"
        and (
            path.endswith("/inquiries")
            or path.endswith("/messages")
            or path.endswith("/notes")
            or path.endswith("/clients")
        )
        else set()
    )
    if request.method == "GET" and path.endswith("/inquiries"):
        allowed |= {"status", "q"} | ({"assigned_to"} if "/admin/" in path else set())
    if request.method == "GET" and path.endswith("/clients"):
        allowed |= {"q"}
    keys = [k for k, _ in request.query_params.multi_items()]
    if set(keys) - allowed or len(keys) != len(set(keys)):
        raise invalid("query", "Unknown or repeated query parameter.")


client_router = APIRouter(
    prefix="/api/v1/inquiries", dependencies=[Depends(CLIENT), Depends(strict)]
)
staff_router = APIRouter(prefix="/api/v1/admin", dependencies=[Depends(STAFF), Depends(strict)])
Number = Annotated[int, Query(ge=1)]
Size = Annotated[int, Query(ge=1, le=100)]


def budget(request, db, actor, namespace, limit, seconds):
    consume(db, request.app.state.settings, namespace, str(actor.id), limit, seconds)


@client_router.post("", status_code=201, response_model=s.Envelope[s.Receipt])
def create(
    data: s.Create,
    request: Request,
    db=Depends(get_db),
    actor=Depends(CLIENT),
    key: Annotated[
        str | None, Header(alias="Idempotency-Key", min_length=1, max_length=128)
    ] = None,
):
    budget(request, db, actor, "inquiry-create", 20, 86400)
    return {"data": service.create(db, actor, data, key)}


@client_router.get("", response_model=s.Page[s.Summary])
def mine(
    page: Number = 1,
    page_size: Size = 20,
    status: s.Status | None = None,
    q: Annotated[str | None, Query(max_length=150)] = None,
    db=Depends(get_db),
    actor=Depends(CLIENT),
):
    return service.list_inquiries(db, actor, number=page, size=page_size, status=status, q=q)


@staff_router.get("/inquiries", response_model=s.Page[s.Summary])
def pipeline(
    page: Number = 1,
    page_size: Size = 20,
    status: s.Status | None = None,
    q: Annotated[str | None, Query(max_length=150)] = None,
    assigned_to: UUID | None = None,
    db=Depends(get_db),
    actor=Depends(STAFF),
):
    return service.list_inquiries(
        db, actor, number=page, size=page_size, status=status, q=q, assigned_to=assigned_to
    )


@client_router.get("/{inquiry_id}", response_model=s.Envelope[s.Summary])
def own_detail(inquiry_id: UUID, db=Depends(get_db), actor=Depends(CLIENT)):
    return {"data": service.detail(db, actor, inquiry_id)}


@staff_router.get("/inquiries/{inquiry_id}", response_model=s.Envelope[s.Detail])
def staff_detail(inquiry_id: UUID, db=Depends(get_db), actor=Depends(STAFF)):
    return {"data": service.detail(db, actor, inquiry_id)}


@client_router.get("/{inquiry_id}/messages", response_model=s.Page[s.Message])
def own_messages(
    inquiry_id: UUID,
    page: Number = 1,
    page_size: Size = 20,
    db=Depends(get_db),
    actor=Depends(CLIENT),
):
    return service.thread(db, actor, inquiry_id, page, page_size)


@staff_router.get("/inquiries/{inquiry_id}/messages", response_model=s.Page[s.Message])
def staff_messages(
    inquiry_id: UUID,
    page: Number = 1,
    page_size: Size = 20,
    db=Depends(get_db),
    actor=Depends(STAFF),
):
    return service.thread(db, actor, inquiry_id, page, page_size)


@client_router.post("/{inquiry_id}/messages", status_code=201, response_model=s.Envelope[s.Message])
def own_send(
    inquiry_id: UUID, data: s.TextInput, request: Request, db=Depends(get_db), actor=Depends(CLIENT)
):
    budget(request, db, actor, "inquiry-message", 60, 3600)
    return {"data": service.send(db, actor, inquiry_id, data)}


@staff_router.post(
    "/inquiries/{inquiry_id}/messages", status_code=201, response_model=s.Envelope[s.Message]
)
def staff_send(
    inquiry_id: UUID, data: s.TextInput, request: Request, db=Depends(get_db), actor=Depends(STAFF)
):
    budget(request, db, actor, "inquiry-message", 60, 3600)
    return {"data": service.send(db, actor, inquiry_id, data)}


@staff_router.get("/inquiries/{inquiry_id}/notes", response_model=s.Page[s.Note])
def notes(
    inquiry_id: UUID,
    page: Number = 1,
    page_size: Size = 20,
    db=Depends(get_db),
    actor=Depends(STAFF),
):
    return service.thread(db, actor, inquiry_id, page, page_size, True)


@staff_router.post(
    "/inquiries/{inquiry_id}/notes", status_code=201, response_model=s.Envelope[s.Note]
)
def note(
    inquiry_id: UUID, data: s.TextInput, request: Request, db=Depends(get_db), actor=Depends(STAFF)
):
    budget(request, db, actor, "inquiry-note", 60, 3600)
    return {"data": service.send(db, actor, inquiry_id, data, True)}


@staff_router.post("/inquiries/{inquiry_id}/assign", response_model=s.Envelope[s.Mutation])
def assign(inquiry_id: UUID, data: s.Assign, db=Depends(get_db), actor=Depends(STAFF)):
    return {"data": service.change(db, actor, inquiry_id, data, "assign")}


@staff_router.put("/inquiries/{inquiry_id}/qualification", response_model=s.Envelope[s.Mutation])
def qualification(inquiry_id: UUID, data: s.Qualify, db=Depends(get_db), actor=Depends(STAFF)):
    return {"data": service.change(db, actor, inquiry_id, data, "qualification")}


@staff_router.post("/inquiries/{inquiry_id}/transitions", response_model=s.Envelope[s.Mutation])
def transition(inquiry_id: UUID, data: s.Transition, db=Depends(get_db), actor=Depends(STAFF)):
    return {"data": service.change(db, actor, inquiry_id, data, "transition")}


@staff_router.get("/clients", response_model=s.Page[s.Client])
def clients(
    page: Number = 1,
    page_size: Size = 20,
    q: Annotated[str | None, Query(max_length=150)] = None,
    db=Depends(get_db),
):
    rows, meta = repo.clients(db, page, page_size, q)
    return {"data": [service.client_out(r) for r in rows], "meta": meta}


@staff_router.get("/clients/{client_id}", response_model=s.Envelope[s.ClientDetail])
def client_detail(client_id: UUID, db=Depends(get_db), actor=Depends(STAFF)):
    return {"data": service.client_detail(db, actor, client_id)}


@staff_router.patch("/clients/{client_id}", response_model=s.Envelope[s.Client])
def client_patch(client_id: UUID, data: s.ClientPatch, db=Depends(get_db), actor=Depends(STAFF)):
    return {"data": service.update_client(db, actor, client_id, data)}


@client_router.post("/{inquiry_id}/read", response_model=s.Envelope[s.ReadReceipt])
def own_read(
    inquiry_id: UUID, data: s.ReadInput, request: Request, db=Depends(get_db), actor=Depends(CLIENT)
):
    budget(request, db, actor, "inquiry-read", 240, 3600)
    return {"data": service.mark_read(db, actor, inquiry_id, data.through_message_id)}


@staff_router.post("/inquiries/{inquiry_id}/read", response_model=s.Envelope[s.ReadReceipt])
def staff_read(
    inquiry_id: UUID, data: s.ReadInput, request: Request, db=Depends(get_db), actor=Depends(STAFF)
):
    budget(request, db, actor, "inquiry-read", 240, 3600)
    return {"data": service.mark_read(db, actor, inquiry_id, data.through_message_id)}
