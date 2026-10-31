class AppError(Exception):
    def __init__(self, status: int, code: str, message: str, details=None, headers=None):
        self.status = status
        self.code = code
        self.message = message
        self.details = details or []
        self.headers = headers or {}


def invalid(field: str, message: str, code: str = "invalid_format"):
    return AppError(
        422,
        "VALIDATION_ERROR",
        "One or more fields are invalid.",
        [{"field": field, "code": code, "message": message}],
    )
