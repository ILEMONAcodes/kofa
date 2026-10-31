import ipaddress

from fastapi import APIRouter, Depends, Request, Response
from sqlalchemy import text
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import AppError
from app.core.permissions import authenticated
from app.core.security import REFRESH_SECONDS, clear_auth_cookies, csrf_token, set_auth_cookies
from app.schemas.auth import EmailInput, Login, Register, ResetConfirm, TokenInput, user_out
from app.services import auth
from app.services.rate_limit import consume

router = APIRouter(prefix="/api/v1")


def client_ip(request):
    try:
        return str(ipaddress.ip_address(request.client.host)) if request.client else None
    except ValueError:
        return None


def identity_response(request, response, result):
    user, access, refresh = result
    set_auth_cookies(response, request.app.state.settings, access, refresh)
    response.headers["Cache-Control"] = "no-store"
    return {"data": user_out(user)}


@router.get("/health")
def health(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
    except Exception:
        raise AppError(503, "INTERNAL_ERROR", "Database is unavailable.") from None
    return {"data": {"status": "ok", "version": "0.1.0", "database": "ok"}}


@router.get("/auth/csrf")
def csrf(request: Request, response: Response):
    settings = request.app.state.settings
    token = csrf_token(settings)
    response.set_cookie(
        "csrf_token",
        token,
        httponly=False,
        secure=settings.cookie_secure,
        samesite="lax",
        path="/",
        max_age=REFRESH_SECONDS,
    )
    response.headers["Cache-Control"] = "no-store"
    return {"data": {"csrf_token": token}}


@router.get("/policies/current")
def policies(request: Request):
    settings = request.app.state.settings
    return {
        "data": {
            "approved": settings.policies_approved,
            "policies": [
                {"type": "terms", "version": settings.terms_version, "url": "/resources/terms"},
                {
                    "type": "privacy",
                    "version": settings.privacy_version,
                    "url": "/resources/privacy",
                },
            ],
        }
    }


@router.post("/auth/register", status_code=201)
def register(data: Register, request: Request, response: Response, db: Session = Depends(get_db)):
    settings = request.app.state.settings
    ip = client_ip(request)
    consume(db, settings, "register-ip", ip or "unknown", 5, 3600)
    return identity_response(
        request, response, auth.register(db, settings, data, ip, request.headers.get("user-agent"))
    )


@router.post("/auth/login")
def login(data: Login, request: Request, response: Response, db: Session = Depends(get_db)):
    settings = request.app.state.settings
    ip = client_ip(request)
    consume(db, settings, "login-ip", ip or "unknown", 10, 900)
    consume(db, settings, "login-email", str(data.email).lower(), 5, 900)
    return identity_response(
        request, response, auth.login(db, settings, data, ip, request.headers.get("user-agent"))
    )


@router.get("/auth/me")
def me(response: Response, user=Depends(authenticated)):
    response.headers["Cache-Control"] = "no-store"
    return {"data": user_out(user)}


@router.post("/auth/refresh")
def refresh(request: Request, response: Response, db: Session = Depends(get_db)):
    return identity_response(
        request,
        response,
        auth.refresh(
            db,
            request.app.state.settings,
            request.cookies.get("refresh_token"),
            client_ip(request),
            request.headers.get("user-agent"),
        ),
    )


@router.post("/auth/logout", status_code=204)
def logout(request: Request, db: Session = Depends(get_db)):
    auth.logout(
        db,
        request.app.state.settings,
        request.cookies.get("refresh_token"),
        request.cookies.get("access_token"),
        client_ip(request),
    )
    response = Response(status_code=204)
    clear_auth_cookies(response, request.app.state.settings)
    return response


@router.post("/auth/password-reset/request", status_code=202)
def request_reset(data: EmailInput, request: Request, db: Session = Depends(get_db)):
    settings = request.app.state.settings
    consume(db, settings, "reset-ip", client_ip(request) or "unknown", 5, 3600)
    consume(db, settings, "reset-email", str(data.email).lower(), 5, 3600)
    auth.request_reset(db, settings, data.email)
    return {"data": {"accepted": True}}


@router.post("/auth/password-reset/confirm", status_code=204)
def confirm_reset(data: ResetConfirm, request: Request, db: Session = Depends(get_db)):
    auth.consume_token(
        db,
        request.app.state.settings,
        data.token,
        {"reset", "invitation"},
        password=data.new_password,
        ip=client_ip(request),
    )
    response = Response(status_code=204)
    clear_auth_cookies(response, request.app.state.settings)
    return response


@router.post("/auth/email-verification/request", status_code=202)
def request_verification(
    request: Request, user=Depends(authenticated), db: Session = Depends(get_db)
):
    consume(db, request.app.state.settings, "verify-user", str(user.id), 5, 3600)
    auth.request_verification(db, request.app.state.settings, user)
    return {"data": {"accepted": True}}


@router.post("/auth/email-verification/confirm", status_code=204)
def confirm_verification(data: TokenInput, request: Request, db: Session = Depends(get_db)):
    auth.consume_token(
        db, request.app.state.settings, data.token, {"verification"}, ip=client_ip(request)
    )
    return Response(status_code=204)
