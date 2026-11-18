"""Only bundled, public Markdown guidance; never arbitrary files or user uploads."""

from datetime import UTC, datetime
from pathlib import Path
from types import SimpleNamespace
from uuid import NAMESPACE_URL, uuid5

ROOT = Path(__file__).resolve().parents[2] / "knowledge"
SLUGS = (
    "about-kofa",
    "verification",
    "browsing",
    "accounts-inquiries",
    "inspections",
    "landlords-media",
    "support",
)


def articles():
    result = []
    for name in SLUGS:
        text = (ROOT / (name + ".md")).read_text(encoding="utf-8")
        title, body = text.split("\n", 1)
        result.append(
            SimpleNamespace(
                id=uuid5(NAMESPACE_URL, "kofa:guide:" + name),
                slug="guide-" + name,
                title=title.removeprefix("# "),
                body=body.strip(),
                published_at=datetime(2026, 11, 18, tzinfo=UTC),
                category="how_it_works",
                language="en",
            )
        )
    return result


def by_slug(slug):
    return next((row for row in articles() if row.slug == slug), None)
