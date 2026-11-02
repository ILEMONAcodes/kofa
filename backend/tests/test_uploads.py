import io
import json
import time
import uuid
from unittest.mock import Mock

import boto3
import jwt
import pytest
from botocore.stub import ANY, Stubber
from PIL import Image
from pypdf import PdfWriter

from app.core.errors import AppError
from app.models.property import PropertyDocument, PropertyMedia
from app.services.media import add_file, document_read_grant, issue_upload_token
from app.services.media_validation import MIB, validate_file
from app.services.storage import LocalStorage, S3Storage, build_storage
from tests.test_property_models import property_record, staff_record


def image_bytes(fmt="JPEG", exif=False):
    output = io.BytesIO()
    image = Image.new("RGB", (900, 600), (100, 80, 60))
    metadata = Image.Exif()
    if exif:
        metadata[315] = "Sensitive owner metadata"
        metadata[274] = 6
    image.save(output, format=fmt, exif=metadata)
    return output.getvalue()


def pdf_bytes():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    output = io.BytesIO()
    writer.write(output)
    return output.getvalue()


@pytest.mark.parametrize("fmt", ["JPEG", "PNG", "WEBP"])
def test_photos_reencoded_without_exif_and_thumb(fmt):
    validated = validate_file(io.BytesIO(image_bytes(fmt, True)), "photo", "../../private.jpg")
    with Image.open(io.BytesIO(validated.data)) as image:
        assert len(image.getexif()) == 0
        assert image.size == (600, 900)
    with Image.open(io.BytesIO(validated.thumbnail)) as thumb:
        assert max(thumb.size) <= 480 and len(thumb.getexif()) == 0
    assert validated.filename == "private.jpg"


@pytest.mark.parametrize(
    "data,kind,mime",
    [
        (b"<svg onload='bad()'></svg>", "photo", "image/jpeg"),
        (b"MZ executable", "photo", "image/png"),
        (b"%PDF-1.7\ntruncated", "ownership_proof", "application/pdf"),
        (image_bytes("WEBP"), "ownership_proof", "image/webp"),
        (image_bytes("PNG"), "photo", "image/jpeg"),
        (b"", "photo", None),
        (b"not an mp4", "video", "video/mp4"),
    ],
)
def test_unsupported_and_mistyped_content(data, kind, mime):
    with pytest.raises(AppError) as error:
        validate_file(io.BytesIO(data), kind, "image.jpg", mime)
    assert error.value.status == 415


@pytest.mark.parametrize(
    "kind,limit", [("photo", 10 * MIB), ("ownership_proof", 10 * MIB), ("video", 100 * MIB)]
)
def test_oversized_stream_stops_reading_at_limit(kind, limit):
    class Oversized:
        read_bytes = 0

        def read(self, count):
            self.read_bytes += count
            return b"a" * count

    stream = Oversized()
    with pytest.raises(AppError) as error:
        validate_file(stream, kind, "oversize")
    assert error.value.status == 413 and stream.read_bytes == limit + 1


def test_pdf_and_private_document_images():
    result = validate_file(
        io.BytesIO(pdf_bytes()), "ownership_proof", "../evidence.pdf", "application/pdf"
    )
    assert result.mime == "application/pdf" and result.thumbnail is None
    result = validate_file(io.BytesIO(image_bytes("PNG", True)), "id_document", "id.png")
    assert result.thumbnail is None
    with Image.open(io.BytesIO(result.data)) as clean:
        assert not clean.getexif()


def test_pdf_active_content_rejected():
    writer = PdfWriter()
    writer.add_blank_page(width=100, height=100)
    writer.add_js("app.alert('test')")
    output = io.BytesIO()
    writer.write(output)
    with pytest.raises(AppError) as error:
        validate_file(io.BytesIO(output.getvalue()), "ownership_proof", "test.pdf")
    assert error.value.status == 415


def test_decompression_dimension_guard(monkeypatch):
    monkeypatch.setattr("app.services.media_validation.MAX_PIXELS", 100)
    with pytest.raises(AppError) as error:
        validate_file(io.BytesIO(image_bytes()), "photo", "test.jpg")
    assert error.value.status == 415


