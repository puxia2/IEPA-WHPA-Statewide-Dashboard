from functools import lru_cache
from pathlib import Path
from typing import List, Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

REPO_ROOT = Path(__file__).resolve().parents[2]


class Settings(BaseSettings):
    """
    Backend configuration, read from environment variables and the repo-root
    .env (names are case-insensitive, so S3_BUCKET fills s3_bucket).
    """

    model_config = SettingsConfigDict(
        env_file=REPO_ROOT / ".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Optional so the app still starts without them; only the S3 routes fail.
    s3_endpoint: Optional[str] = None
    s3_access_key: Optional[str] = None
    s3_secret_key: Optional[str] = None
    s3_region: str = "us-east-1"
    s3_bucket: str = "ot-data-catalog"
    s3_prefix: str = "isws/wq"

    db_driver: str = "SQL Server"
    db_server: str = "datastorm"
    db_name: str = "ESTL_DB"

    cors_origins: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]


@lru_cache
def get_settings() -> Settings:
    return Settings()
