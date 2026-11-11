"""Fictional dashboard browser fixtures; only the guarded localhost test DB."""

import json
from datetime import timedelta
from uuid import uuid4
from zoneinfo import ZoneInfo

from app.core.database import make_engine, session_factory
from app.core.security import hasher, now
from app.models.appointment import Appointment
from app.models.complaint import Complaint
from app.models.identity import User
from app.models.inquiry import Inquiry
from tests.e2e_server import settings
from tests.test_property_models import property_record


def main():
    config = settings()  # Rejects remote/non-test databases before opening a connection.
    engine = make_engine(config.database_url.get_secret_value())
    with session_factory(engine)() as db:
        stamp = now()
        user = User(
            full_name="Dashboard Fixture",
            email=f"kofa-e2e-{uuid4()}@example.com",
            phone="+2348012345678",
            role="client",
            password_hash=hasher.hash("Browserpass8!"),
        )
        staff = User(
            full_name="Dashboard Staff",
            email=f"kofa-e2e-{uuid4()}@example.com",
            role="staff",
            password_hash=hasher.hash("Browserpass8!"),
        )
        db.add_all([user, staff])
        db.flush()
        prop = property_record(db, status="submitted", submitted_at=stamp)
        inquiry = Inquiry(
            client_id=user.id,
            property_id=prop.id,
            kind="inspection_request",
            status="inspection_scheduled",
            created_at=stamp,
        )
        db.add_all(
            [
                inquiry,
                Inquiry(client_id=user.id, kind="general", status="new", created_at=stamp),
                Inquiry(client_id=user.id, kind="general", status="closed_lost", created_at=stamp),
            ]
        )
        db.flush()
        scheduled = stamp + timedelta(days=1)
        db.add(
            Appointment(
                inquiry_id=inquiry.id,
                property_id=prop.id,
                client_id=user.id,
                staff_id=staff.id,
                status="proposed",
                scheduled_at=scheduled,
                ends_at=scheduled + timedelta(minutes=45),
                duration_minutes=45,
            )
        )
        for status in ["new", "dismissed"]:
            db.add(
                Complaint(
                    kind="service_complaint",
                    status=status,
                    reporter_ip_hash="a" * 64,
                    description="Fictional private concern",
                    upload_token_hash="b" * 64,
                    upload_token_expires_at=stamp + timedelta(days=1),
                    created_at=stamp,
                    dismiss_reason="out_of_scope" if status == "dismissed" else None,
                )
            )
        db.commit()
    engine.dispose()
    print(
        json.dumps(
            {
                "today": stamp.astimezone(ZoneInfo("Africa/Lagos")).date().isoformat(),
                "tomorrow": scheduled.astimezone(ZoneInfo("Africa/Lagos")).date().isoformat(),
            }
        )
    )


if __name__ == "__main__":
    main()
