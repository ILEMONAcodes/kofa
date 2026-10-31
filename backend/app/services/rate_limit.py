import hashlib
import hmac

from app.core.errors import AppError
from app.core.security import now
from app.repositories.rate_limits import increment


def consume(db, settings, namespace: str, subject: str, limit: int, seconds: int):
    key = hmac.new(
        settings.auth_secret.get_secret_value().encode(),
        f"{namespace}:{subject}".encode(),
        hashlib.sha256,
    ).hexdigest()
    moment = now()
    count, reset_at = increment(db, key, moment, seconds)
    db.commit()  # Attempt survives rejected credentials and request rollback.
    if count > limit:
        retry = max(1, int((reset_at - moment).total_seconds()) + 1)
        raise AppError(
            429,
            "RATE_LIMITED",
            "Too many attempts. Please try again later.",
            headers={"Retry-After": str(retry)},
        )