def test_video_probe_is_network_disabled_and_container_checked(monkeypatch):
    probe = Mock(
        return_value=Mock(
            returncode=0,
            stdout=json.dumps(
                {
                    "format": {"format_name": "mov,mp4,m4a,3gp,3g2,mj2"},
                    "streams": [{"codec_type": "video", "width": 1280, "height": 720}],
                }
            ).encode(),
        )
    )
    monkeypatch.setattr("app.services.media_validation.subprocess.run", probe)
    content = b"\x00\x00\x00\x18ftypisom" + b"0" * 20
    result = validate_file(io.BytesIO(content), "video", "video.mp4")
    assert result.data == content and result.mime == "video/mp4"
    args = probe.call_args.args[0]
    assert args[args.index("-protocol_whitelist") + 1] == "file"
    assert probe.call_args.kwargs["timeout"] == 15
    probe.return_value = Mock(returncode=1, stdout=b"{}")
    with pytest.raises(AppError) as error:
        validate_file(io.BytesIO(content), "video", "video.mp4")
    assert error.value.status == 415


def test_video_processing_unavailable_fails_closed(monkeypatch):
    monkeypatch.setattr(
        "app.services.media_validation.subprocess.run", Mock(side_effect=FileNotFoundError)
    )
    with pytest.raises(AppError) as error:
        validate_file(io.BytesIO(b"\0\0\0\x18ftypisom"), "video", "video.mp4")
    assert error.value.status == 503


def local_storage(tmp_path):
    return LocalStorage(tmp_path, "local-test-storage-secret-at-least-32-characters")


def test_local_private_grants_expire_and_reject_traversal(tmp_path):
    store = local_storage(tmp_path)
    key = "private/properties/one/document.pdf"
    store.put(key, io.BytesIO(b"private"), "application/pdf")
    assert store.path(key).stat().st_mode & 0o777 == 0o600
    grant = store.signed_read(key, 1)
    assert grant.url is None and store.read_grant(grant.token) == b"private"
    expired = jwt.encode(
        {"key": key, "exp": int(time.time()) - 1, "aud": "kofa-private-file"},
        store.secret,
        algorithm="HS256",
    )
    for token in [expired, grant.token + "tampered"]:
        with pytest.raises(AppError):
            store.read_grant(token)
    for key in ["../secret.env", "private/../secret.env", "/etc/passwd", "public/file.jpg"]:
        with pytest.raises(ValueError):
            store.path(key)
    with pytest.raises(ValueError):
        store.signed_read("private/a.pdf", 301)
    store.delete("private/properties/one/document.pdf")
    assert not store.path("private/properties/one/document.pdf").exists()


def test_local_storage_symlink_escape_rejected(tmp_path):
    store = local_storage(tmp_path / "root")
    (store.root / "private").symlink_to(tmp_path, target_is_directory=True)
    with pytest.raises(ValueError):
        store.put("private/escape.pdf", io.BytesIO(b"a"), "application/pdf")


def test_s3_private_write_and_expiring_download_without_cloud():
    client = boto3.client(
        "s3",
        region_name="us-east-1",
        endpoint_url="https://storage.example.com",
        aws_access_key_id="test",
        aws_secret_access_key="test-secret",
    )
    storage = S3Storage(client, "private-bucket")
    with Stubber(client) as stub:
        stub.add_response(
            "put_object",
            {},
            dict(
                Bucket="private-bucket",
                Key="private/a.pdf",
                Body=ANY,
                ContentType="application/pdf",
                ContentDisposition="attachment",
                CacheControl="private, no-store",
            ),
        )
        stub.add_response("delete_object", {}, dict(Bucket="private-bucket", Key="private/a.pdf"))
        storage.put("private/a.pdf", io.BytesIO(b"private"), "application/pdf")
        grant = storage.signed_read("private/a.pdf", 60)
        assert grant.url.startswith("https://storage.example.com/") and "Signature" in grant.url
        storage.delete("private/a.pdf")
        stub.assert_no_pending_responses()


