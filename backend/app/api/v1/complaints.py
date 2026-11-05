"""Public receipt, own-client tracker and private team investigation routes."""

from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, File, Header, Query, Request, Response, UploadFile
from fastapi.responses import FileResponse

from app.core.database import get_db
from app.core.errors import invalid
from app.core.permissions import authenticated, require_roles
from app.repositories import complaint as repo
from app.schemas import complaint as s
from app.schemas.appointment import StaffMember
from app.schemas.auth import StrictModel
from app.schemas.inquiry import Envelope, Page
from app.services import complaint as service
from app.services.rate_limit import consume
from app.services.storage import LocalStorage, build_storage
from app.services.submission import check_captcha

LiteralSort = Literal["created_at", "-created_at"]

CLIENT = require_roles("client")
STAFF = require_roles("staff", "admin")


def strict(request: Request):
    path = request.scope["route"].path
    allowed = (
        {"page", "page_size", "status"}
        if request.method == "GET" and path.endswith("/complaints")
        else set()
    )
    if path == "/api/v1/admin/complaints" and request.method == "GET":
        allowed |= {
            "kind",
            "reason",
            "assigned_to",
            "property_id",
            "outcome",
            "overdue_first_response",
            "q",
            "sort",
        }
    if path.endswith("/content"):
        allowed = {"token"}
    keys = [k for k, _ in request.query_params.multi_items()]
    if set(keys) - allowed or len(keys) != len(set(keys)):
        raise invalid("query", "Unknown or repeated query parameter.")


public_router = APIRouter(prefix="/api/v1/reports", dependencies=[Depends(strict)])
client_router = APIRouter(
    prefix="/api/v1/complaints", dependencies=[Depends(CLIENT), Depends(strict)]
)
staff_router = APIRouter(
    prefix="/api/v1/admin/complaints", dependencies=[Depends(STAFF), Depends(strict)]
)
options_router = APIRouter(
    prefix="/api/v1/admin/complaint-options", dependencies=[Depends(STAFF), Depends(strict)]
)


def ip(request):
    return request.client.host if request.client else "unknown"


def storage(request):
    return request.app.state.storage or build_storage(request.app.state.settings)


def limit(request, db, actor):
    consume(db, request.app.state.settings, "complaint-write", str(actor.id), 120, 3600)


class Options(StrictModel):
    staff: list[StaffMember]


class Grant(StrictModel):
    url: str
    expires_at: int


@options_router.get("", response_model=Envelope[Options])
def options(db=Depends(get_db)):
    return {
        "data": Options(staff=[StaffMember(id=u.id, full_name=u.full_name) for u in repo.staff(db)])
    }


@public_router.post("", status_code=201, response_model=Envelope[s.Receipt])
def report(
    data: s.Report,
    request: Request,
    db=Depends(get_db),
    captcha: str | None = Header(default=None, alias="X-Captcha-Token", max_length=4096),
):
    settings = request.app.state.settings
    key = service.ip_key(settings, ip(request))
    consume(db, settings, "report-ip", key, 10, 86400)
    consume(db, settings, "report-property", key + ":" + data.property_slug, 3, 86400)
    if not data.website:
        check_captcha(settings, request.app.state.captcha_verifier, captcha, ip(request))
    actor = authenticated(request, db) if request.cookies.get("access_token") else None
    return {"data": service.create(db, settings, data, ip(request), actor)}


@client_router.post("", status_code=201, response_model=Envelope[s.Receipt])
def create(data: s.Create, request: Request, db=Depends(get_db), actor=Depends(CLIENT)):
    consume(db, request.app.state.settings, "complaint-create", str(actor.id), 5, 86400)
    return {"data": service.create(db, request.app.state.settings, data, ip(request), actor)}


@client_router.get("", response_model=Page[s.CaseSummary])
def mine(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status: s.Status | None = None,
    db=Depends(get_db),
    actor=Depends(CLIENT),
):
    return service.listing(db, actor, {"status": status}, page, page_size)


@staff_router.get("", response_model=Page[s.CaseSummary])
def queue(
    page: Annotated[int, Query(ge=1)] = 1,
    page_size: Annotated[int, Query(ge=1, le=100)] = 20,
    status: s.Status | None = None,
    kind: s.Kind | None = None,
    reason: s.Reason | None = None,
    assigned_to: UUID | None = None,
    property_id: UUID | None = None,
    outcome: s.Outcome | None = None,
    overdue_first_response: bool | None = None,
    q: Annotated[str | None, Query(max_length=100)] = None,
    sort: LiteralSort = "-created_at",
    db=Depends(get_db),
    actor=Depends(STAFF),
):
    return service.listing(
        db,
        actor,
        dict(
            status=status,
            kind=kind,
            reason=reason,
            assigned_to=assigned_to,
            property_id=property_id,
            outcome=outcome,
            overdue_first_response=overdue_first_response,
            q=q,
            sort=sort,
        ),
        page,
        page_size,
    )


