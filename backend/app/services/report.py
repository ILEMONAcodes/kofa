"""Reporting definitions and WAT day boundaries, independent of the UI."""

import re
from datetime import UTC, date, datetime, time, timedelta
from zoneinfo import ZoneInfo

from app.core.errors import AppError, invalid
from app.core.security import now
from app.repositories import report as repo
from app.schemas.report import Counts, Dashboard, Period


def period(from_date=None, to_date=None):
    if bool(from_date) != bool(to_date):
        raise invalid("query", "Provide both from and to dates, or leave both empty.")
    if from_date is None and to_date is None:
        return None, None, None, None
    try:
        if not all(
            isinstance(value, str) and re.fullmatch(r"\d{4}-\d{2}-\d{2}", value)
            for value in [from_date, to_date]
        ):
            raise ValueError
        start_date, end_date = date.fromisoformat(from_date), date.fromisoformat(to_date)
        if end_date < start_date:
            raise ValueError
        wat = ZoneInfo("Africa/Lagos")
        start = datetime.combine(start_date, time.min, wat).astimezone(UTC)
        end = datetime.combine(end_date + timedelta(days=1), time.min, wat).astimezone(UTC)
        return start_date, end_date, start, end
    except (ValueError, OverflowError):
        raise invalid("query", "Choose a valid from/to date range in YYYY-MM-DD format.") from None


def dashboard(db, actor, from_date=None, to_date=None):
    if actor.role not in {"staff", "admin"} or not actor.is_active:
        raise AppError(403, "FORBIDDEN", "Staff access required.")
    first, last, start, end = period(from_date, to_date)
    as_of = now()
    return Dashboard(
        as_of=as_of,
        period=Period(from_date=first, to_date=last),
        counts=Counts(**repo.counts(db, as_of, start, end)),
    )
