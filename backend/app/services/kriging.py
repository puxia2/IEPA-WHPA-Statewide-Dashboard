from __future__ import annotations

import math
from typing import Sequence

import numpy as np
from pykrige.ok import OrdinaryKriging

KM_PER_DEG_LAT = 110.574
KM_PER_DEG_LNG_AT_EQUATOR = 111.320


def ordinary_kriging_grid(
    lngs: Sequence[float],
    lats: Sequence[float],
    values: Sequence[float],
    lng_min: float,
    lng_max: float,
    lat_min: float,
    lat_max: float,
    nx: int,
    ny: int,
    variogram_model: str = "spherical",
) -> tuple[np.ndarray, list[float]]:
    """
    Interpolate station values onto a regular nx-by-ny lng/lat grid with
    Ordinary Kriging.

    Returns the grid as an array of shape (ny, nx), where row j is
    lat_min + j * dlat and column i is lng_min + i * dlng, plus the fitted
    variogram parameters.
    """
    coords = np.column_stack(
        [np.asarray(lngs, dtype=float), np.asarray(lats, dtype=float)]
    )
    vals = np.asarray(values, dtype=float)

    # Co-located stations make the kriging matrix singular, so average them.
    unique_coords, inverse = np.unique(coords, axis=0, return_inverse=True)
    inverse = inverse.ravel()
    vals = np.bincount(inverse, weights=vals) / np.bincount(inverse)

    if len(vals) < 3:
        raise ValueError("Ordinary Kriging needs at least 3 distinct station locations.")

    if np.ptp(vals) == 0:
        return np.full((ny, nx), vals[0]), []

    # Krige in local kilometres rather than raw degrees: at ~38.6°N a degree of
    # longitude is ~22% shorter than a degree of latitude, and the variogram
    # assumes isotropic distances.
    lat0 = math.radians((lat_min + lat_max) / 2)
    kx = KM_PER_DEG_LNG_AT_EQUATOR * math.cos(lat0)
    ky = KM_PER_DEG_LAT

    x = (unique_coords[:, 0] - lng_min) * kx
    y = (unique_coords[:, 1] - lat_min) * ky
    gridx = np.linspace(0.0, (lng_max - lng_min) * kx, nx)
    gridy = np.linspace(0.0, (lat_max - lat_min) * ky, ny)

    ok = OrdinaryKriging(
        x,
        y,
        vals,
        variogram_model=variogram_model,
        enable_plotting=False,
        verbose=False,
    )
    z, _variance = ok.execute("grid", gridx, gridy)

    grid = np.ma.filled(np.ma.asarray(z, dtype=float), np.nan)
    if not np.all(np.isfinite(grid)):
        grid = np.where(np.isfinite(grid), grid, float(np.mean(vals)))

    return grid, [float(p) for p in ok.variogram_model_parameters]
