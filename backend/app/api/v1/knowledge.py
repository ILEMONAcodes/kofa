"""Bounded, default-deny editorial routes and published-only public reads."""

from typing import Literal
from uuid import UUID

from fastapi import APIRouter, Depends, Query, Request

from app.core.database import get_db
from app.core.errors import invalid
from app.core.permissions import require_roles
from app.schemas import knowledge as s
from app.services import knowledge as service
from app.services.rate_limit import consume

STAFF = require_roles("staff", "admin")


def strict(request: Request):
    path = request.scope["route"].path
    allowed = (
        {"page", "page_size", "q", "category"}
        if path.endswith("/knowledge-articles") and request.method == "GET"
        else set()
    )
    if path.startswith("/api/v1/admin/") and allowed:
        allowed.add("status")
    keys = [key for key, _ in request.query_params.multi_items()]
    if set(keys) - allowed or len(keys) != len(set(keys)):
        raise invalid("query", "Unknown or repeated query parameter.")


public_router = APIRouter(prefix="/api/v1", dependencies=[Depends(strict)])
staff_router = APIRouter(prefix="/api/v1/admin", dependencies=[Depends(STAFF), Depends(strict)])


def budget(db, request, actor=None):
    consume(
        db,
        request.app.state.settings,
        "knowledge.write" if actor else "knowledge.read",
        str(actor.id) if actor else request.client.host if request.client else "unknown",
        120,
        3600 if actor else 60,
    )


@public_router.get("/public-config", response_model=s.PublicConfigEnvelope)
def config(db=Depends(get_db)):
    return {"data": service.public_config(db)}


@public_router.get("/knowledge-articles", response_model=s.PublicArticlePage)
def public_list(
    request: Request,
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=150),
    category: s.Category | None = None,
    db=Depends(get_db),
):
    budget(db, request)
    return service.article_list(db, page, page_size, public=True, q=q, category=category)


@public_router.get("/knowledge-articles/{slug}", response_model=s.PublicArticleEnvelope)
def public_detail(slug: str, request: Request, db=Depends(get_db)):
    budget(db, request)
    return {"data": service.public_article(db, slug)}


@staff_router.get("/settings", response_model=s.SupportSettingsEnvelope)
def settings(actor=Depends(STAFF), db=Depends(get_db)):
    return {"data": service.get_settings(db, actor.id)}


@staff_router.put("/settings", response_model=s.SupportSettingsEnvelope)
def update_settings(
    data: s.SupportSettingsInput, request: Request, actor=Depends(STAFF), db=Depends(get_db)
):
    budget(db, request, actor)
    return {"data": service.set_settings(db, actor.id, data)}


@staff_router.get("/knowledge-articles", response_model=s.StaffArticlePage)
def staff_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    q: str | None = Query(None, max_length=150),
    category: s.Category | None = None,
    status: Literal["draft", "published"] | None = None,
    actor=Depends(STAFF),
    db=Depends(get_db),
):
    return service.article_list(
        db, page, page_size, actor_id=actor.id, q=q, category=category, status=status
    )


@staff_router.post("/knowledge-articles", response_model=s.StaffArticleEnvelope, status_code=201)
def create(data: s.ArticleCreate, request: Request, actor=Depends(STAFF), db=Depends(get_db)):
    budget(db, request, actor)
    return {"data": service.create(db, actor.id, data)}


@staff_router.get("/knowledge-articles/{id}", response_model=s.StaffArticleEnvelope)
def detail(id: UUID, actor=Depends(STAFF), db=Depends(get_db)):
    return {"data": service.staff_article(db, actor.id, id)}


@staff_router.patch("/knowledge-articles/{id}", response_model=s.StaffArticleEnvelope)
def edit(id: UUID, data: s.ArticleEdit, request: Request, actor=Depends(STAFF), db=Depends(get_db)):
    budget(db, request, actor)
    return {"data": service.change(db, actor.id, id, data)}


@staff_router.post("/knowledge-articles/{id}/publish", response_model=s.StaffArticleEnvelope)
def publish(
    id: UUID, data: s.ArticleVersion, request: Request, actor=Depends(STAFF), db=Depends(get_db)
):
    budget(db, request, actor)
    return {"data": service.change(db, actor.id, id, data, "publish")}


@staff_router.post("/knowledge-articles/{id}/unpublish", response_model=s.StaffArticleEnvelope)
def unpublish(
    id: UUID, data: s.ArticleVersion, request: Request, actor=Depends(STAFF), db=Depends(get_db)
):
    budget(db, request, actor)
    return {"data": service.change(db, actor.id, id, data, "unpublish")}
