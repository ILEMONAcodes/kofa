"""Close temporary uploads even if ASGI receive fails or the request is cancelled."""

from contextlib import asynccontextmanager

from starlette.datastructures import UploadFile
from starlette.formparsers import MultiPartException, MultiPartParser

from app.core.errors import AppError, invalid


class ClosingMultiPartParser(MultiPartParser):
    async def parse(self):
        try:
            return await super().parse()
        except BaseException:
            # Starlette only closes these on MultiPartException; receive failures may
            # be wrapped in an ExceptionGroup. Pinned Starlette field, regression-tested.
            for file in self._files_to_close_on_error:
                file.close()
            raise


@asynccontextmanager
async def single_upload(request):
    parser = ClosingMultiPartParser(
        request.headers, request.stream(), max_files=1, max_fields=2, max_part_size=2048
    )
    try:
        form = await parser.parse()
    except MultiPartException:
        raise AppError(400, "BAD_REQUEST", "Upload form is invalid.") from None
    try:
        names = [name for name, _ in form.multi_items()]
        if set(names) - {"file", "kind", "caption"} or len(names) != len(set(names)):
            raise invalid("file", "Use one file, a kind and an optional caption.")
        file, kind, caption = form.get("file"), form.get("kind"), form.get("caption")
        if (
            not isinstance(file, UploadFile)
            or not isinstance(kind, str)
            or (caption is not None and not isinstance(caption, str))
        ):
            raise invalid("file", "Choose a file and its kind.")
        yield file, kind, caption
    finally:
        await form.close()
