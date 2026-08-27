from datetime import datetime, timezone

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

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
