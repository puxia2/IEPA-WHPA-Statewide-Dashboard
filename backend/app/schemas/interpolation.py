from typing import List, Literal

from pydantic import BaseModel, Field


class KrigingPoint(BaseModel):
    lng: float
    lat: float
    value: float


class KrigingGridRequest(BaseModel):
    points: List[KrigingPoint] = Field(min_length=3)
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
    grid: List[float]
    variogram_model: str
    variogram_parameters: List[float]
