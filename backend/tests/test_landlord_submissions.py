import io
import uuid
from concurrent.futures import ThreadPoolExecutor
from copy import deepcopy
from unittest.mock import Mock

import pytest
from PIL import Image
from pypdf import PdfWriter
from sqlalchemy import func, select, text
from sqlalchemy.exc import DBAPIError

from alembic import command
from app.core.database import session_factory
from app.core.errors import AppError
from app.models.identity import PolicyAcceptance, User
from app.models.property import (
    Area,
    Landlord,
    Property,
    PropertyDocument,
    PropertyMedia,
    PropertyStatusHistory,
    StorageDeletion,
)
from app.seeds.taxonomy import seed_taxonomy
from app.services.media import issue_upload_token
from app.services.rate_limit import consume
from app.services.storage import LocalStorage
from app.services.submission import drain_deletions, submit
from tests.conftest import csrf
from tests.test_property_models import migration_config, property_record


@pytest.fixture
def setup_submission(client, db, tmp_path):
    seed_taxonomy(db)
    client.app.state.storage = LocalStorage(
        tmp_path, "private-file-test-secret-at-least-32-characters"
    )
    csrf(client)
    area = db.scalar(select(Area.id).where(Area.slug == "abuja-wuse-2"))
    return {
        "landlord": {
            "full_name": "Fictional Owner",
            "phone": "08012345678",
            "email": "owner@example.com",
            "relationship": "owner",
        },
        "property": {
            "title": "Three bedroom apartment",
            "description": "An isolated fictional property for tests.",
            "listing_type": "rent",
            "property_type": "apartment",
            "area_id": str(area),
            "address_line": "12 Fictional Private Street",
            "address_hint": "Near the market",
            "price": {"amount": 350000000, "currency": "NGN", "period": "year"},
            "bedrooms": 3,
            "bathrooms": 2,
            "furnishing": "unfurnished",
            "amenity_codes": ["parking"],
        },
        "accepted_policies": [
            {"type": "terms", "version": "draft-v1"},
            {"type": "privacy", "version": "draft-v1"},
        ],
    }


def headers(client, token=None):
    values = {"Origin": "http://testserver", "X-CSRF-Token": client.cookies.get("csrf_token", "")}
    if token:
        values["X-Upload-Token"] = token
    return values


def create(client, payload):
    return client.post("/api/v1/landlord-submissions", json=payload, headers=headers(client))


def photo():
    buffer = io.BytesIO()
    Image.new("RGB", (50, 40), "brown").save(buffer, "JPEG")
    return buffer.getvalue()


def pdf():
    buffer = io.BytesIO()
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.write(buffer)
    return buffer.getvalue()


def upload(client, draft, kind="photo", content=None):
    return client.post(
        f"/api/v1/landlord-submissions/{draft['id']}/files",
        headers=headers(client, draft["upload_token"]),
        data={"kind": kind},
        files={
            "file": (
                "evidence.pdf" if kind != "photo" else "room.jpg",
                content if content is not None else photo(),
                "application/pdf" if kind != "photo" else "image/jpeg",
            )
        },
    )


def ready(client, draft):
    for _ in range(5):
        assert upload(client, draft).status_code == 201
    assert upload(client, draft, "ownership_proof", pdf()).status_code == 201


