import logging
import uuid
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
from starlette.exceptions import HTTPException

from app.api.v1 import admin_users, auth
from app.core.body_limit import AuthBodyLimit
from app.core.config import Settings, get_settings
from app.core.database import make_engine, session_factory
from app.core.errors import AppError
from app.core.security import check_csrf

logger = logging.getLogger("kofa")


def create_app(settings: Settings | None = None, engine=None):
    settings = settings or get_settings()
    engine = engine or make_engine(settings.database_url.get_secret_value())

    @asynccontextmanager
    async def lifespan(app):
        yield
        engine.dispose()

    app = FastAPI(
        title="Kof'a API",
        version="0.1.0",
        lifespan=lifespan,
        docs_url=None if settings.app_env == "production" else "/docs",
    )
    app.state.settings = settings
    app.state.engine = engine
    app.state.session_factory = session_factory(engine)

    def error_response(request, status, code, message, details=None, headers=None):
        return JSONResponse(
            status_code=status,
            headers=headers,
            content={
                "error": {
                    "code": code,
                    "message": message,
                    "details": details or [],
                    "request_id": getattr(request.state, "request_id", str(uuid.uuid4())),
                }
            },
        )

    @app.middleware("http")
    async def boundary(request: Request, call_next):
        request.state.request_id = str(uuid.uuid4())
        try:
            if request.method not in {"GET", "HEAD", "OPTIONS"}:
                check_csrf(request, settings)
                if request.url.path.startswith(("/api/v1/auth/", "/api/v1/admin/users")):
                    await request.body()  # Bounded by AuthBodyLimit before buffering.
            response = await call_next(request)
        except AppError as error:
            response = error_response(
                request, error.status, error.code, error.message, error.details, error.headers
            )
        except SQLAlchemyError:
            response = error_response(
                request,
                503,
                "SERVICE_UNAVAILABLE",
                "Account services are unavailable. Try again later.",
            )
        except Exception:
            # Never log request bodies, email addresses, DB URLs, passwords or tokens.
            logger.error("request_failed request_id=%s", request.state.request_id)
            response = error_response(
                request, 500, "INTERNAL_ERROR", "Something went wrong. Please try again."
            )
        response.headers["X-Request-ID"] = request.state.request_id
        if request.url.path.startswith(("/api/v1/auth", "/api/v1/admin")):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(AppError)
    async def application_error(request, error):
        return error_response(
            request, error.status, error.code, error.message, error.details, error.headers
        )

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        details = []
        for entry in error.errors():
            field = ".".join(str(x) for x in entry["loc"] if x not in {"body", "query", "path"})
            # Pydantic inputs/context can contain passwords; return only safe metadata.
            details.append(
                {
                    "field": field,
                    "code": "required" if entry["type"] == "missing" else "invalid_format",
                    "message": "This field is required."
                    if entry["type"] == "missing"
                    else "Enter a valid value.",
                }
            )
        return error_response(
            request, 422, "VALIDATION_ERROR", "One or more fields are invalid.", details
        )

    @app.exception_handler(HTTPException)
    async def http_error(request, error):
        codes = {404: "NOT_FOUND", 405: "BAD_REQUEST"}
        return error_response(
            request,
            error.status_code,
            codes.get(error.status_code, "BAD_REQUEST"),
            "Page not found." if error.status_code == 404 else "Request is not supported.",
        )

    # Outer ASGI receive wrapper bounds the body read by the error/CSRF boundary.
    app.add_middleware(AuthBodyLimit)
    app.include_router(auth.router)
    app.include_router(admin_users.router)
    return app