def test_storage_config_disabled_or_local_production_fails(settings):
    for value in [
        settings,
        settings.model_copy(update={"storage_driver": "local", "app_env": "production"}),
    ]:
        with pytest.raises(AppError) as error:
            build_storage(value)
        assert error.value.status == 503


def test_submission_photo_upload_scoped_and_rows_private(db, settings, tmp_path):
    prop = property_record(db)
    db.commit()
    store = local_storage(tmp_path)
    token, _ = issue_upload_token(settings, prop.id)
    row = add_file(
        db,
        settings,
        store,
        prop.id,
        io.BytesIO(image_bytes()),
        "photo",
        "../../a.jpg",
        upload_token=token,
    )
    assert row.is_cover and row.storage_key.startswith(f"private/properties/{prop.id}/")
    assert store.path(row.thumb_key).exists()
    assert row.original_filename == "a.jpg" and db.get(PropertyMedia, row.id) is not None
    with pytest.raises(AppError) as error:
        add_file(
            db,
            settings,
            store,
            uuid.uuid4(),
            io.BytesIO(image_bytes()),
            "photo",
            "a.jpg",
            upload_token=token,
        )
    assert error.value.status == 404
    prop.status = "submitted"
    db.commit()
    with pytest.raises(AppError) as error:
        add_file(
            db,
            settings,
            store,
            prop.id,
            io.BytesIO(image_bytes()),
            "photo",
            "a.jpg",
            upload_token=token,
        )
    assert error.value.status == 409


def test_client_cannot_upload_as_staff_or_read_docs(db, settings, tmp_path):
    prop = property_record(db)
    user = staff_record(db)
    user.role = "client"
    user.phone = "+2348000000001"
    db.commit()
    store = local_storage(tmp_path)
    with pytest.raises(AppError) as error:
        add_file(
            db,
            settings,
            store,
            prop.id,
            io.BytesIO(image_bytes()),
            "photo",
            "a.jpg",
            actor_id=user.id,
        )
    assert error.value.status == 403
    with pytest.raises(AppError) as error:
        document_read_grant(db, store, user.id, uuid.uuid4())
    assert error.value.status == 403


def test_staff_document_access_and_deactivation(db, settings, tmp_path):
    prop = property_record(db)
    user = staff_record(db)
    db.commit()
    store = local_storage(tmp_path)
    doc = add_file(
        db,
        settings,
        store,
        prop.id,
        io.BytesIO(pdf_bytes()),
        "ownership_proof",
        "evidence.pdf",
        actor_id=user.id,
    )
    assert isinstance(doc, PropertyDocument)
    grant = document_read_grant(db, store, user.id, doc.id)
    assert store.read_grant(grant.token) == pdf_bytes()
    user.is_active = False
    db.commit()
    with pytest.raises(AppError) as error:
        document_read_grant(db, store, user.id, doc.id)
    assert error.value.status == 403


def test_document_count_limit_does_not_write_more_objects(db, settings, tmp_path):
    prop = property_record(db)
    user = staff_record(db)
    db.commit()
    store = local_storage(tmp_path)
    for i in range(10):
        add_file(
            db,
            settings,
            store,
            prop.id,
            io.BytesIO(pdf_bytes()),
            "ownership_proof",
            f"{i}.pdf",
            actor_id=user.id,
        )
    with pytest.raises(AppError) as error:
        add_file(
            db,
            settings,
            store,
            prop.id,
            io.BytesIO(pdf_bytes()),
            "id_document",
            "11.pdf",
            actor_id=user.id,
        )
    assert error.value.status == 422 and len(list(tmp_path.rglob("*.pdf"))) == 10


def test_partial_storage_failure_removes_objects_and_rows(db, settings, tmp_path):
    prop = property_record(db)
    user = staff_record(db)
    db.commit()
    store = local_storage(tmp_path)
    real_put = store.put

    def failing_put(key, data, mime):
        if key.endswith("_thumb.webp"):
            raise AppError(503, "SERVICE_UNAVAILABLE", "Unavailable")
        real_put(key, data, mime)

    store.put = failing_put
    with pytest.raises(AppError):
        add_file(
            db,
            settings,
            store,
            prop.id,
            io.BytesIO(image_bytes()),
            "photo",
            "a.jpg",
            actor_id=user.id,
        )
    assert not list(tmp_path.rglob("*.jpg"))
    assert not db.query(PropertyMedia).count()


