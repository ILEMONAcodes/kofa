from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import SecretStr, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore", hide_input_in_errors=True)
    database_url: SecretStr
    database_url_unpooled: SecretStr | None = None
    auth_secret: SecretStr
    app_env: Literal["development", "test", "production"] = "development"
    public_origin: str = "http://localhost:3000"
    cookie_secure: bool = True
    terms_version: str = "draft-v1"
    privacy_version: str = "draft-v1"
    policies_approved: bool = False
    email_mode: Literal["outbox", "smtp"] = "outbox"
    smtp_host: str = ""
    smtp_port: int = 587
    smtp_username: str = ""
    smtp_password: SecretStr = SecretStr("")
    smtp_from: str = ""
    smtp_starttls: bool = True

    @model_validator(mode="after")
    def secure_settings(self):
        if len(self.auth_secret.get_secret_value()) < 32:
            raise ValueError("AUTH_SECRET must contain at least 32 characters")
        if not self.database_url.get_secret_value().startswith(
            ("postgresql://", "postgresql+psycopg://", "postgres://")
        ):
            raise ValueError("DATABASE_URL must be a PostgreSQL connection string")
        origin = urlsplit(self.public_origin)
        if (
            origin.scheme not in {"http", "https"}
            or not origin.netloc
            or origin.path
            or origin.query
            or origin.fragment
            or origin.username
        ):
            raise ValueError("PUBLIC_ORIGIN must be a bare HTTP(S) origin")
        if self.app_env == "production" and (not self.cookie_secure or origin.scheme != "https"):
            raise ValueError("Production requires HTTPS and Secure cookies")
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