def test_create_upload_remove_submit_and_private_receipts(client, db, setup_submission):
    response = create(client, setup_submission)
    assert response.status_code == 201 and response.headers["Cache-Control"] == "no-store"
    draft = response.json()["data"]
    assert set(draft) == {"id", "status", "upload_token", "upload_token_expires_at"}
    assert db.scalar(select(func.count()).select_from(User)) == 0
    owner = db.scalar(select(Landlord))
    assert owner.phone == "+2348012345678"
    assert (
        db.scalar(
            select(func.count())
            .select_from(PolicyAcceptance)
            .where(PolicyAcceptance.landlord_id == owner.id)
        )
        == 2
    )
    first = upload(client, draft).json()["data"]
    second = upload(client, draft).json()["data"]
    assert set(first) == {"file_id", "kind", "size_bytes", "status"}
    row = db.get(PropertyMedia, uuid.UUID(first["file_id"]))
    key, thumb = row.storage_key, row.thumb_key
    response = client.delete(
        f"/api/v1/landlord-submissions/{draft['id']}/files/{first['file_id']}",
        headers=headers(client, draft["upload_token"]),
    )
    assert response.status_code == 204 and not response.content
    db.expire_all()
    assert db.get(PropertyMedia, uuid.UUID(second["file_id"])).is_cover
    assert (
        not client.app.state.storage.path(key).exists()
        and not client.app.state.storage.path(thumb).exists()
    )
    for _ in range(4):
        assert upload(client, draft).status_code == 201
    assert upload(client, draft, "ownership_proof", pdf()).status_code == 201
    url = f"/api/v1/landlord-submissions/{draft['id']}/submit"
    response = client.post(url, headers=headers(client, draft["upload_token"]))
    assert response.status_code == 200
    receipt = response.json()["data"]
    assert set(receipt) == {"id", "status", "reference"} and receipt["reference"].startswith("SUB-")
    assert (
        client.post(url, headers=headers(client, draft["upload_token"])).json()["data"] == receipt
    )
    db.expire_all()
    prop = db.get(Property, uuid.UUID(draft["id"]))
    assert prop.status == "submitted" and prop.submitted_at and prop.row_version == 2
    assert (
        db.scalar(
            select(func.count())
            .select_from(PropertyStatusHistory)
            .where(PropertyStatusHistory.property_id == prop.id)
        )
        == 2
    )
    assert upload(client, draft).status_code == 409
    assert (
        client.delete(
            f"/api/v1/landlord-submissions/{draft['id']}/files/{second['file_id']}",
            headers=headers(client, draft["upload_token"]),
        ).status_code
        == 409
    )
    text_value = str(receipt) + str(first) + str(draft)
    for secret in [
        "owner@example.com",
        "08012345678",
        "Fictional Private Street",
        "storage_key",
        "landlord_id",
    ]:
        assert secret not in text_value
    # No public file-list/detail endpoint exists for a guessed submission UUID.
    assert client.get(f"/api/v1/landlord-submissions/{draft['id']}").status_code == 404


@pytest.mark.parametrize(
    "section,key,value",
    [
        ("property", "title", "a"),
        ("property", "bedrooms", 21),
        ("property", "bathrooms", -1),
        ("property", "area_id", str(uuid.uuid4())),
        ("property", "amenity_codes", ["unknown"]),
        ("property", "amenity_codes", ["parking", "parking"]),
        ("property", "status", "published"),
        ("landlord", "role", "admin"),
        ("landlord", "phone", "not-a-phone"),
        ("property", "description", "too short"),
        ("property", "listing_type", "lease"),
    ],
)
def test_invalid_or_injected_draft_data(client, setup_submission, section, key, value):
    payload = deepcopy(setup_submission)
    payload[section][key] = value
    response = create(client, payload)
    assert response.status_code == 422 and response.json()["error"]["code"] == "VALIDATION_ERROR"
    assert "input" not in str(response.json()) and response.headers.get("X-Request-ID")


@pytest.mark.parametrize("amount", [True, 1000, 1.5, "350000000", 9223372036854775808])
def test_money_is_bounded_integer_kobo(client, setup_submission, amount):
    setup_submission["property"]["price"]["amount"] = amount
    assert create(client, setup_submission).status_code == 422


def test_sale_period_and_duplicate_policy_validation(client, setup_submission):
    setup_submission["property"]["listing_type"] = "sale"
    assert create(client, setup_submission).status_code == 422
    setup_submission["property"]["price"]["period"] = "one_time"
    setup_submission["accepted_policies"][1] = {"type": "terms", "version": "draft-v1"}
    assert create(client, setup_submission).status_code == 422


def test_disabled_area_and_old_policy(client, db, setup_submission):
    area = db.get(Area, uuid.UUID(setup_submission["property"]["area_id"]))
    area.is_active = False
    db.commit()
    assert create(client, setup_submission).status_code == 422
    area.is_active = True
    db.commit()
    setup_submission["accepted_policies"][0]["version"] = "old"
    assert create(client, setup_submission).status_code == 422


def test_csrf_origin_and_draft_rate_limit(client, setup_submission):
    assert client.post("/api/v1/landlord-submissions", json=setup_submission).status_code == 403
    bad = headers(client)
    bad["Origin"] = "https://untrusted.example"
    assert (
        client.post("/api/v1/landlord-submissions", json=setup_submission, headers=bad).status_code
        == 403
    )
    for _ in range(5):
        assert create(client, setup_submission).status_code == 201
    response = create(client, setup_submission)
    assert response.status_code == 429 and int(response.headers["Retry-After"]) > 0


def test_wrong_tokens_cross_property_delete_and_missing_header(client, setup_submission):
    one = create(client, setup_submission).json()["data"]
    two = create(client, setup_submission).json()["data"]
    file = upload(client, one).json()["data"]
    assert upload(client, {**one, "upload_token": two["upload_token"]}).status_code == 404
    assert (
        client.delete(
            f"/api/v1/landlord-submissions/{two['id']}/files/{file['file_id']}",
            headers=headers(client, two["upload_token"]),
        ).status_code
        == 404
    )
    assert (
        client.post(
            f"/api/v1/landlord-submissions/{one['id']}/submit", headers=headers(client)
        ).status_code
        == 422
    )


