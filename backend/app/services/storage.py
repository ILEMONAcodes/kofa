"""Private storage only. No ACL or bucket is made public by the application."""

import re
import time
from dataclasses import dataclass
from pathlib import Path
from typing import BinaryIO, Protocol

import boto3
import jwt
from botocore.config import Config
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import Settings
from app.core.errors import AppError


def unavailable():
    return AppError(503, "SERVICE_UNAVAILABLE", "File storage is unavailable. Try again later.")


def valid_key(key: str) -> str:
    if not re.fullmatch(r"private/[a-zA-Z0-9/_-]+\.[a-z0-9]+", key) or "//" in key:
        raise ValueError("Invalid private storage key")
    return key


@dataclass(frozen=True)
class ReadGrant:
    expires_at: int
    url: str | None = None
    token: str | None = None


class Storage(Protocol):
    def put(self, key: str, data: BinaryIO, mime: str) -> None: ...
    def delete(self, key: str) -> None: ...
    def signed_read(self, key: str, ttl: int = 300) -> ReadGrant: ...


def valid_ttl(ttl: int) -> None:
    if not 1 <= ttl <= 300:
        raise ValueError("Private file grants last at most five minutes")


class LocalStorage:
    """Development-only files outside public assets; grants consumed by future auth routes."""

    def __init__(self, root: Path, secret: str):
        self.root = root.resolve()
        self.secret = secret
        self.root.mkdir(parents=True, exist_ok=True, mode=0o700)

    def path(self, key: str) -> Path:
        result = (self.root / valid_key(key)).resolve()
        if not result.is_relative_to(self.root):
            raise ValueError("Storage key leaves private root")
        return result

    def put(self, key: str, data: BinaryIO, mime: str) -> None:
        target = self.path(key)
        try:
            target.parent.mkdir(parents=True, exist_ok=True, mode=0o700)
            with target.open("xb") as output:
                target.chmod(0o600)
                while chunk := data.read(64 * 1024):
                    output.write(chunk)
        except OSError as exc:
            raise unavailable() from exc

    def delete(self, key: str) -> None:
        try:
            self.path(key).unlink(missing_ok=True)
        except OSError as exc:
            raise unavailable() from exc

    def signed_read(self, key: str, ttl: int = 300) -> ReadGrant:
        valid_ttl(ttl)
        self.path(key)
        expires = int(time.time()) + ttl
        token = jwt.encode(
            {"key": key, "exp": expires, "aud": "kofa-private-file"}, self.secret, algorithm="HS256"
        )
        return ReadGrant(expires_at=expires, token=token)

    def read_grant(self, token: str) -> bytes:
        try:
            value = jwt.decode(
                token,
                self.secret,
                algorithms=["HS256"],
                audience="kofa-private-file",
                options={"require": ["exp", "aud", "key"]},
            )
            return self.path(value["key"]).read_bytes()
        except (jwt.PyJWTError, OSError, ValueError, TypeError, KeyError) as exc:
            raise AppError(
                404, "NOT_FOUND", "File is unavailable or the link has expired."
            ) from exc


class S3Storage:
    def __init__(self, client, bucket: str):
        self.client = client
        self.bucket = bucket

    def put(self, key: str, data: BinaryIO, mime: str) -> None:
        valid_key(key)
        try:
            self.client.put_object(
                Bucket=self.bucket,
                Key=key,
                Body=data,
                ContentType=mime,
                ContentDisposition="attachment",
                CacheControl="private, no-store",
            )
        except (BotoCoreError, ClientError) as exc:
            raise unavailable() from exc

    def delete(self, key: str) -> None:
        valid_key(key)
        try:
            self.client.delete_object(Bucket=self.bucket, Key=key)
        except (BotoCoreError, ClientError) as exc:
            raise unavailable() from exc

    def signed_read(self, key: str, ttl: int = 300) -> ReadGrant:
        valid_key(key)
        valid_ttl(ttl)
        try:
            url = self.client.generate_presigned_url(
                "get_object",
                Params={
                    "Bucket": self.bucket,
                    "Key": key,
                    "ResponseContentDisposition": "attachment",
                    "ResponseCacheControl": "private, no-store",
                },
                ExpiresIn=ttl,
            )
        except (BotoCoreError, ClientError) as exc:
            raise unavailable() from exc
        return ReadGrant(expires_at=int(time.time()) + ttl, url=url)


def build_storage(settings: Settings) -> Storage:
    if settings.storage_driver == "local" and settings.app_env != "production":
        return LocalStorage(
            Path(settings.storage_local_root), settings.auth_secret.get_secret_value()
        )
    if settings.storage_driver != "s3" or not all(
        (
            settings.s3_endpoint_url,
            settings.s3_bucket,
            settings.s3_access_key_id.get_secret_value(),
            settings.s3_secret_access_key.get_secret_value(),
        )
    ):
        raise unavailable()
    if not settings.s3_endpoint_url.startswith("https://"):
        raise unavailable()
    client = boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint_url,
        region_name=settings.s3_region,
        aws_access_key_id=settings.s3_access_key_id.get_secret_value(),
        aws_secret_access_key=settings.s3_secret_access_key.get_secret_value(),
        config=Config(
            signature_version="s3v4",
            connect_timeout=5,
            read_timeout=15,
            retries={"max_attempts": 2},
            s3={"addressing_style": "path"},
        ),
    )
    return S3Storage(client, settings.s3_bucket)
