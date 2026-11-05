"""Export the API contract without opening a database connection or reading .env."""

import json
from pathlib import Path

from app.core.config import Settings
from app.main import create_app


def schema():
    settings = Settings(
        database_url="postgresql://kofa_test@127.0.0.1:55432/kofa_auth_test_utf8",
        auth_secret="schema-export-only-not-a-runtime-secret",
        app_env="test",
        _env_file=None,
    )
    app = create_app(settings)
    try:
        return app.openapi()
    finally:
        app.state.engine.dispose()


def main():
    Path(__file__).parents[1].joinpath("openapi.json").write_text(
        json.dumps(schema(), indent=2, sort_keys=True) + "\n"
    )


if __name__ == "__main__":
    main()
