from functools import lru_cache
from typing import Annotated

from botocore.client import BaseClient
from fastapi import Depends, HTTPException

from app.config import Settings, get_settings
from app.services.s3 import make_s3_client

SettingsDep = Annotated[Settings, Depends(get_settings)]


@lru_cache
def _cached_s3_client() -> BaseClient:
    return make_s3_client(get_settings())


def get_s3_client(settings: SettingsDep) -> BaseClient:
    missing = [
        name
        for name, value in (
            ("S3_ENDPOINT", settings.s3_endpoint),
            ("S3_ACCESS_KEY", settings.s3_access_key),
            ("S3_SECRET_KEY", settings.s3_secret_key),
        )
        if not value
    ]
    if missing:
        raise HTTPException(
            status_code=503,
            detail=f"S3 is not configured; missing {', '.join(missing)} in .env",
        )
    return _cached_s3_client()


S3ClientDep = Annotated[BaseClient, Depends(get_s3_client)]
