from datetime import datetime, timezone

from fastapi import APIRouter

from app.schemas.hello import HelloRequest, HelloResponse

router = APIRouter(tags=["health"])


@router.get("/")
def root():
    return {
        "service": "ISWS WQ Dashboard API",
        "status": "ok",
        "docs": "/docs",
    }


@router.get("/health")
def health():
    return {
        "status": "healthy",
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }


@router.get("/api/hello", response_model=HelloResponse)
def hello_get(name: str = "world"):
    return HelloResponse(
        message=f"Hello, {name}!",
        received_at=datetime.now(timezone.utc).isoformat(),
    )


@router.post("/api/hello", response_model=HelloResponse)
def hello_post(body: HelloRequest):
    return HelloResponse(
        message=f"Hello, {body.name}!",
        received_at=datetime.now(timezone.utc).isoformat(),
    )
