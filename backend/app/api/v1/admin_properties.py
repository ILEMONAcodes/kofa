"""Private property APIs; staff/admin guard executes before any private read."""

from typing import Annotated, Literal, get_args
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request, Response
from fastapi.responses import FileResponse
from starlette.concurrency import run_in_threadpool

from app.core.database import get_db
from app.core.errors import invalid
from app.core.multipart import single_upload
from app.core.permissions import require_roles
from app.schemas import property_admin as schema
from app.schemas import property_workflow as workflow_schema
from app.schemas.submission import UploadEnvelope
from app.services import media
from app.services import property_admin as service
from app.services import property_workflow as workflow
from app.services.rate_limit import consume
from app.services.storage import build_storage

STAFF = require_roles("staff", "admin")


def strict_queries(request: Request):
    path = request.scope["route"].path
    if request.method == "GET" and path == "/api/v1/admin/properties":
        allowed = {
            "status",
            "q",
            "area",
            "assigned_to",
            "listing_type",
            "stale_availability",
            "landlord_id",
            "sort",
            "page",
            "page_size",
        }
    elif request.method == "GET" and path == "/api/v1/admin/landlords":
        allowed = {"q", "page", "page_size"}
    elif request.method == "GET" and path.endswith("/files/{file_id}"):
        allowed = {"token", "thumbnail"}
    else:
        allowed = set()
    names = [key for key, _ in request.query_params.multi_items()]
    if set(names) - allowed or len(set(names)) != len(names):
        raise invalid("query", "Unknown or repeated query parameter.", "invalid_choice")


router = APIRouter(prefix="/api/v1/admin", dependencies=[Depends(STAFF), Depends(strict_queries)])


def store(request):
    return request.app.state.storage or build_storage(request.app.state.settings)


def sorts(value):
    result: list[tuple[str, bool]] = []
    for item in value.split(","):
        name = item.removeprefix("-")
        if name not in {"submitted_at", "updated_at"} or name in [n for n, _ in result]:
            raise invalid("sort", "Choose supported, unique sort fields.", "invalid_choice")
        result.append((name, item.startswith("-")))
    return result


def statuses(value):
    if value is None or not value.strip():
        return None
    items = value.split(",")
    allowed = set(get_args(schema.PropertyStatus))
    if len(set(items)) != len(items) or any(item not in allowed for item in items):
        raise invalid("status", "Choose supported, unique statuses.", "invalid_choice")
    return items


@router.get("/properties", response_model=schema.PropertyPage)
def queue(
    request: Request,
    status: str | None = Query(None, max_length=200),
    q: str | None = Query(None, max_length=150),
    area: str | None = Query(None, max_length=100),
    assigned_to: UUID | None = None,
    listing_type: Literal["rent", "sale"] | None = None,
    stale_availability: bool | None = None,
    landlord_id: UUID | None = None,
    sort: str = Query("-submitted_at", max_length=100),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    actor=Depends(STAFF),
    db=Depends(get_db),
):
    filters = dict(
        status=statuses(status),
        q=q.strip() or None if q else None,
        area=area.strip() or None if area else None,
        assigned_to=assigned_to,
        listing_type=listing_type,
        stale_availability=stale_availability,
        landlord_id=landlord_id,
    )
    return service.list_properties(
        db,
        request.app.state.settings,
        actor.id,
        filters,
        sorts(sort),
        page,
        page_size,
        request.app.state.storage,
    )


@router.get("/properties/{id}", response_model=schema.DetailEnvelope)
def detail(id: UUID, request: Request, actor=Depends(STAFF), db=Depends(get_db)):
    return {
        "data": service.get_detail(
            db, request.app.state.settings, actor.id, id, request.app.state.storage
        )
    }


@router.patch("/properties/{id}", response_model=schema.MutationEnvelope)
def patch(id: UUID, data: schema.PropertyPatch, actor=Depends(STAFF), db=Depends(get_db)):
    return {"data": service.edit(db, actor.id, id, data)}


@router.post("/properties/{id}/assign", response_model=schema.MutationEnvelope)
def assign(id: UUID, data: schema.Assignment, actor=Depends(STAFF), db=Depends(get_db)):
    return {"data": service.assign(db, actor.id, id, data)}


@router.patch("/properties/{id}/availability", response_model=schema.MutationEnvelope)
def availability(
    id: UUID, data: schema.AvailabilityInput, actor=Depends(STAFF), db=Depends(get_db)
):
    return {"data": service.availability(db, actor.id, id, data)}


