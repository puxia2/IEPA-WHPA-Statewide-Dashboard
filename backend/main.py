from __future__ import annotations

from datetime import datetime, timezone
from io import BytesIO
from pathlib import Path
import sys
from typing import Literal

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
import pandas as pd

# Allow importing sibling package `modules/` from the repo root.
REPO_ROOT = Path(__file__).resolve().parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from modules.csv_to_parquet_s3 import make_s3_client  # noqa: E402
from database.database_accessor_sqlalchemy import dbqISWS  # noqa: E402
from interpolation import ordinary_kriging_grid  # noqa: E402

import os

# Prefer .env values (loaded inside make_s3_client); fall back to publish defaults.
s3_client = make_s3_client()
print([b["Name"] for b in s3_client.list_buckets()["Buckets"]])  # print out all buckets


DEFAULT_BUCKET = os.environ.get("S3_BUCKET", "ot-data-catalog")
DEFAULT_PREFIX = os.environ.get("S3_PREFIX", "isws/wq").strip("/")

app = FastAPI(
    title="ISWS WQ Dashboard API",
    description="Backend API for computation-heavy water quality operations",
    version="0.0.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class HelloRequest(BaseModel):
    name: str = "world"


class HelloResponse(BaseModel):
    message: str
    received_at: str


@app.get("/")
def root():
    return {
        "service": "ISWS WQ Dashboard API",
        "status": "ok",
        "docs": "/docs",
    }


@app.get("/health")
def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@app.get("/api/hello", response_model=HelloResponse)
def hello_get(name: str = "world"):
    return HelloResponse(
        message=f"Hello, {name}!",
        received_at=datetime.now(timezone.utc).isoformat(),
    )


@app.post("/api/hello", response_model=HelloResponse)
def hello_post(body: HelloRequest):
    return HelloResponse(
        message=f"Hello, {body.name}!",
        received_at=datetime.now(timezone.utc).isoformat(),
    )


@app.get("/api/test-db")
def test_db():
    db = dbqISWS(
        Driver="SQL Server",
        Server="datastorm",
        Database="ESTL_DB",
        Trusted_Connection="yes",
        verbose=False,
    )

    try:
        data = db.sql_query(
            "SELECT TOP 10 * FROM dbo.TBL_Locations;",
            returnbool=True,
        )
        return data.to_dict(orient="records")

    finally:
        db.close_connection()


def read_parquet_from_s3(file_name: str, columns: list[str] | None = None) -> pd.DataFrame:
    key = f"{DEFAULT_PREFIX}/{file_name}.parquet"
    response = s3_client.get_object(Bucket=DEFAULT_BUCKET, Key=key)
    buffer = BytesIO(response["Body"].read())
    return pd.read_parquet(buffer, columns=columns, engine="pyarrow")


@app.get("/api/test-parquet")
def test_parquet():
    try:
        df = read_parquet_from_s3(
            "EStL_AllDataJoin2",
            columns=["Station_ID", "Name", "Lat", "Long"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {
        "rows": len(df),
        "columns": df.columns.tolist(),
        "preview": df.head(5).to_dict(orient="records"),
    }


class KrigingPoint(BaseModel):
    lng: float
    lat: float
    value: float


class KrigingGridRequest(BaseModel):
    points: list[KrigingPoint] = Field(min_length=3)
    lng_min: float
    lng_max: float
    lat_min: float
    lat_max: float
    nx: int = Field(default=80, ge=2, le=400)
    ny: int = Field(default=80, ge=2, le=400)
    variogram_model: Literal[
        "linear", "power", "gaussian", "spherical", "exponential"
    ] = "spherical"


class KrigingGridResponse(BaseModel):
    nx: int
    ny: int
    # Row-major, row j = lat_min + j * dlat, column i = lng_min + i * dlng.
    grid: list[float]
    variogram_model: str
    variogram_parameters: list[float]


@app.post("/api/interpolate/kriging", response_model=KrigingGridResponse)
def interpolate_kriging(body: KrigingGridRequest):
    if body.lng_max <= body.lng_min or body.lat_max <= body.lat_min:
        raise HTTPException(status_code=422, detail="Grid bounds are empty.")

    try:
        grid, variogram_parameters = ordinary_kriging_grid(
            lngs=[p.lng for p in body.points],
            lats=[p.lat for p in body.points],
            values=[p.value for p in body.points],
            lng_min=body.lng_min,
            lng_max=body.lng_max,
            lat_min=body.lat_min,
            lat_max=body.lat_max,
            nx=body.nx,
            ny=body.ny,
            variogram_model=body.variogram_model,
        )
    except ValueError as e:
        raise HTTPException(status_code=422, detail=str(e)) from e
    except Exception as e:
        raise HTTPException(
            status_code=500, detail=f"Kriging failed: {e}"
        ) from e

    return KrigingGridResponse(
        nx=body.nx,
        ny=body.ny,
        grid=grid.ravel().tolist(),
        variogram_model=body.variogram_model,
        variogram_parameters=variogram_parameters,
    )
