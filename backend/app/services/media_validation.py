"""Bounded content inspection and metadata-free image output; no filenames trusted."""

import io
import json
import subprocess
import tempfile
import warnings
from dataclasses import dataclass
from pathlib import PurePosixPath
from typing import BinaryIO

from PIL import Image, ImageOps, UnidentifiedImageError
from pypdf import PdfReader
from pypdf.errors import PdfReadError
from pypdf.generic import DictionaryObject

from app.core.errors import AppError, invalid

MIB = 1024 * 1024
DOCUMENTS = {"ownership_proof", "authorization_letter", "id_document", "other"}
IMAGE_FORMATS = {
    "JPEG": ("image/jpeg", "jpg"),
    "PNG": ("image/png", "png"),
    "WEBP": ("image/webp", "webp"),
}
MAX_PIXELS = 25_000_000


@dataclass
class ValidatedFile:
    data: bytes
    mime: str
    extension: str
    filename: str
    width: int | None = None
    height: int | None = None
    thumbnail: bytes | None = None


def unsupported():
    return AppError(415, "UNSUPPORTED_MEDIA_TYPE", "Choose a supported, undamaged file.")


def too_large():
    return AppError(413, "PAYLOAD_TOO_LARGE", "This file exceeds the upload limit.")


def safe_filename(name: str) -> str:
    name = PurePosixPath(name.replace("\\", "/")).name
    clean = "".join(c for c in name if c.isalnum() or c in " ._-").strip(" .")[:255]
    return clean or "upload"


def read_bounded(stream: BinaryIO, limit: int) -> bytes:
    output = bytearray()
    while chunk := stream.read(min(64 * 1024, limit + 1 - len(output))):
        output.extend(chunk)
        if len(output) > limit:
            raise too_large()
    if not output:
        raise unsupported()
    return bytes(output)


def validate_image(data: bytes, kind: str, filename: str) -> ValidatedFile:
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(io.BytesIO(data)) as check:
                fmt = check.format
                if fmt not in IMAGE_FORMATS or (kind in DOCUMENTS and fmt == "WEBP"):
                    raise unsupported()
                if check.width * check.height > MAX_PIXELS or getattr(check, "n_frames", 1) != 1:
                    raise unsupported()
                check.verify()
            with Image.open(io.BytesIO(data)) as original:
                oriented = ImageOps.exif_transpose(original)
                # Copy pixels into a fresh image so EXIF/XMP/ICC/text never propagate.
                mode = "RGBA" if "A" in oriented.getbands() else "RGB"
                clean = Image.new(mode, oriented.size)
                clean.paste(oriented.convert(mode))
                output = io.BytesIO()
                clean.save(output, format=fmt)
                if output.tell() > 10 * MIB:
                    raise too_large()
                thumbnail = None
                if kind == "photo":
                    clean.thumbnail((480, 480))
                    thumb = io.BytesIO()
                    clean.save(thumb, format="WEBP", quality=82)
                    thumbnail = thumb.getvalue()
                mime, extension = IMAGE_FORMATS[fmt]
                return ValidatedFile(
                    output.getvalue(),
                    mime,
                    extension,
                    filename,
                    oriented.width,
                    oriented.height,
                    thumbnail,
                )
    except (
        UnidentifiedImageError,
        OSError,
        ValueError,
        SyntaxError,
        Image.DecompressionBombError,
        Image.DecompressionBombWarning,
    ) as exc:
        raise unsupported() from exc


def validate_pdf(data: bytes, filename: str) -> ValidatedFile:
    try:
        if not data.startswith(b"%PDF-") or b"%%EOF" not in data[-1024:]:
            raise unsupported()
        doc = PdfReader(io.BytesIO(data), strict=True)
        if doc.is_encrypted or not len(doc.pages):
            raise unsupported()
        root = doc.trailer["/Root"].get_object()
        if not isinstance(root, DictionaryObject):
            raise unsupported()
        names = root.get("/Names")
        if names is not None:
            names = names.get_object()
        if any(key in root for key in ("/OpenAction", "/AA")) or (
            isinstance(names, DictionaryObject)
            and any(key in names for key in ("/JavaScript", "/EmbeddedFiles"))
        ):
            raise unsupported()
    except (PdfReadError, ValueError, TypeError, KeyError, RecursionError) as exc:
        raise unsupported() from exc
    return ValidatedFile(data, "application/pdf", "pdf", filename)


def validate_video(data: bytes, filename: str, ffprobe: str) -> ValidatedFile:
    mp4 = len(data) >= 12 and data[4:8] == b"ftyp"
    webm = data.startswith(b"\x1a\x45\xdf\xa3")
    if not (mp4 or webm):
        raise unsupported()
    # Disable network protocols: an uploaded container must never fetch remote media.
    with tempfile.NamedTemporaryFile(suffix=".mp4" if mp4 else ".webm") as video:
        video.write(data)
        video.flush()
        try:
            result = subprocess.run(
                [
                    ffprobe,
                    "-v",
                    "error",
                    "-protocol_whitelist",
                    "file",
                    "-select_streams",
                    "v:0",
                    "-max_alloc",
                    "33554432",
                    "-show_entries",
                    "format=format_name:stream=codec_type,width,height",
                    "-of",
                    "json",
                    video.name,
                ],
                capture_output=True,
                timeout=15,
                check=False,
            )
        except FileNotFoundError as exc:
            raise AppError(503, "SERVICE_UNAVAILABLE", "Video processing is unavailable.") from exc
        except (subprocess.TimeoutExpired, OSError) as exc:
            raise unsupported() from exc
    try:
        if result.returncode or len(result.stdout) > 256 * 1024:
            raise unsupported()
        info = json.loads(result.stdout)
        formats = set(info["format"]["format_name"].split(","))
        if (mp4 and "mp4" not in formats) or (webm and "webm" not in formats):
            raise unsupported()
        stream = next(s for s in info["streams"] if s.get("codec_type") == "video")
        width, height = int(stream["width"]), int(stream["height"])
        if width <= 0 or height <= 0 or width * height > MAX_PIXELS:
            raise unsupported()
    except (ValueError, KeyError, StopIteration, TypeError) as exc:
        raise unsupported() from exc
    # No transcoding; original video bytes remain private.
    return ValidatedFile(
        data,
        "video/mp4" if mp4 else "video/webm",
        "mp4" if mp4 else "webm",
        filename,
        width,
        height,
    )


def validate_file(
    stream: BinaryIO,
    kind: str,
    filename: str,
    declared_mime: str | None = None,
    ffprobe: str = "ffprobe",
) -> ValidatedFile:
    if kind not in {"photo", "video"} | DOCUMENTS:
        raise invalid("kind", "Choose a supported upload kind.", "invalid_choice")
    data = read_bounded(stream, 100 * MIB if kind == "video" else 10 * MIB)
    filename = safe_filename(filename)
    if kind == "video":
        result = validate_video(data, filename, ffprobe)
    elif kind in DOCUMENTS and data.startswith(b"%PDF-"):
        result = validate_pdf(data, filename)
    else:
        result = validate_image(data, kind, filename)
    if declared_mime and declared_mime not in {"application/octet-stream", result.mime}:
        raise unsupported()
    return result
