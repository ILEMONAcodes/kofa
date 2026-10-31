from sqlalchemy import select

from app.core.security import now
from app.models.identity import EmailOutbox


def pending_messages(db):
    return db.scalars(
        select(EmailOutbox)
        .where(EmailOutbox.status == "pending", EmailOutbox.send_after <= now())
        .with_for_update(skip_locked=True)
        .limit(50)
    ).all()
