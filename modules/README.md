# modules

Python-side utilities supporting the ISWS Water Quality Dashboard.

| File | Purpose |
| --- | --- |
| `csv_to_parquet_s3.py` | Convert the dashboard's source CSVs to Parquet and publish them to the `ot-data-catalog` S3 bucket |
| `database_accessor_sqlalchemy.py` | SQLAlchemy-based query layer for the WQ database |
| `TabWQDataTOjson.py` | Tabular WQ data → JSON conversion |
| `config/environment.yml` | Conda environment for the database/plotting scripts |

---

## `csv_to_parquet_s3.py`

Converts each CSV in `public/` to Parquet and uploads it to
`s3://ot-data-catalog/isws/wq/`, so the dashboard data is available from the
catalog rather than only as multi-megabyte CSVs checked into the repo.

Parquet's columnar encoding shrinks these files by roughly 50x, and the reader
gets real column types instead of re-parsing strings on every load.

### Setup

Credentials are read from the repo-root `.env` file (gitignored):

```
S3_ENDPOINT=https://ncsa.osn.xsede.org
S3_ACCESS_KEY=...
S3_SECRET_KEY=...
```

The script is a [PEP 723](https://peps.python.org/pep-0723/) self-contained
script — its dependencies (pandas, pyarrow, boto3, python-dotenv) are declared
inline, so `uv` installs them into a cached throwaway environment on first run.
It does **not** use `config/environment.yml`, and needs no venv or conda setup.

### Usage

```bash
# Convert everything and report what would be uploaded, without uploading
uv run modules/csv_to_parquet_s3.py --dry-run

# Convert all of public/*.csv and upload
uv run modules/csv_to_parquet_s3.py

# Just one or two files
uv run modules/csv_to_parquet_s3.py public/dv.csv

# Keep the generated .parquet files around instead of using a temp dir
uv run modules/csv_to_parquet_s3.py --keep-local ./parquet-out
```

Each `public/<name>.csv` becomes `s3://ot-data-catalog/isws/wq/<name>.parquet`.

### Options

| Flag | Default | Meaning |
| --- | --- | --- |
| *(positional)* | all of `public/*.csv` | Specific CSV files to convert |
| `--source-dir` | `public/` | Directory to glob for CSVs |
| `--bucket` | `ot-data-catalog` | Target bucket |
| `--prefix` | `isws/wq` | Key prefix within the bucket |
| `--compression` | `snappy` | `snappy`, `gzip`, `zstd`, `brotli`, or `none` |
| `--keep-local DIR` | *(temp dir)* | Also keep the `.parquet` files on disk |
| `--overwrite` | off | Replace objects that already exist |
| `--dry-run` | off | Convert and report, but don't upload |

### Behavior worth knowing

**Existing objects are skipped, not overwritten.** A re-run reports
`exists, skipping` for keys already in the bucket. Pass `--overwrite` when you
genuinely intend to replace published data.

**Date columns become real timestamps — but only when it's lossless.** Any
column whose name contains `date` is parsed to `datetime64`; if a single value
would coerce to null, the column is left as its original string form rather
than silently dropping data. This is why `Start_Date` and `dv.csv`'s `Date`
come back as timestamps.

**The OSN checksum workaround is load-bearing.** botocore ≥ 1.36 sends chunked
integrity checksums by default, which OSN's Ceph endpoint rejects with
`XAmzContentSHA256Mismatch` on every `PutObject`. The client config sets
`request_checksum_calculation="when_required"` to suppress them. Removing that
line breaks all uploads.

### Reading the published data

```python
import os
import pandas as pd
from dotenv import load_dotenv

load_dotenv()
storage_options = {
    "key": os.environ["S3_ACCESS_KEY"],
    "secret": os.environ["S3_SECRET_KEY"],
    "endpoint_url": os.environ["S3_ENDPOINT"],
}

df = pd.read_parquet(
    "s3://ot-data-catalog/isws/wq/EStL_AllDataJoin2.parquet",
    storage_options=storage_options,
)
```

(Requires `s3fs` alongside pandas/pyarrow.)

### Current contents

Last published 2026-08-04:

| Object | Source CSV | Parquet | Rows |
| --- | --- | --- | --- |
| `EStL_AllDataJoin2.parquet` | 56.7 MB | 973 KB | 222,606 |
| `EStL_AllDataJoin_Unified.parquet` | 51.8 MB | 880 KB | 222,606 |
| `EStL_AllDataJoin_biannual.parquet` | 4.9 MB | 179 KB | 68,149 |
| `EStL_AllDataJoin_year.parquet` | 3.4 MB | 167 KB | 50,901 |
| `dv.parquet` | 252 KB | 109 KB | 9,109 |