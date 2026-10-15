from pydantic import BaseModel


class HelloRequest(BaseModel):
    name: str = "world"


class HelloResponse(BaseModel):
    message: str
    received_at: str
