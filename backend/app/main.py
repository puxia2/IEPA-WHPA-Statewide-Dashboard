from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.routers import database, health, interpolation, parquet

settings = get_settings()

app = FastAPI(
    title="ISWS WQ Dashboard API",
    description="Backend API for computation-heavy water quality operations",
    version="0.0.1",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(health.router)
app.include_router(database.router)
app.include_router(parquet.router)
app.include_router(interpolation.router)
