"""Anonymous public search, detail, taxonomy and visibility-gated media."""

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import FileResponse, RedirectResponse

from app.core.database import get_db
from app.core.errors import AppError, invalid
from app.repositories import property_public as repo
from app.schemas import property_public as schema
from app.services import property_public as service
from app.services.storage import LocalStorage, build_storage


def strict_queries(request: Request):
    path = request.scope["route"].path
    allowed = (
        set(schema.SearchQueryPublic.model_fields)
        if path == "/api/v1/properties"
        else ({"thumbnail"} if path.endswith("/{media_id}") else set())
    )
    names = [k for k, _ in request.query_params.multi_items()]
    if set(names) - allowed or len(names) != len(set(names)):
        raise invalid("query", "Unknown or repeated query parameter.", "invalid_choice")


router = APIRouter(prefix="/api/v1", dependencies=[Depends(strict_queries)])


def multiple(value, allowed, name):
    if value is None or not value.strip():
        return None
    parts = value.split(",")
    if len(parts) != len(set(parts)) or any(p not in allowed for p in parts):
        raise invalid(name, "Choose supported, unique options.", "invalid_choice")
    return parts


def sorts(value):
    result: list[tuple[str, bool]] = []
    for item in value.split(","):
        name = item.removeprefix("-")
        if name not in {"price", "published_at", "verified_at"} or name in [n for n, _ in result]:
            raise invalid("sort", "Choose supported, unique sort fields.", "invalid_choice")
        result.append((name, item.startswith("-")))
    return result


@router.get("/taxonomy", response_model=schema.TaxonomyEnvelopePublic)
def taxonomy(db=Depends(get_db)):
    return service.taxonomy(db)


@router.get("/properties", response_model=schema.PropertyPagePublic)
def search(
    request: Request, params: Annotated[schema.SearchQueryPublic, Query()], db=Depends(get_db)
):
    areas, amenity_rows = repo.taxonomy(db)
    filters = params.model_dump(exclude={"sort", "page", "page_size"})
    if params.listing_type not in {None, "rent", "sale"}:
        raise invalid("listing_type", "Choose rent or sale.", "invalid_choice")
    options = dict(
        property_type={"apartment", "house", "duplex", "bungalow", "terrace", "studio", "room"},
        area={a.slug for a in areas},
        furnishing={"furnished", "semi_furnished", "unfurnished"},
        amenities={a.code for a in amenity_rows},
        availability={"available", "under_offer", "unavailable"},
    )
    for name, allowed in options.items():
        filters[name] = multiple(filters[name], allowed, name)
    for name in ("q", "state", "city"):
        if filters[name]:
            filters[name] = filters[name].strip() or None
    return service.search(
        db,
        request.app.state.settings.public_origin,
        filters,
        sorts(params.sort),
        params.page,
        params.page_size,
    )


@router.get("/properties/{slug}", response_model=schema.DetailEnvelopePublic)
def detail(slug: str, request: Request, db=Depends(get_db)):
    return service.detail(db, request.app.state.settings.public_origin, slug)


@router.get("/property-media/{media_id}")
def media_file(media_id: UUID, request: Request, thumbnail: bool = False, db=Depends(get_db)):
    item = repo.media_file(db, media_id)
    if item is None or item.kind not in {"photo", "video"} or (thumbnail and not item.thumb_key):
        raise AppError(404, "NOT_FOUND", "File not found.")
    store = request.app.state.storage or build_storage(request.app.state.settings)
    key = item.thumb_key if thumbnail else item.storage_key
    headers = {"Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff"}
    if isinstance(store, LocalStorage):
        path = store.path(key)
        if not path.is_file():
            raise AppError(404, "NOT_FOUND", "File not found.")
        return FileResponse(
            path, media_type="image/jpeg" if thumbnail else item.mime_type, headers=headers
        )
    grant = store.signed_read(key, ttl=60)
    if not grant.url:
        raise AppError(503, "SERVICE_UNAVAILABLE", "File storage is unavailable.")
    return RedirectResponse(grant.url, status_code=307, headers=headers)
