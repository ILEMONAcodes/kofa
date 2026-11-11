"""Bound sensitive JSON and multipart bodies while receiving, before parsing."""

from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.errors import AppError


class AuthBodyLimit:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        path = scope.get("path", "")
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        if path.startswith("/api/v1/admin/knowledge-articles"):
            limit = 262144
        elif path == "/api/v1/admin/settings":
            limit = 16384
        elif path.startswith(("/api/v1/reports", "/api/v1/complaints", "/api/v1/admin/complaints")):
            limit = 5 * 1024 * 1024 + 65536 if path.endswith("/files") else 65536
        elif path.startswith(("/api/v1/auth/", "/api/v1/admin/users")):
            limit = 16384
        elif path.startswith(
            (
                "/api/v1/inquiries",
                "/api/v1/admin/inquiries",
                "/api/v1/admin/clients",
                "/api/v1/appointments",
                "/api/v1/admin/appointments",
            )
        ):
            limit = 65536
        elif path.startswith("/api/v1/admin/properties"):
            limit = 100 * 1024 * 1024 + 65536 if path.endswith("/media") else 65536
        elif path.startswith("/api/v1/landlord-submissions"):
            limit = 100 * 1024 * 1024 + 65536 if path.endswith("/files") else 65536
        else:
            return await self.app(scope, receive, send)
        size = 0

        async def bounded_receive():
            nonlocal size
            message = await receive()
            if message["type"] == "http.request":
                size += len(message.get("body", b""))
                if size > limit:
                    scope.setdefault("state", {})["body_limit_exceeded"] = True
                    raise AppError(413, "PAYLOAD_TOO_LARGE", "Request is too large.")
            return message

        return await self.app(scope, bounded_receive, send)
