from functools import lru_cache
from typing import Literal
from urllib.parse import urlsplit

from pydantic import Field, SecretStr, model_validator
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
    storage_driver: Literal["disabled", "local", "s3"] = "disabled"
    storage_local_root: str = "/tmp/kofa-private-uploads"
    s3_endpoint_url: str = ""
    s3_region: str = "auto"
    s3_bucket: str = ""
    s3_access_key_id: SecretStr = SecretStr("")
    s3_secret_access_key: SecretStr = SecretStr("")
    ffprobe_binary: str = "ffprobe"
    availability_stale_days: int = Field(default=14, ge=1, le=365)
    assistant_provider: Literal["disabled", "test", "chat_completions"] = "disabled"
    assistant_api_key: SecretStr = SecretStr("")
    assistant_api_url: str = ""
    assistant_model: str = Field(default="", max_length=100)
    assistant_allow_live: bool = False
    assistant_daily_request_limit: int = Field(default=100, ge=1, le=10000)
    assistant_hard_token_limit: int = Field(default=100000, ge=0, le=10000000)
    assistant_max_output_tokens: int = Field(default=256, ge=64, le=512)
    captcha_required: bool = False

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
        if self.assistant_provider == "test" and self.app_env != "test":
            raise ValueError("The simulated assistant provider is test-only")
        if self.assistant_api_url:
            endpoint = urlsplit(self.assistant_api_url)
            if (
                endpoint.scheme != "https"
                or not endpoint.hostname
                or endpoint.username
                or endpoint.password
                or endpoint.query
                or endpoint.fragment
            ):
                raise ValueError(
                    "ASSISTANT_API_URL must be an HTTPS endpoint without credentials or query"
                )
        return self


@lru_cache
def get_settings() -> Settings:
    return Settings()
