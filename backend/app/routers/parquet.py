from fastapi import APIRouter, HTTPException

from app.dependencies import S3ClientDep, SettingsDep
from app.services.s3 import read_parquet

router = APIRouter(prefix="/api", tags=["parquet"])


@router.get("/test-parquet")
def test_parquet(client: S3ClientDep, settings: SettingsDep):
    try:
        df = read_parquet(
            client,
            bucket=settings.s3_bucket,
            prefix=settings.s3_prefix,
            dataset="EStL_AllDataJoin2",
            columns=["Station_ID", "Name", "Lat", "Long"],
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e

    return {
        "rows": len(df),
        "columns": df.columns.tolist(),
        "preview": df.head(5).to_dict(orient="records"),
    }
