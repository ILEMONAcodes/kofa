"""Thin assistant endpoints; anonymous tokens scope only their own conversation."""

from uuid import UUID

from fastapi import APIRouter, Depends, Header, Query, Request, Response

from app.core.database import get_db
from app.core.errors import AppError, invalid
from app.core.permissions import authenticated, require_roles
from app.schemas import assistant as s
from app.services.assistant import workflow as service
from app.services.auth import current_user
from app.services.rate_limit import consume


def strict(request: Request):
    path = request.scope["route"].path
    allowed = (
        {"page", "page_size", "flagged", "handoff_reason", "from", "to"}
        if path == "/api/v1/admin/assistant/conversations"
        else set()
    )
    keys = [key for key, _ in request.query_params.multi_items()]
    if set(keys) - allowed or len(keys) != len(set(keys)):
        raise invalid("query", "Unknown or repeated query parameter.")


def actor(request: Request, db=Depends(get_db)):
    value = request.cookies.get("access_token")
    return current_user(db, request.app.state.settings, value) if value else None


COOKIE = "kofa_assistant"
COOKIE_PATH = "/api/v1/assistant"


def capability(request, token):
    if token is not None:
        return token
    value = request.cookies.get(COOKIE, "")
    return value.partition(":")[2] or None


def ip(request):
    return request.client.host if request.client else "unknown"


router = APIRouter(prefix="/api/v1/assistant", dependencies=[Depends(strict)])
staff_router = APIRouter(
    prefix="/api/v1/admin/assistant",
    dependencies=[Depends(strict), Depends(require_roles("staff", "admin"))],
)


@router.post("/conversations", response_model=s.StartEnvelope, status_code=201)
def start(request: Request, response: Response, user=Depends(actor), db=Depends(get_db)):
    value = service.start(db, request.app.state.settings, user, ip(request))
    response.set_cookie(
        COOKIE,
        f"{value.id}:{value.token or ''}",
        max_age=86400,
        path=COOKIE_PATH,
        secure=request.app.state.settings.cookie_secure,
        httponly=True,
        samesite="lax",
    )
    return {"data": value}


@router.get("/current", response_model=s.HistoryEnvelope)
def current(request: Request, user=Depends(actor), db=Depends(get_db)):
    value = request.cookies.get(COOKIE, "")
    try:
        id = UUID(value.partition(":")[0])
    except ValueError:
        raise AppError(404, "NOT_FOUND", "No current conversation.") from None
    consume(
        db,
        request.app.state.settings,
        "assistant.history",
        str(user.id) if user else service.identity(request.app.state.settings, ip(request)),
        120,
        60,
    )
    return {
        "data": service.history(db, request.app.state.settings, id, user, capability(request, None))
    }


@router.delete("/session", response_model=s.FeedbackEnvelope)
def clear(response: Response):
    response.delete_cookie(COOKIE, path=COOKIE_PATH, httponly=True, samesite="lax")
    return {"data": s.FeedbackReceipt()}


@router.get("/conversations/{id}", response_model=s.HistoryEnvelope)
def history(
    id: UUID,
    request: Request,
    token: str | None = Header(None, alias="X-Assistant-Token", max_length=100),
    user=Depends(actor),
    db=Depends(get_db),
):
    consume(
        db,
        request.app.state.settings,
        "assistant.history",
        str(user.id) if user else service.identity(request.app.state.settings, ip(request)),
        120,
        60,
    )
    return {
        "data": service.history(
            db, request.app.state.settings, id, user, capability(request, token)
        )
    }


@router.post("/conversations/{id}/messages", response_model=s.TurnEnvelope)
def message(
    id: UUID,
    data: s.MessageInput,
    request: Request,
    token: str | None = Header(None, alias="X-Assistant-Token", max_length=100),
    user=Depends(actor),
    db=Depends(get_db),
):
    return {
        "data": service.turn(
            db,
            request.app.state.settings,
            id,
            user,
            capability(request, token),
            ip(request),
            data.content,
        )
    }


@router.post(
    "/conversations/{id}/handoff/message-team", response_model=s.HandoffEnvelope, status_code=201
)
def team(
    id: UUID,
    data: s.HandoffInput,
    request: Request,
    token: str | None = Header(None, alias="X-Assistant-Token", max_length=100),
    user=Depends(authenticated),
    db=Depends(get_db),
):
    return {
        "data": service.to_team(
            db, request.app.state.settings, id, user, capability(request, token), data.summary
        )
    }


@router.post("/messages/{id}/feedback", response_model=s.FeedbackEnvelope)
def feedback(
    id: UUID,
    data: s.FeedbackInput,
    request: Request,
    token: str | None = Header(None, alias="X-Assistant-Token", max_length=100),
    user=Depends(actor),
    db=Depends(get_db),
):
    consume(
        db,
        request.app.state.settings,
        "assistant.feedback",
        str(user.id) if user else service.identity(request.app.state.settings, ip(request)),
        60,
        3600,
    )
    return {
        "data": service.feedback(
            db, request.app.state.settings, id, user, capability(request, token), data
        )
    }


@staff_router.get("/usage", response_model=s.UsageEnvelope)
def usage(request: Request, user=Depends(require_roles("admin")), db=Depends(get_db)):
    return {"data": service.usage(db, request.app.state.settings, user)}


@staff_router.get("/conversations", response_model=s.ReviewPage)
def review_list(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    flagged: bool | None = None,
    handoff_reason: s.Reason | None = None,
    from_date: str | None = Query(None, alias="from"),
    to_date: str | None = Query(None, alias="to"),
    user=Depends(require_roles("staff", "admin")),
    db=Depends(get_db),
):
    return service.reviews(db, user, page, page_size, flagged, handoff_reason, from_date, to_date)


@staff_router.get("/conversations/{id}", response_model=s.ReviewEnvelope)
def review_detail(id: UUID, user=Depends(require_roles("staff", "admin")), db=Depends(get_db)):
    return {"data": service.review(db, user, id)}


@staff_router.patch("/conversations/{id}", response_model=s.ReviewEnvelope)
def review_edit(
    id: UUID,
    data: s.ReviewInput,
    request: Request,
    user=Depends(require_roles("staff", "admin")),
    db=Depends(get_db),
):
    consume(db, request.app.state.settings, "assistant.review", str(user.id), 120, 3600)
    return {"data": service.review(db, user, id, data)}
