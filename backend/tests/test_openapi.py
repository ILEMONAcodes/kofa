"""Schema drift check: regenerate with python -m app.openapi when intentional."""

import json
from pathlib import Path

from app.openapi import schema


def test_openapi_snapshot_matches_routes():
    assert schema() == json.loads(Path(__file__).parents[1].joinpath("openapi.json").read_text())
