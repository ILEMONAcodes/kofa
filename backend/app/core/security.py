import hashlib
import hmac
import secrets
import time
from datetime import UTC, datetime, timedelta
from uuid import UUID

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from fastapi import Request, Response

from app.core.config import Settings
from app.core.errors import AppError

ACCESS_SECONDS = 15 * 60
REFRESH_SECONDS = 14 * 24 * 60 * 60
REFRESH_PATH = "/api/v1/auth"
hasher = PasswordHasher()  # Argon2id, library's maintained defaults.
DUMMY_HASH = hasher.hash(secrets.token_urlsafe(32))


def now() -> datetime:
    return datetime.now(UTC)


def digest(token: str) -> str:
    return hashlib.sha256(token.encode()).hexdigest()


def verify_password(password: str, encoded: str) -> bool:
    try:
        return hasher.verify(encoded, password)
    except (VerificationError, InvalidHashError):
        return False


def csrf_token(settings: Settings) -> str:
    nonce = f"{int(time.time())}.{secrets.token_urlsafe(32)}"
    signature = hmac.new(
        settings.auth_secret.get_secret_value().encode(), nonce.encode(), hashlib.sha256
    ).hexdigest()
    return f"{nonce}.{signature}"


def check_csrf(request: Request, settings: Settings):
    origin = request.headers.get("origin")
    token = request.cookies.get("csrf_token", "")
    header = request.headers.get("x-csrf-token", "")
    valid = False
    if len(token) < 256 and token and hmac.compare_digest(token, header):
        try:
            stamp, nonce, signature = token.split(".")
            expected = hmac.new(
                settings.auth_secret.get_secret_value().encode(),
                f"{stamp}.{nonce}".encode(),
                hashlib.sha256,
            ).hexdigest()
            age = int(time.time()) - int(stamp)
            valid = 0 <= age <= REFRESH_SECONDS and hmac.compare_digest(expected, signature)
        except (ValueError, TypeError):
            pass
    if origin != settings.public_origin or not valid:
        raise AppError(
            403, "CSRF_FAILED", "Your session could not be verified. Reload and try again."
        )


def access_token(settings: Settings, user_id: UUID, session_id: UUID, family_id: UUID) -> str:
    return jwt.encode(
        {
            "sub": str(user_id),
            "sid": str(session_id),
            "fid": str(family_id),
            "iat": now(),
            "exp": now() + timedelta(seconds=ACCESS_SECONDS),
            "iss": "kofa",
            "aud": "kofa-web",
            "type": "access",
        },
        settings.auth_secret.get_secret_value(),
        algorithm="HS256",
    )


def decode_access(settings: Settings, token: str, *, allow_expired=False):
    try:
        value = jwt.decode(
            token,
            settings.auth_secret.get_secret_value(),
            algorithms=["HS256"],
            issuer="kofa",
            audience="kofa-web",
            options={
                "require": ["exp", "iat", "sub", "sid", "fid", "type"],
                "verify_exp": not allow_expired,
            },
        )
        if value["type"] != "access":
            raise ValueError
        return {key: UUID(value[key]) for key in ["sub", "sid", "fid"]}
    except jwt.ExpiredSignatureError:
        raise AppError(401, "TOKEN_EXPIRED", "Your session has expired.") from None
    except (jwt.InvalidTokenError, ValueError, TypeError, KeyError):
        raise AppError(401, "UNAUTHENTICATED", "Please sign in to continue.") from None


def set_auth_cookies(response: Response, settings: Settings, access: str, refresh: str):
    response.set_cookie(
        "access_token",
        access,
        httponly=True,
        max_age=ACCESS_SECONDS,
        path="/",
        secure=settings.cookie_secure,
        samesite="lax",
    )
    response.set_cookie(
        "refresh_token",
        refresh,
        httponly=True,
        max_age=REFRESH_SECONDS,
        path=REFRESH_PATH,
        secure=settings.cookie_secure,
        samesite="lax",
    )
    response.set_cookie(
        "csrf_token",
        csrf_token(settings),
        httponly=False,
        max_age=REFRESH_SECONDS,
        path="/",
        secure=settings.cookie_secure,
        samesite="lax",
    )


def clear_auth_cookies(response: Response, settings: Settings):
    for name, path in [("access_token", "/"), ("refresh_token", REFRESH_PATH), ("csrf_token", "/")]:
        response.delete_cookie(
            name,
            path=path,
            secure=settings.cookie_secure,
            httponly=name != "csrf_token",
            samesite="lax",
        )
