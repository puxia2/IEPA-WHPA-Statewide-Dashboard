from fastapi import APIRouter, HTTPException

from app.schemas.interpolation import KrigingGridRequest, KrigingGridResponse
from app.services.kriging import ordinary_kriging_grid

router = APIRouter(prefix="/api/interpolate", tags=["interpolation"])


@router.post("/kriging", response_model=KrigingGridResponse)
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
