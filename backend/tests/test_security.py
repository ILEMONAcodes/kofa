from datetime import timedelta
from urllib.parse import parse_qs, urlsplit
from uuid import uuid4

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import select, text
from sqlalchemy.exc import DBAPIError

from app.cli import seed_admin
from app.core.security import now
from app.main import create_app
from app.models.identity import AuditLog, EmailOutbox, OneTimeToken, User
from tests.conftest import csrf, post, register


@pytest.mark.parametrize(
    "role,status", [(None, 401), ("client", 403), ("staff", 403), ("admin", 200)]
)
def test_admin_endpoint_role_matrix(client, db, role, status):
    if role == "client":
        assert register(client).status_code == 201
    elif role:
        seed_admin(db, "admin@example.com", "Goodadmin8!", "Example Admin")
        user = db.scalar(select(User))
        user.role = role
        db.commit()
        csrf(client)
        assert (
            post(
                client, "/auth/login", {"email": "admin@example.com", "password": "Goodadmin8!"}
            ).status_code
            == 200
        )
    assert client.get("/api/v1/admin/users").status_code == status
    csrf(client)
    response = post(
        client,
        "/admin/users",
        {
            "full_name": "New Staff",
            "email": "new@example.com",
            "role": "staff",
            "temporary_password": "NiceP8!x",
        },
    )
    assert response.status_code == (201 if role == "admin" else status)
    response = client.patch(
        f"/api/v1/admin/users/{uuid4()}",
        json={"version": 1, "is_active": False},
        headers={"Origin": "http://testserver", "X-CSRF-Token": client.cookies["csrf_token"]},
    )
    assert response.status_code == (404 if role == "admin" else status)


def test_db_activity_and_role_override_existing_access_token(client, db):
    seed_admin(db, "admin@example.com", "Goodadmin8!", "Example Admin")
    csrf(client)
    assert (
        post(
            client, "/auth/login", {"email": "admin@example.com", "password": "Goodadmin8!"}
        ).status_code
        == 200
    )
    user = db.scalar(select(User))
    user.role = "staff"
    db.commit()
    assert client.get("/api/v1/auth/me").json()["data"]["role"] == "staff"
    assert client.get("/api/v1/admin/users").status_code == 403
    user.is_active = False
    db.commit()
    assert client.get("/api/v1/auth/me").status_code == 401
    assert post(client, "/auth/refresh").status_code == 401


def test_expired_invalid_and_unsigned_access_tokens(client, settings):
    assert register(client).status_code == 201
    original = client.cookies["access_token"]
    claims = jwt.decode(
        original,
        settings.auth_secret.get_secret_value(),
        algorithms=["HS256"],
        audience="kofa-web",
        issuer="kofa",
    )
    claims["exp"] = int((now() - timedelta(seconds=1)).timestamp())
    expired = jwt.encode(claims, settings.auth_secret.get_secret_value(), algorithm="HS256")
    client.cookies.set("access_token", expired, domain="testserver.local", path="/")
    response = client.get("/api/v1/auth/me")
    assert response.status_code == 401 and response.json()["error"]["code"] == "TOKEN_EXPIRED"
    for value in [original + "tampered", jwt.encode(claims, "", algorithm="none")]:
        client.cookies.set("access_token", value, domain="testserver.local", path="/")
        assert client.get("/api/v1/auth/me").json()["error"]["code"] == "UNAUTHENTICATED"


def test_reset_expiry_and_common_passwords(client, db):
    assert register(client).status_code == 201
    assert (
        post(client, "/auth/password-reset/request", {"email": "client@example.com"}).status_code
        == 202
    )
    email = db.scalar(select(EmailOutbox).where(EmailOutbox.template == "reset"))
    token = parse_qs(urlsplit(email.payload["link"]).fragment)["token"][0]
    row = db.scalar(select(OneTimeToken).where(OneTimeToken.purpose == "reset"))
    row.expires_at = now() - timedelta(seconds=1)
    db.commit()
    assert (
        post(
            client, "/auth/password-reset/confirm", {"token": token, "new_password": "Changed8!"}
        ).status_code
        == 422
    )
    assert (
        post(
            client, "/auth/password-reset/confirm", {"token": token, "new_password": "password123"}
        ).status_code
        == 422
    )


def test_secure_cookie_flags_and_production_policy_guard(settings, engine):
    secure = settings.model_copy(
        update={
            "cookie_secure": True,
            "public_origin": "https://testserver",
            "app_env": "production",
        }
    )
    with TestClient(
        create_app(secure, engine), base_url="https://testserver", client=("127.0.0.1", 12345)
    ) as client:
        client.get("/api/v1/auth/csrf")
        headers = {"Origin": "https://testserver", "X-CSRF-Token": client.cookies["csrf_token"]}
        response = client.post(
            "/api/v1/auth/register",
            json={
                "full_name": "Example Client",
                "email": "x@example.com",
                "phone": "+2348012345678",
                "password": "NiceP8!x",
                "accepted_policies": [
                    {"type": "terms", "version": "draft-v1"},
                    {"type": "privacy", "version": "draft-v1"},
                ],
            },
            headers=headers,
        )
        assert response.status_code == 503
        assert all(c.secure for c in client.cookies.jar)