def test_submit_requires_five_photos_and_ownership_evidence(client, setup_submission):
    draft = create(client, setup_submission).json()["data"]
    url = f"/api/v1/landlord-submissions/{draft['id']}/submit"
    assert client.post(url, headers=headers(client, draft["upload_token"])).status_code == 422
    for _ in range(5):
        assert upload(client, draft).status_code == 201
    assert upload(client, draft, "id_document", pdf()).status_code == 201
    assert client.post(url, headers=headers(client, draft["upload_token"])).status_code == 422
    assert upload(client, draft, "authorization_letter", pdf()).status_code == 201
    assert client.post(url, headers=headers(client, draft["upload_token"])).status_code == 200


def test_upload_limit_before_parsing_and_unknown_form_fields(
    client, db, settings, setup_submission
):
    draft = create(client, setup_submission).json()["data"]
    response = client.post(
        f"/api/v1/landlord-submissions/{draft['id']}/files",
        headers=headers(client, draft["upload_token"]),
        data={"kind": "photo", "role": "admin"},
        files={"file": ("a.jpg", photo(), "image/jpeg")},
    )
    assert response.status_code == 422
    for _ in range(59):
        consume(db, settings, "landlord-upload-token", draft["upload_token"], 60, 3600)
    assert upload(client, draft).status_code == 429


def test_bad_file_and_unconfigured_storage_fail_safely(client, setup_submission):
    draft = create(client, setup_submission).json()["data"]
    assert upload(client, draft, content=b"<script>bad</script>").status_code == 415
    client.app.state.storage = None
    response = upload(client, draft)
    assert response.status_code == 503 and "storage_key" not in response.text


def test_captcha_hook_disabled_missing_invalid_and_success(client, setup_submission, settings):
    client.app.state.settings = settings.model_copy(update={"captcha_required": True})
    assert create(client, setup_submission).status_code == 503
    client.app.state.captcha_verifier = Mock(return_value=False)
    h = headers(client)
    h["X-Captcha-Token"] = "fake-test-challenge"
    assert (
        client.post("/api/v1/landlord-submissions", json=setup_submission, headers=h).status_code
        == 403
    )
    client.app.state.captcha_verifier = Mock(return_value=True)
    assert (
        client.post("/api/v1/landlord-submissions", json=setup_submission, headers=h).status_code
        == 201
    )


def test_delete_storage_failure_is_queued_and_retried(client, db, setup_submission):
    draft = create(client, setup_submission).json()["data"]
    file = upload(client, draft).json()["data"]
    store = client.app.state.storage
    real_delete = store.delete
    store.delete = Mock(side_effect=AppError(503, "SERVICE_UNAVAILABLE", "Unavailable"))
    response = client.delete(
        f"/api/v1/landlord-submissions/{draft['id']}/files/{file['file_id']}",
        headers=headers(client, draft["upload_token"]),
    )
    assert response.status_code == 204
    assert db.scalar(select(func.count()).select_from(StorageDeletion)) == 2
    assert db.get(PropertyMedia, uuid.UUID(file["file_id"])) is None
    store.delete = real_delete
    assert drain_deletions(db, store) == 2
    assert db.scalar(select(func.count()).select_from(StorageDeletion)) == 0


def test_concurrent_submissions_have_one_reference(db, engine, settings):
    prop = property_record(db)
    for i in range(5):
        db.add(
            PropertyMedia(
                property_id=prop.id,
                kind="photo",
                storage_key=f"private/{i}.jpg",
                original_filename="test.jpg",
                mime_type="image/jpeg",
                size_bytes=100,
                position=i,
                uploaded_by="landlord_submission",
            )
        )
    db.add(
        PropertyDocument(
            property_id=prop.id,
            kind="ownership_proof",
            storage_key="private/proof.pdf",
            mime_type="application/pdf",
            size_bytes=100,
        )
    )
    db.commit()
    property_id = prop.id
    token, _ = issue_upload_token(settings, property_id)
    factory = session_factory(engine)

    def send(_):
        with factory() as session:
            return submit(session, settings, property_id, token, None)

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(send, range(2)))
    assert results[0] == results[1]
    assert db.scalar(select(func.count()).select_from(PropertyStatusHistory)) == 1


def test_submission_migration_rollback_guard(engine, db):
    prop = property_record(db)
    prop.submission_reference = "SUB-TEST-000001"
    db.commit()
    db.close()
    with pytest.raises(DBAPIError, match="submission references"):
        command.downgrade(migration_config(), "be42_properties")
    with engine.connect() as conn:
        assert conn.scalar(text("SELECT version_num FROM alembic_version")) == "be44_submissions"


