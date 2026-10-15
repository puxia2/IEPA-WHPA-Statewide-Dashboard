from fastapi import APIRouter

from app.database.database_accessor_sqlalchemy import dbqISWS
from app.dependencies import SettingsDep

router = APIRouter(prefix="/api", tags=["database"])


@router.get("/test-db")
def test_db(settings: SettingsDep):
    db = dbqISWS(
        Driver=settings.db_driver,
        Server=settings.db_server,
        Database=settings.db_name,
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
