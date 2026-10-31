"""Bound auth JSON while receiving it, before buffering or parsing."""

from starlette.types import ASGIApp, Receive, Scope, Send

from app.core.errors import AppError


class AuthBodyLimit:
    def __init__(self, app: ASGIApp):
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        path = scope.get("path", "")
        if scope["type"] != "http" or not path.startswith(("/api/v1/auth/", "/api/v1/admin/users")):
            return await self.app(scope, receive, send)
        size = 0

        async def bounded_receive():
            nonlocal size
            message = await receive()
            if message["type"] == "http.request":
                size += len(message.get("body", b""))
                if size > 16384:
                    raise AppError(413, "PAYLOAD_TOO_LARGE", "Request is too large.")
            return message

        return await self.app(scope, bounded_receive, send)
