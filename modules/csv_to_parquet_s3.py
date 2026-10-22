#!/usr/bin/env python3
# /// script
# requires-python = ">=3.10"
# dependencies = [
#     "pandas",
#     "pyarrow",
#     "boto3",
#     "python-dotenv",
# ]
# ///
"""

Convert the dashboard's source CSV files to Parquet and publish them to the
`ot-data-catalog` S3 bucket under the `isws/wq` prefix.

Credentials are read from the repository `.env` file (S3_ENDPOINT,
S3_ACCESS_KEY, S3_SECRET_KEY).

Run with uv (no environment setup needed):

    uv run modules/csv_to_parquet_s3.py --dry-run
    uv run modules/csv_to_parquet_s3.py

ISWS, bengal1@illinois.edu

"""

import argparse
import os
import sys
import tempfile
from pathlib import Path

import boto3
import pandas as pd
from botocore.config import Config
from botocore.exceptions import ClientError
from dotenv import load_dotenv

REPO_ROOT = Path(__file__).resolve().parent.parent
DEFAULT_SOURCE_DIR = REPO_ROOT / "public"
DEFAULT_BUCKET = "private"
DEFAULT_PREFIX = "tlpa/wq"


def make_s3_client():
    """Build an S3 client against the endpoint configured in .env."""
    load_dotenv(REPO_ROOT / ".env")

    endpoint = os.environ.get("S3_ENDPOINT")
    access_key = os.environ.get("S3_ACCESS_KEY")
    secret_key = os.environ.get("S3_SECRET_KEY")

    missing = [
        name
        for name, value in (
            ("S3_ENDPOINT", endpoint),
            ("S3_ACCESS_KEY", access_key),
            ("S3_SECRET_KEY", secret_key),
        )
        if not value
    ]
    if missing:
        sys.exit(f"Missing required setting(s) in .env: {', '.join(missing)}")

    return boto3.client(
        "s3",
        endpoint_url=endpoint,
        aws_access_key_id=access_key,
        aws_secret_access_key=secret_key,
        region_name=os.environ.get("S3_REGION", "us-east-1"),
        config=Config(
            signature_version="s3v4",
            s3={"addressing_style": "path"},
            # OSN's Ceph endpoint rejects botocore's default chunked
            # integrity checksums (XAmzContentSHA256Mismatch on PutObject).
            request_checksum_calculation="when_required",
            response_checksum_validation="when_supported",
        ),
    )


def read_csv(path: Path) -> pd.DataFrame:
    """Read a CSV, promoting any *Date* column to a real timestamp type."""
    df = pd.read_csv(path, low_memory=False)

    for column in df.columns:
        if "date" not in column.lower():
            continue
        parsed = pd.to_datetime(df[column], errors="coerce", format="mixed")
        # Only take the parsed version if nothing was lost to coercion.
        if parsed.isna().sum() == df[column].isna().sum():
            df[column] = parsed

    return df


def convert(csv_path: Path, parquet_path: Path, compression: str) -> pd.DataFrame:
    df = read_csv(csv_path)
    df.to_parquet(parquet_path, engine="pyarrow", compression=compression, index=False)
    return df


def human(n_bytes: int) -> str:
    size = float(n_bytes)
    for unit in ("B", "KB", "MB", "GB"):
        if size < 1024 or unit == "GB":
            return f"{size:,.1f} {unit}"
        size /= 1024
    return f"{size:,.1f} GB"


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "csv_files",
        nargs="*",
        type=Path,
        help="CSV files to convert (default: every .csv in public/)",
    )
    parser.add_argument("--source-dir", type=Path, default=DEFAULT_SOURCE_DIR)
    parser.add_argument("--bucket", default=DEFAULT_BUCKET)
    parser.add_argument("--prefix", default=DEFAULT_PREFIX)
    parser.add_argument(
        "--compression",
        default="snappy",
        choices=["snappy", "gzip", "zstd", "brotli", "none"],
    )
    parser.add_argument(
        "--keep-local",
        type=Path,
        help="Directory to also keep the generated .parquet files in",
    )
    parser.add_argument(
        "--overwrite",
        action="store_true",
        help="Replace objects that already exist in the bucket",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Convert and report, but do not upload",
    )
    args = parser.parse_args()

    csv_files = sorted(args.csv_files or args.source_dir.glob("*.csv"))
    if not csv_files:
        sys.exit(f"No CSV files found in {args.source_dir}")

    missing = [p for p in csv_files if not p.is_file()]
    if missing:
        sys.exit("Not a file: " + ", ".join(str(p) for p in missing))

    client = make_s3_client()
    prefix = args.prefix.strip("/")
    compression = None if args.compression == "none" else args.compression

    out_dir = args.keep_local
    if out_dir:
        out_dir.mkdir(parents=True, exist_ok=True)

    with tempfile.TemporaryDirectory() as tmp:
        staging = Path(out_dir) if out_dir else Path(tmp)

        for csv_path in csv_files:
            key = f"{prefix}/{csv_path.stem}.parquet"
            parquet_path = staging / f"{csv_path.stem}.parquet"

            print(f"\n{csv_path.name} ({human(csv_path.stat().st_size)})")
            df = convert(csv_path, parquet_path, compression)
            print(
                f"  -> {parquet_path.name} "
                f"({human(parquet_path.stat().st_size)}, "
                f"{len(df):,} rows x {len(df.columns)} cols)"
            )

            if args.dry_run:
                print(f"  [dry run] would upload to s3://{args.bucket}/{key}")
                continue

            if not args.overwrite:
                try:
                    client.head_object(Bucket=args.bucket, Key=key)
                except ClientError as exc:
                    if exc.response["Error"]["Code"] not in ("404", "NoSuchKey"):
                        raise
                else:
                    print(f"  exists, skipping (use --overwrite): s3://{args.bucket}/{key}")
                    continue

            client.upload_file(str(parquet_path), args.bucket, key)
            print(f"  uploaded s3://{args.bucket}/{key}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())