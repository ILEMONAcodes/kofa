from urllib.parse import parse_qs, urlsplit

import pytest
from sqlalchemy import func, select

from app.cli import seed_admin
from app.core.security import digest
from app.models.identity import (
    AuditLog,
    AuthSession,
    EmailOutbox,
    OneTimeToken,
    PolicyAcceptance,
    User,
)
from tests.conftest import csrf, post, register


def test_register_login_me_rotate_logout(client, db):
    response = register(client)
    assert response.status_code == 201, response.text
    assert response.json()["data"]["role"] == "client"
    assert response.json()["data"]["created_at"].endswith("Z")
    assert "password" not in response.text
    assert client.get("/api/v1/auth/me").status_code == 200
    user = db.scalar(select(User))
    assert user.password_hash.startswith("$argon2id$") and "Goodpass8!" not in user.password_hash
    assert db.scalar(select(func.count()).select_from(PolicyAcceptance)) == 2
    old_refresh = client.cookies["refresh_token"]
    response = post(client, "/auth/refresh")
    assert response.status_code == 200
    assert old_refresh != client.cookies["refresh_token"]
    assert db.scalar(
        select(AuthSession).where(AuthSession.token_hash == digest(old_refresh))
    ).revoked_at
    stolen_access = client.cookies["access_token"]
    assert post(client, "/auth/logout").status_code == 204
    assert client.get("/api/v1/auth/me").status_code == 401
    client.cookies.set("access_token", stolen_access)
    assert client.get("/api/v1/auth/me").status_code == 401
    assert (
        post(
            client, "/auth/login", {"email": "CLIENT@example.com", "password": "Goodpass8!"}
        ).status_code
        == 403
    )  # logout cleared CSRF
    csrf(client)
    assert (
        post(
            client, "/auth/login", {"email": "CLIENT@example.com", "password": "Goodpass8!"}
        ).status_code
        == 200
    )


@pytest.mark.parametrize(
    "password,accepted",
    [
        ("Abcdef7", False),
        ("NiceP8!x", True),
        ("password123", False),
        ("password", False),
        ("12345678", False),
        ("x" * 129, False),
    ],
)
def test_password_minimum_eight(client, password, accepted):
    response = register(client, password=password)
    assert response.status_code == (201 if accepted else 422)
    if response.status_code == 422:
        error = response.json()["error"]
        assert password not in error["message"]
        assert all(
            password not in detail["message"] and set(detail) == {"field", "code", "message"}
            for detail in error["details"]
        )
    else:
        assert "password" not in response.json()["data"]


def test_csrf_request_id_errors_and_roles(client):
    assert (
        client.post(
            "/api/v1/auth/login", json={"email": "x@example.com", "password": "Goodpass8!"}
        ).status_code
        == 403
    )
    headers = csrf(client)
    headers["Origin"] = "https://evil.example"
    assert client.post("/api/v1/auth/login", json={}, headers=headers).status_code == 403
    response = client.get("/missing")
    assert response.status_code == 404
    assert response.json()["error"]["request_id"] == response.headers["X-Request-ID"]
    assert response.json()["error"]["details"] == []
    assert client.get("/api/v1/admin/users").status_code == 401
    assert register(client).status_code == 201
    assert client.get("/api/v1/admin/users").status_code == 403
    response = post(client, "/auth/register", {"role": "admin"})
    assert response.status_code == 422


def test_duplicate_and_stale_policy(client):
    assert register(client).status_code == 201
    assert register(client, email="CLIENT@example.com").status_code == 409
    csrf(client)
    response = post(
        client,
        "/auth/register",
        {
            "full_name": "Example Client",
            "email": "other@example.com",
            "phone": "+2348012345678",
            "password": "Goodpass8!",
            "accepted_policies": [
                {"type": "terms", "version": "old"},
                {"type": "privacy", "version": "draft-v1"},
            ],
        },
    )
    assert response.status_code == 422


def test_refresh_reuse_revokes_entire_family(client):
    assert register(client).status_code == 201
    old = client.cookies["refresh_token"]
    assert post(client, "/auth/refresh").status_code == 200
    fresh = client.cookies["refresh_token"]
    # Replace exact host/path cookie rather than adding a second cookie.
    client.cookies.set("refresh_token", old, domain="testserver.local", path="/api/v1/auth")
    assert post(client, "/auth/refresh").status_code == 401
    client.cookies.set("refresh_token", fresh, domain="testserver.local", path="/api/v1/auth")
    assert post(client, "/auth/refresh").status_code == 401
    assert client.get("/api/v1/auth/me").status_code == 401