@router.post(
    "/properties/{id}/media",
    status_code=201,
    response_model=UploadEnvelope,
    openapi_extra={
        "requestBody": {
            "required": True,
            "content": {
                "multipart/form-data": {
                    "schema": {
                        "type": "object",
                        "required": ["file", "kind"],
                        "additionalProperties": False,
                        "properties": {
                            "file": {"type": "string", "format": "binary"},
                            "kind": {
                                "type": "string",
                                "enum": [
                                    "photo",
                                    "video",
                                    "ownership_proof",
                                    "authorization_letter",
                                    "id_document",
                                    "other",
                                ],
                            },
                            "caption": {"type": "string", "maxLength": 200},
                        },
                    }
                }
            },
        }
    },
)
async def upload(id: UUID, request: Request, actor=Depends(STAFF), db=Depends(get_db)):
    settings = request.app.state.settings
    await run_in_threadpool(consume, db, settings, "staff-upload-user", str(actor.id), 60, 3600)
    storage = store(request)
    async with single_upload(request) as (file, kind, caption):
        item = await run_in_threadpool(
            media.add_file,
            db,
            settings,
            storage,
            id,
            file.file,
            kind,
            file.filename or "upload",
            file.content_type,
            actor_id=actor.id,
            caption=caption,
        )
    return {
        "data": {
            "file_id": item.id,
            "kind": item.kind,
            "size_bytes": item.size_bytes,
            "status": "uploaded",
        }
    }


@router.patch("/properties/{id}/media/{media_id}", response_model=schema.MutationEnvelope)
def patch_media(
    id: UUID, media_id: UUID, data: schema.MediaPatch, actor=Depends(STAFF), db=Depends(get_db)
):
    return {"data": service.update_media(db, actor.id, id, media_id, data)}


@router.delete("/properties/{id}/media/{media_id}", status_code=204)
def delete_media(
    id: UUID, media_id: UUID, request: Request, actor=Depends(STAFF), db=Depends(get_db)
):
    service.remove_media(db, store(request), actor.id, id, media_id)
    return Response(status_code=204)


@router.get(
    "/properties/{id}/files/{file_id}",
    responses={
        200: {
            "content": {
                "application/octet-stream": {"schema": {"type": "string", "format": "binary"}}
            }
        }
    },
)
def private_file(
    id: UUID,
    file_id: UUID,
    request: Request,
    token: Annotated[str, Query(min_length=20, max_length=2048)],
    thumbnail: bool = False,
    actor=Depends(STAFF),
    db=Depends(get_db),
):
    path, mime = service.local_download(db, store(request), actor.id, id, file_id, token, thumbnail)
    return FileResponse(
        path,
        media_type=mime,
        filename=f"property-file-{file_id}.{path.suffix.lstrip('.')}",
        headers={"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"},
    )


@router.get("/landlords", response_model=schema.LandlordPage)
def landlords(
    q: str | None = Query(None, max_length=150),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    actor=Depends(STAFF),
    db=Depends(get_db),
):
    return service.list_landlords(db, actor.id, q.strip() or None if q else None, page, page_size)


@router.get("/landlords/{id}", response_model=schema.LandlordEnvelope)
def landlord(id: UUID, request: Request, actor=Depends(STAFF), db=Depends(get_db)):
    return {
        "data": service.get_landlord(
            db, request.app.state.settings, actor.id, id, request.app.state.storage
        )
    }


@router.get("/property-options", response_model=schema.OptionsEnvelope)
def property_options(actor=Depends(STAFF), db=Depends(get_db)):
    return {"data": service.property_options(db, actor.id)}


# State transitions and verification share the existing staff guard and body limits.
@router.post("/properties/{id}/transitions", response_model=schema.MutationEnvelope)
def transition(
    id: UUID, data: workflow_schema.Transition, actor=Depends(STAFF), db=Depends(get_db)
):
    return {"data": workflow.transition(db, actor.id, id, data)}


@router.put("/properties/{id}/verification", response_model=schema.MutationEnvelope)
def save_verification(
    id: UUID, data: workflow_schema.VerificationInput, actor=Depends(STAFF), db=Depends(get_db)
):
    return {"data": workflow.save_verification(db, actor.id, id, data)}


@router.post("/properties/{id}/verification/complete", response_model=schema.MutationEnvelope)
def complete_verification(
    id: UUID, data: workflow_schema.Completion, actor=Depends(STAFF), db=Depends(get_db)
):
    return {"data": workflow.complete_verification(db, actor.id, id, data)}


@router.post(
    "/properties/{id}/landlord-approval", response_model=schema.MutationEnvelope, status_code=201
)
def landlord_approval(
    id: UUID, data: workflow_schema.ApprovalInput, actor=Depends(STAFF), db=Depends(get_db)
):
    return {"data": workflow.approve_landlord(db, actor.id, id, data)}
