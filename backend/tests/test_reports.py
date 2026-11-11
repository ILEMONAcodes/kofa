"""Hand-counted workload fixtures, WAT boundaries and default-deny reporting."""

from datetime import UTC, datetime, timedelta
from unittest.mock import patch

import pytest
from sqlalchemy import event

from app.core.errors import AppError
from app.models.appointment import Appointment
from app.models.complaint import Complaint
from app.models.inquiry import Inquiry
from app.services.report import dashboard, period
from tests.test_property_models import property_record
from tests.test_staff_properties import clone, login

AS_OF = datetime(2030, 5, 10, 12, tzinfo=UTC)
START = datetime(2030, 5, 9, 23, tzinfo=UTC)  # May 10 midnight WAT.
END = START + timedelta(days=1)


@pytest.fixture
def population(db, client):
    actor = login(client, db, "staff")
    client_user = login(client, db, "client")
    prop = property_record(db, status="submitted", submitted_at=START)
    clone(db, prop, status="in_review", submitted_at=END - timedelta(microseconds=1))
    clone(db, prop, status="submitted", submitted_at=START - timedelta(microseconds=1))
    clone(db, prop, status="submitted", submitted_at=END)
    for status in [
        "draft",
        "changes_requested",
        "approved",
        "published",
        "unpublished",
        "rejected",
        "archived",
    ]:
        clone(db, prop, status=status, submitted_at=START)
    inquiries = []
    for _index, status in enumerate(
        [
            "new",
            "in_progress",
            "qualified",
            "inspection_scheduled",
            "negotiating",
            "closed_won",
            "closed_lost",
            "spam",
        ]
    ):
        row = Inquiry(client_id=client_user.id, kind="general", status=status, created_at=START)
        db.add(row)
        db.flush()
        inquiries.append(row)
    for stamp in [START - timedelta(microseconds=1), END]:
        db.add(Inquiry(client_id=client_user.id, kind="general", status="new", created_at=stamp))
    # Different slots avoid overlap; cancelled/completed records may overlap safely.
    for index, status in enumerate(
        [
            "proposed",
            "confirmed",
            "reschedule_requested",
            "cancelled_by_client",
            "cancelled_by_staff",
            "cancelled_by_landlord",
            "completed",
            "no_show",
        ]
    ):
        at = AS_OF + timedelta(hours=index)
        db.add(
            Appointment(
                inquiry_id=inquiries[index].id,
                property_id=prop.id,
                client_id=client_user.id,
                staff_id=actor.id,
                status=status,
                scheduled_at=at,
                ends_at=at + timedelta(minutes=45),
                duration_minutes=45,
            )
        )
    past_inquiry = Inquiry(
        client_id=client_user.id, kind="general", status="closed_lost", created_at=START
    )
    db.add(past_inquiry)
    db.flush()
    db.add(
        Appointment(
            inquiry_id=past_inquiry.id,
            property_id=prop.id,
            client_id=client_user.id,
            staff_id=actor.id,
            status="proposed",
            scheduled_at=AS_OF - timedelta(hours=2),
            ends_at=AS_OF - timedelta(hours=1, minutes=15),
            duration_minutes=45,
        )
    )
    for _index, (status, stamp) in enumerate(
        [
            ("new", START),
            ("triage", END - timedelta(microseconds=1)),
            ("investigating", START),
            ("dismissed", START),
            ("new", END),
            ("new", START - timedelta(microseconds=1)),
        ]
    ):
        db.add(
            Complaint(
                kind="service_complaint",
                status=status,
                reporter_ip_hash="a" * 64,
                description="PRIVATE REPORTER NARRATIVE",
                reporter_email="private@example.com",
                upload_token_hash="b" * 64,
                upload_token_expires_at=END,
                created_at=stamp,
                dismiss_reason="out_of_scope" if status == "dismissed" else None,
            )
        )
    db.commit()
    return actor, client_user