def test_draft_json_receive_limit(client, setup_submission):
    setup_submission["property"]["description"] = "a" * 70000
    response = create(client, setup_submission)
    assert response.status_code == 413


def test_blocked_contact_stays_submitted_with_private_review_note(client, db, setup_submission):
    from datetime import UTC, datetime

    db.add(
        Landlord(
            full_name="Earlier fictional owner",
            phone="+2348012345678",
            blocked_at=datetime.now(UTC),
            blocked_reason="Private earlier investigation",
        )
    )
    db.commit()
    draft = create(client, setup_submission).json()["data"]
    prop = db.get(Property, uuid.UUID(draft["id"]))
    contact = db.get(Landlord, prop.landlord_id)
    assert "staff review required" in contact.notes
    ready(client, draft)
    response = client.post(
        f"/api/v1/landlord-submissions/{draft['id']}/submit",
        headers=headers(client, draft["upload_token"]),
    )
    assert response.status_code == 200 and response.json()["data"]["status"] == "submitted"
    db.refresh(prop)
    assert prop.status == "submitted"
    assert "blocked" not in response.text and "investigation" not in response.text


def test_multipart_body_is_bounded_while_receiving(client, setup_submission):
    draft = create(client, setup_submission).json()["data"]
    boundary = "test-upload-boundary"
    prefix = (
        f'--{boundary}\r\nContent-Disposition: form-data; name="kind"\r\n\r\nvideo\r\n--{boundary}\r\nContent-Disposition: form-data; name="file"; filename="huge.mp4"\r\nContent-Type: video/mp4\r\n\r\n'
    ).encode()

    def chunks():
        yield prefix
        for _ in range(102):
            yield b"x" * (1024 * 1024)
        yield f"\r\n--{boundary}--\r\n".encode()

    h = headers(client, draft["upload_token"])
    h["Content-Type"] = f"multipart/form-data; boundary={boundary}"
    response = client.post(
        f"/api/v1/landlord-submissions/{draft['id']}/files", content=chunks(), headers=h
    )
    assert response.status_code == 413


def test_openapi_documents_minimal_receipts_and_multipart(client):
    api = client.app.openapi()
    upload = api["paths"]["/api/v1/landlord-submissions/{id}/files"]["post"]
    assert "multipart/form-data" in upload["requestBody"]["content"]
    assert set(api["components"]["schemas"]["SubmissionReceipt"]["properties"]) == {
        "id",
        "status",
        "reference",
    }
    assert "landlord" not in api["components"]["schemas"]["DraftReceipt"]["properties"]


@pytest.mark.parametrize("role", ["client", "staff", "admin"])
def test_signed_in_roles_can_use_the_public_contact_flow(client, db, setup_submission, role):
    from app.core.security import hasher

    user = User(
        email=f"{role}@example.com",
        password_hash=hasher.hash("Goodpass8!"),
        full_name="Fictional User",
        role=role,
        phone="+2348000000001",
    )
    db.add(user)
    db.commit()
    response = client.post(
        "/api/v1/auth/login",
        json={"email": user.email, "password": "Goodpass8!"},
        headers=headers(client),
    )
    assert response.status_code == 200
    response = create(client, setup_submission)
    assert response.status_code == 201 and response.json()["data"]["status"] == "draft"


def test_upload_still_requires_csrf_even_with_valid_capability(client, setup_submission):
    draft = create(client, setup_submission).json()["data"]
    response = client.post(
        f"/api/v1/landlord-submissions/{draft['id']}/files",
        headers={"X-Upload-Token": draft["upload_token"]},
        data={"kind": "photo"},
        files={"file": ("photo.jpg", photo(), "image/jpeg")},
    )
    assert response.status_code == 403


def test_unknown_query_parameters_rejected(client, setup_submission):
    response = client.post(
        "/api/v1/landlord-submissions?role=admin", json=setup_submission, headers=headers(client)
    )
    assert response.status_code == 422


def test_partial_multipart_spool_is_closed_after_receive_failure():
    import asyncio

    from starlette.datastructures import Headers

    from app.core.multipart import ClosingMultiPartParser

    async def broken_stream():
        yield b'--test\r\nContent-Disposition: form-data; name="file"; filename="a.jpg"\r\nContent-Type: image/jpeg\r\n\r\npartial'
        raise RuntimeError("simulated disconnected request")

    parser = ClosingMultiPartParser(
        Headers({"Content-Type": "multipart/form-data; boundary=test"}),
        broken_stream(),
        max_files=1,
    )
    with pytest.raises(RuntimeError):
        asyncio.run(parser.parse())
    assert len(parser._files_to_close_on_error) == 1
    assert all(file.closed for file in parser._files_to_close_on_error)