def test_admin_can_create_staff_and_revoke_access(client, db):
    assert seed_admin(db, "admin@example.com", "Goodadmin8!", "Example Admin")
    assert not seed_admin(db, "admin@example.com", "Ignorednew8!", "Other Name")
    csrf(client)
    admin = post(
        client, "/auth/login", {"email": "admin@example.com", "password": "Goodadmin8!"}
    ).json()["data"]
    response = post(
        client,
        "/admin/users",
        {
            "full_name": "Example Staff",
            "email": "staff@example.com",
            "role": "staff",
            "temporary_password": "Goodstaff8!",
        },
    )
    assert response.status_code == 201, response.text
    staff = response.json()["data"]
    headers = {"Origin": "http://testserver", "X-CSRF-Token": client.cookies["csrf_token"]}
    assert (
        client.patch(
            f"/api/v1/admin/users/{admin['id']}",
            json={"is_active": False, "version": 1},
            headers=headers,
        ).status_code
        == 403
    )
    assert (
        client.patch(
            f"/api/v1/admin/users/{staff['id']}",
            json={"is_active": False, "version": 1},
            headers=headers,
        ).status_code
        == 200
    )
    assert (
        client.patch(
            f"/api/v1/admin/users/{staff['id']}",
            json={"is_active": True, "version": 1},
            headers=headers,
        ).status_code
        == 409
    )
    listing = client.get("/api/v1/admin/users?role=staff").json()
    assert listing["meta"]["total"] == 1 and listing["data"][0]["is_active"] is False
    assert client.get("/api/v1/admin/users?unknown=1").status_code == 422
    assert (
        post(
            client, "/auth/login", {"email": "staff@example.com", "password": "Goodstaff8!"}
        ).status_code
        == 401
    )
    assert db.scalar(select(func.count()).select_from(AuditLog)) >= 4


def test_password_reset_single_use_revokes_sessions_and_no_enumeration(client, db):
    assert register(client).status_code == 201
    for email in ["client@example.com", "missing@example.com"]:
        assert post(client, "/auth/password-reset/request", {"email": email}).json() == {
            "data": {"accepted": True}
        }
    email = db.scalar(select(EmailOutbox).where(EmailOutbox.template == "reset"))
    token = parse_qs(urlsplit(email.payload["link"]).fragment)["token"][0]
    assert db.scalar(select(OneTimeToken).where(OneTimeToken.token_hash == digest(token)))
    assert (
        post(
            client, "/auth/password-reset/confirm", {"token": token, "new_password": "Changed8!"}
        ).status_code
        == 204
    )
    assert client.get("/api/v1/auth/me").status_code == 401
    csrf(client)
    assert (
        post(
            client, "/auth/password-reset/confirm", {"token": token, "new_password": "Changed9!"}
        ).status_code
        == 422
    )
    assert (
        post(
            client, "/auth/login", {"email": "client@example.com", "password": "Goodpass8!"}
        ).status_code
        == 401
    )
    assert (
        post(
            client, "/auth/login", {"email": "client@example.com", "password": "Changed8!"}
        ).status_code
        == 200
    )


def test_invitation_and_email_verification(client, db):
    seed_admin(db, "admin@example.com", "Goodadmin8!", "Example Admin")
    csrf(client)
    assert (
        post(
            client, "/auth/login", {"email": "admin@example.com", "password": "Goodadmin8!"}
        ).status_code
        == 200
    )
    assert (
        post(
            client,
            "/admin/users",
            {"full_name": "Invited Staff", "email": "invited@example.com", "role": "staff"},
        ).status_code
        == 201
    )
    email = db.scalar(select(EmailOutbox).where(EmailOutbox.template == "invitation"))
    token = parse_qs(urlsplit(email.payload["link"]).fragment)["token"][0]
    assert (
        post(
            client, "/auth/password-reset/confirm", {"token": token, "new_password": "Invited8!"}
        ).status_code
        == 204
    )
    csrf(client)
    assert (
        post(
            client, "/auth/login", {"email": "invited@example.com", "password": "Invited8!"}
        ).json()["data"]["role"]
        == "staff"
    )
    assert post(client, "/auth/email-verification/request").status_code == 202
    email = db.scalar(select(EmailOutbox).where(EmailOutbox.template == "verification"))
    token = parse_qs(urlsplit(email.payload["link"]).fragment)["token"][0]
    assert post(client, "/auth/email-verification/confirm", {"token": token}).status_code == 204
    assert client.get("/api/v1/auth/me").json()["data"]["is_email_verified"]
    assert post(client, "/auth/email-verification/confirm", {"token": token}).status_code == 422


def test_rate_limits_generic_failures_and_cookie_flags(client):
    csrf(client)
    for _ in range(5):
        response = post(
            client, "/auth/login", {"email": "missing@example.com", "password": "Guesspass8!"}
        )
        assert (
            response.status_code == 401
            and response.json()["error"]["message"] == "Invalid email or password."
        )
    response = post(
        client, "/auth/login", {"email": "missing@example.com", "password": "Guesspass8!"}
    )
    assert response.status_code == 429 and int(response.headers["Retry-After"]) > 0
    assert register(client).status_code == 201
    cookies = client.cookies.jar
    assert next(c for c in cookies if c.name == "access_token").has_nonstandard_attr("HttpOnly")
    assert next(c for c in cookies if c.name == "refresh_token").path == "/api/v1/auth"
    assert not next(c for c in cookies if c.name == "csrf_token").has_nonstandard_attr("HttpOnly")