def test_exact_counts_date_boundaries_and_single_statement(db, client, population):
    actor, _ = population
    statements = []

    def track(conn, cursor, statement, parameters, context, executemany):
        if statement.lstrip().upper().startswith("SELECT"):
            statements.append(statement)

    with patch("app.services.report.now", return_value=AS_OF):
        event.listen(db.bind, "before_cursor_execute", track)
        try:
            result = dashboard(db, actor, "2030-05-10", "2030-05-10")
        finally:
            event.remove(db.bind, "before_cursor_execute", track)
        # The actor may refresh once after fixture commit; aggregate remains one SELECT.
        assert len([s for s in statements if "count(*)" in s]) == 1
        assert result.counts.model_dump() == dict(
            listings_awaiting_review=2,
            open_inquiries=5,
            upcoming_inspections=3,
            active_complaints=3,
        )
        all_dates = dashboard(db, actor)
        assert all_dates.counts.model_dump() == dict(
            listings_awaiting_review=4,
            open_inquiries=7,
            upcoming_inspections=3,
            active_complaints=5,
        )
        past = dashboard(db, actor, "2029-01-01", "2029-01-01")
        assert all(v == 0 for v in past.counts.model_dump().values())
    assert result.period.timezone == "Africa/Lagos"
    assert result.as_of == AS_OF


@pytest.mark.parametrize(
    "role,status", [(None, 401), ("client", 403), ("staff", 200), ("admin", 200)]
)
def test_report_permission_matrix_and_no_private_fields(client, db, role, status):
    if role:
        login(client, db, role)
    response = client.get("/api/v1/admin/reports/kpis")
    assert response.status_code == status
    assert response.headers["cache-control"] == "no-store"
    if status == 200:
        body = response.json()["data"]
        assert set(body) == {"as_of", "period", "counts"}
        assert set(body["counts"]) == {
            "listings_awaiting_review",
            "open_inquiries",
            "upcoming_inspections",
            "active_complaints",
        }
        assert set(body["counts"].values()) == {0}
        for forbidden in [
            "email",
            "phone",
            "reporter",
            "address",
            "description",
            "findings",
            "landlord",
        ]:
            assert forbidden not in response.text


@pytest.mark.parametrize(
    "query",
    [
        "from=2030-05-10",
        "to=2030-05-10",
        "from=&to=",
        "from=2030-05-11&to=2030-05-10",
        "from=2030-02-30&to=2030-03-01",
        "from=20300510&to=20300510",
        "from=2030-05-10T00:00:00&to=2030-05-10",
        "from=9999-12-31&to=9999-12-31",
        "status=new",
        "from=2030-05-10&from=2030-05-10&to=2030-05-10",
    ],
)
def test_strict_date_filters(client, db, query):
    login(client, db, "staff")
    response = client.get("/api/v1/admin/reports/kpis?" + query)
    assert response.status_code == 422, response.text
    assert response.json()["error"]["details"]
    assert response.headers["x-request-id"]


def test_leap_day_timezone_and_service_role_guard(db, client):
    first, last, start, end = period("2028-02-29", "2028-02-29")
    assert start == datetime(2028, 2, 28, 23, tzinfo=UTC)
    assert end == datetime(2028, 2, 29, 23, tzinfo=UTC)
    user = login(client, db, "client")
    with pytest.raises(AppError) as exc:
        dashboard(db, user)
    assert exc.value.status == 403


def test_aggregate_plan_is_bounded(db, client, population):
    actor, _ = population
    # Capture the actual aggregate SQL, then EXPLAIN it with identical bound values.
    captured = []

    def track(conn, cursor, statement, parameters, context, executemany):
        if "count(*)" in statement:
            captured.append((statement, parameters))

    event.listen(db.bind, "before_cursor_execute", track)
    try:
        dashboard(db, actor)
    finally:
        event.remove(db.bind, "before_cursor_execute", track)
    statement, parameters = captured[0]
    with db.bind.connect() as conn:
        plan = conn.exec_driver_sql(
            "EXPLAIN (ANALYZE, FORMAT JSON) " + statement, parameters
        ).scalar_one()[0]
    assert plan["Plan"]["Actual Rows"] == 1
    assert plan["Execution Time"] < 500