def test_commit_failure_cleans_uploaded_objects(db, settings, tmp_path, monkeypatch):
    prop = property_record(db)
    user = staff_record(db)
    db.commit()
    store = local_storage(tmp_path)
    monkeypatch.setattr(
        db, "commit", Mock(side_effect=RuntimeError("simulated transaction failure"))
    )
    with pytest.raises(RuntimeError):
        add_file(
            db,
            settings,
            store,
            prop.id,
            io.BytesIO(image_bytes()),
            "photo",
            "a.jpg",
            actor_id=user.id,
        )
    assert not list(tmp_path.rglob("*.jpg")) and not list(tmp_path.rglob("*.webp"))


def test_expired_submission_capability_does_not_write(db, settings, tmp_path):
    prop = property_record(db)
    db.commit()
    store = local_storage(tmp_path)
    token = jwt.encode(
        {
            "sub": str(prop.id),
            "aud": "kofa-property-upload",
            "scope": "upload",
            "exp": int(time.time()) - 1,
            "jti": str(uuid.uuid4()),
        },
        settings.auth_secret.get_secret_value(),
        algorithm="HS256",
    )
    with pytest.raises(AppError) as error:
        add_file(
            db,
            settings,
            store,
            prop.id,
            io.BytesIO(image_bytes()),
            "photo",
            "a.jpg",
            upload_token=token,
        )
    assert error.value.status == 404 and not list(tmp_path.rglob("*.jpg"))


def test_photo_limit_blocks_twenty_first(db, settings, tmp_path):
    prop = property_record(db)
    user = staff_record(db)
    for position in range(20):
        db.add(
            PropertyMedia(
                property_id=prop.id,
                kind="photo",
                storage_key=f"private/{position}.jpg",
                original_filename="a.jpg",
                mime_type="image/jpeg",
                size_bytes=100,
                position=position,
                uploaded_by="staff",
            )
        )
    db.commit()
    store = local_storage(tmp_path)
    with pytest.raises(AppError) as error:
        add_file(
            db,
            settings,
            store,
            prop.id,
            io.BytesIO(image_bytes()),
            "photo",
            "a.jpg",
            actor_id=user.id,
        )
    assert error.value.status == 422 and not list(tmp_path.rglob("*.jpg"))


def test_concurrent_document_uploads_cannot_exceed_quota(db, engine, settings, tmp_path):
    from concurrent.futures import ThreadPoolExecutor

    from app.core.database import session_factory

    prop = property_record(db)
    user = staff_record(db)
    for i in range(9):
        db.add(
            PropertyDocument(
                property_id=prop.id,
                kind="ownership_proof",
                storage_key=f"private/{i}.pdf",
                mime_type="application/pdf",
                size_bytes=100,
            )
        )
    db.commit()
    store = local_storage(tmp_path)
    factory = session_factory(engine)
    property_id, user_id = prop.id, user.id

    def upload():
        with factory() as session:
            try:
                add_file(
                    session,
                    settings,
                    store,
                    property_id,
                    io.BytesIO(pdf_bytes()),
                    "ownership_proof",
                    "test.pdf",
                    actor_id=user_id,
                )
                return 201
            except AppError as exc:
                return exc.status

    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: upload(), range(2)))
    assert sorted(results) == [201, 422]
    assert db.query(PropertyDocument).filter_by(property_id=property_id).count() == 10


def test_live_properties_reject_file_mutation(db, settings, tmp_path):
    prop = property_record(db, status="published")
    user = staff_record(db)
    db.commit()
    with pytest.raises(AppError) as error:
        add_file(
            db,
            settings,
            local_storage(tmp_path),
            prop.id,
            io.BytesIO(image_bytes()),
            "photo",
            "a.jpg",
            actor_id=user.id,
        )
    assert error.value.status == 409
