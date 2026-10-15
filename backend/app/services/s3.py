from io import BytesIO
from typing import List, Optional

import boto3
import pandas as pd
from botocore.client import BaseClient
from botocore.config import Config

from app.config import Settings


def make_s3_client(settings: Settings) -> BaseClient:
    return boto3.client(
        "s3",
        endpoint_url=settings.s3_endpoint,
        aws_access_key_id=settings.s3_access_key,
        aws_secret_access_key=settings.s3_secret_key,
        region_name=settings.s3_region,
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            # The Ceph-backed endpoint rejects botocore's default chunked
            # integrity checksums.
            request_checksum_calculation="when_required",
            response_checksum_validation="when_supported",
        ),
    )


def read_parquet(
    client: BaseClient,
    bucket: str,
    prefix: str,
    dataset: str,
    columns: Optional[List[str]] = None,
) -> pd.DataFrame:
    key = f"{prefix.strip('/')}/{dataset}.parquet"
    response = client.get_object(Bucket=bucket, Key=key)
    buffer = BytesIO(response["Body"].read())
    return pd.read_parquet(buffer, columns=columns, engine="pyarrow")
