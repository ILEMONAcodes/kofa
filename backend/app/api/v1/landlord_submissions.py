"""Public contact-submission routes. Upload tokens never grant read access."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, Request, Response
from sqlalchemy.orm import Session
from starlette.concurrency import run_in_threadpool
from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException

from app.api.v1.auth import client_ip
from app.core.database import get_db
from app.core.errors import AppError, invalid
from app.core.multipart import ClosingMultiPartParser
from app.schemas.submission import (
    DraftEnvelope,
    SubmissionCreate,
    SubmissionEnvelope,
    UploadEnvelope,
)
from app.services import media, submission
from app.services.rate_limit import consume
from app.services.storage import build_storage


def no_query_parameters(request: Request):
    if request.query_params:
        raise invalid("query", "This endpoint does not accept query parameters.")


router = APIRouter(
    prefix="/api/v1/landlord-submissions", dependencies=[Depends(no_query_parameters)]
)
UploadToken = Annotated[str, Header(alias="X-Upload-Token", min_length=20, max_length=2048)]


def storage_for(request: Request):
    # Explicit test/development injection; never populated from a request field.
    return request.app.state.storage or build_storage(request.app.state.settings)


@router.post("", status_code=201, response_model=DraftEnvelope)
def create(
    data: SubmissionCreate,
    request: Request,
    db: Session = Depends(get_db),
    captcha: Annotated[str | None, Header(alias="X-Captcha-Token")] = None,
):
    settings = request.app.state.settings
    ip = client_ip(request)
    consume(db, settings, "landlord-submission-ip", ip or "unknown", 5, 86400)
    submission.check_captcha(settings, request.app.state.captcha_verifier, captcha, ip)
    return {"data": submission.create_draft(db, settings, data, ip)}


@router.post(
    "/{id}/files",
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
async def upload(
    id: UUID, request: Request, x_upload_token: UploadToken, db: Session = Depends(get_db)
):
    settings = request.app.state.settings
    media.check_upload_token(settings, id, x_upload_token)
    await run_in_threadpool(
        consume, db, settings, "landlord-upload-token", x_upload_token, 60, 3600
    )
    storage = storage_for(request)
    parser = ClosingMultiPartParser(
        request.headers, request.stream(), max_files=1, max_fields=2, max_part_size=2048
    )
    try:
        form = await parser.parse()
    except MultiPartException:
        raise AppError(400, "BAD_REQUEST", "Upload form is invalid.") from None
    try:
        names = [key for key, _ in form.multi_items()]
        if set(names) - {"file", "kind", "caption"} or len(names) != len(set(names)):
            raise invalid("file", "Use one file, a kind and an optional caption.")
        file = form.get("file")
        kind = form.get("kind")
        caption = form.get("caption")
        if (
            not isinstance(file, UploadFile)
            or not isinstance(kind, str)
            or (caption is not None and not isinstance(caption, str))
        ):
            raise invalid("file", "Choose a file and its kind.")
        row = await run_in_threadpool(
            media.add_file,
            db,
            settings,
            storage,
            id,
            file.file,
            kind,
            file.filename or "upload",
            file.content_type,
            upload_token=x_upload_token,
            caption=caption,
        )
    finally:
        await form.close()
    return {
        "data": {
            "file_id": row.id,
            "kind": row.kind,
            "size_bytes": row.size_bytes,
            "status": "uploaded",
        }
    }


@router.delete("/{id}/files/{file_id}", status_code=204)
def remove(
    id: UUID,
    file_id: UUID,
    request: Request,
    x_upload_token: UploadToken,
    db: Session = Depends(get_db),
):
    settings = request.app.state.settings
    media.check_upload_token(settings, id, x_upload_token)
    consume(db, settings, "landlord-upload-token", x_upload_token, 60, 3600)
    submission.remove_file(db, settings, storage_for(request), id, file_id, x_upload_token)
    return Response(status_code=204)


@router.post("/{id}/submit", response_model=SubmissionEnvelope)
def submit(id: UUID, request: Request, x_upload_token: UploadToken, db: Session = Depends(get_db)):
    settings = request.app.state.settings
    media.check_upload_token(settings, id, x_upload_token)
    consume(db, settings, "landlord-upload-token", x_upload_token, 60, 3600)
    return {"data": submission.submit(db, settings, id, x_upload_token, client_ip(request))}