@client_router.get("/{id}", response_model=Envelope[s.CaseSummary])
def own(id: UUID, db=Depends(get_db), actor=Depends(CLIENT)):
    return {"data": service.detail(db, actor, id)}


@staff_router.get("/{id}", response_model=Envelope[s.StaffDetail])
def detail(id: UUID, db=Depends(get_db), actor=Depends(STAFF)):
    return {"data": service.detail(db, actor, id)}


@staff_router.post("/{id}/assign", response_model=Envelope[s.StaffDetail])
def assign(id: UUID, data: s.Assign, request: Request, db=Depends(get_db), actor=Depends(STAFF)):
    limit(request, db, actor)
    return {"data": service.mutate(db, actor, id, data, "assign")}


@staff_router.put("/{id}/investigation", response_model=Envelope[s.StaffDetail])
def investigation(
    id: UUID, data: s.Investigation, request: Request, db=Depends(get_db), actor=Depends(STAFF)
):
    limit(request, db, actor)
    return {"data": service.mutate(db, actor, id, data, "investigation")}


@staff_router.post("/{id}/transitions", response_model=Envelope[s.StaffDetail])
def transition(
    id: UUID, data: s.Transition, request: Request, db=Depends(get_db), actor=Depends(STAFF)
):
    limit(request, db, actor)
    return {"data": service.mutate(db, actor, id, data, "transition")}


def token_limit(request, db, token):
    consume(db, request.app.state.settings, "complaint-upload", service.digest(token), 10, 3600)


@public_router.post("/{id}/files", status_code=201, response_model=Envelope[s.Evidence])
def public_upload(
    id: UUID,
    request: Request,
    file: UploadFile = File(...),
    token: str = Header(alias="X-Upload-Token", max_length=200),
    db=Depends(get_db),
):
    token_limit(request, db, token)
    return {"data": service.upload(db, storage(request), id, token, file)}


@client_router.post("/{id}/files", status_code=201, response_model=Envelope[s.Evidence])
def own_upload(
    id: UUID,
    request: Request,
    file: UploadFile = File(...),
    token: str = Header(alias="X-Upload-Token", max_length=200),
    db=Depends(get_db),
    actor=Depends(CLIENT),
):
    token_limit(request, db, token)
    return {"data": service.upload(db, storage(request), id, token, file, actor)}


@public_router.delete("/{id}/files/{file_id}", status_code=204)
def public_remove(
    id: UUID,
    file_id: UUID,
    request: Request,
    token: str = Header(alias="X-Upload-Token", max_length=200),
    db=Depends(get_db),
):
    token_limit(request, db, token)
    service.remove(db, id, file_id, token)
    return Response(status_code=204)


@client_router.delete("/{id}/files/{file_id}", status_code=204)
def own_remove(
    id: UUID,
    file_id: UUID,
    request: Request,
    token: str = Header(alias="X-Upload-Token", max_length=200),
    db=Depends(get_db),
    actor=Depends(CLIENT),
):
    token_limit(request, db, token)
    service.remove(db, id, file_id, token, actor)
    return Response(status_code=204)


@staff_router.get("/{id}/files/{file_id}", response_model=Envelope[Grant])
def grant(id: UUID, file_id: UUID, request: Request, db=Depends(get_db), actor=Depends(STAFF)):
    record = service.evidence_record(db, actor, id, file_id)
    store = storage(request)
    g = store.signed_read(record.storage_key)
    from urllib.parse import urlencode

    url = (
        g.url
        if not isinstance(store, LocalStorage)
        else f"/api/v1/admin/complaints/{id}/files/{file_id}/content?"
        + urlencode({"token": g.token})
    )
    return {"data": Grant(url=url, expires_at=g.expires_at)}


@staff_router.get("/{id}/files/{file_id}/content")
def content(
    id: UUID,
    file_id: UUID,
    request: Request,
    token: Annotated[str, Query(max_length=1000)],
    db=Depends(get_db),
    actor=Depends(STAFF),
):
    record = service.evidence_record(db, actor, id, file_id)
    store = storage(request)
    if not isinstance(store, LocalStorage):
        raise service.missing()
    path = store.verified_path(token)
    if path != store.path(record.storage_key):
        raise service.missing()
    return FileResponse(
        path,
        media_type=record.mime_type,
        filename="evidence",
        headers={
            "Cache-Control": "private, no-store",
            "X-Content-Type-Options": "nosniff",
            "Content-Security-Policy": "sandbox; default-src 'none'",
        },
    )
