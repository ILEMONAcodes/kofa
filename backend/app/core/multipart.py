"""Close temporary uploads even if ASGI receive fails or the request is cancelled."""

from starlette.formparsers import MultiPartParser


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