def test_audit_is_append_only_and_contains_no_secrets(client, db):
    assert register(client).status_code == 201
    logs = db.scalars(select(AuditLog)).all()
    assert "Goodpass8!" not in str([(log.before, log.after) for log in logs])
    with pytest.raises(DBAPIError):
        db.execute(text("UPDATE audit_log SET action='tampered'"))
        db.commit()
    db.rollback()
    assert db.scalar(select(AuditLog)).action == "auth.register"


def test_register_rate_limit_per_ip(client):
    for n in range(5):
        assert register(client, email=f"client{n}@example.com").status_code == 201
    assert register(client, email="sixth@example.com").status_code == 429


def test_concurrent_refresh_reuse_revokes_family(client, db, engine, settings):
    from concurrent.futures import ThreadPoolExecutor

    from app.core.database import session_factory
    from app.core.errors import AppError
    from app.services.auth import current_user, refresh

    assert register(client).status_code == 201
    token = client.cookies["refresh_token"]

    def attempt():
        with session_factory(engine)() as connection:
            try:
                result = refresh(connection, settings, token, "127.0.0.1", "test-agent")
                return (200, result[1])
            except AppError as error:
                return (error.status, None)

    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: attempt(), range(2)))
    assert sorted(status for status, _ in results) == [200, 401]
    access = next(token for status, token in results if status == 200)
    with pytest.raises(AppError):
        current_user(db, settings, access)


def test_forged_csrf_and_large_invalid_requests(client):
    csrf(client)
    client.cookies.set("csrf_token", "forged", domain="testserver.local", path="/")
    response = client.post(
        "/api/v1/auth/login",
        json={"email": "x@example.com", "password": "Goodpass8!"},
        headers={"Origin": "http://testserver", "X-CSRF-Token": "forged"},
    )
    assert response.status_code == 403
    csrf(client)
    response = post(client, "/auth/login", {"email": "x" * 20000, "password": "Goodpass8!"})
    assert response.status_code == 413 and "Goodpass8!" not in response.text


def test_chunked_auth_body_is_bounded_before_json_parsing(client):
    csrf(client)
    chunks = (b"x" * 4096 for _ in range(5))
    response = client.post(
        "/api/v1/auth/login",
        content=chunks,
        headers={
            "Origin": "http://testserver",
            "X-CSRF-Token": client.cookies["csrf_token"],
            "Content-Type": "application/json",
        },
    )
    assert response.status_code == 413
    assert response.json()["error"]["code"] == "PAYLOAD_TOO_LARGE"
    assert response.headers["X-Request-ID"]


def test_seed_admin_cli_uses_private_environment_idempotently(db, settings):
    import os
    import subprocess
    import sys

    from tests.conftest import TEST_URL

    env = {
        **os.environ,
        "DATABASE_URL": TEST_URL,
        "DATABASE_URL_UNPOOLED": TEST_URL,
        "AUTH_SECRET": settings.auth_secret.get_secret_value(),
        "SEED_ADMIN_EMAIL": "operator@example.com",
        "SEED_ADMIN_PASSWORD": "Operator8!",
        "SEED_ADMIN_NAME": "Example Operator",
    }
    first = subprocess.run(
        [sys.executable, "-m", "app.cli", "seed-admin"],
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    second = subprocess.run(
        [sys.executable, "-m", "app.cli", "seed-admin"],
        env=env,
        capture_output=True,
        text=True,
        check=True,
    )
    assert "Administrator created." in first.stdout
    assert "already exists" in second.stdout
    assert "Operator8!" not in first.stdout + first.stderr + second.stdout + second.stderr
    assert db.scalar(select(User).where(User.email == "operator@example.com")).role == "admin"


def test_client_phone_cannot_be_cleared_by_administrator(client, db):
    created = register(client).json()["data"]
    seed_admin(db, "admin@example.com", "Goodadmin8!", "Example Admin")
    assert (
        post(
            client, "/auth/login", {"email": "admin@example.com", "password": "Goodadmin8!"}
        ).status_code
        == 200
    )
    response = client.patch(
        f"/api/v1/admin/users/{created['id']}",
        json={"phone": None, "version": 1},
        headers={"Origin": "http://testserver", "X-CSRF-Token": client.cookies["csrf_token"]},
    )
    assert response.status_code == 422
    assert response.json()["error"]["details"][0]["field"] == "phone"


def test_outbox_requires_explicit_smtp_and_discards_delivered_link(client, db, settings):
    from unittest.mock import patch

    from app.services.email import send_outbox

    assert register(client).status_code == 201
    with patch("app.services.email.smtplib.SMTP") as transport:
        with pytest.raises(ValueError):
            send_outbox(db, settings)
        transport.assert_not_called()
        enabled = settings.model_copy(
            update={
                "email_mode": "smtp",
                "smtp_host": "smtp.example.com",
                "smtp_from": "kofa@example.com",
            }
        )
        assert send_outbox(db, enabled) == 1
        transport.return_value.__enter__.return_value.send_message.assert_called_once()
    message = db.scalar(select(EmailOutbox))
    assert message.status == "sent" and message.payload == {} and message.attempts == 1
