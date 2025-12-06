from pydantic import BaseModel
from typing import Optional, Literal, Dict


class BailStatus(BaseModel):
    actual: int
    target: int
    state: int  # 0=IDLE,1=FEEDING,2=DONE,3=JAM


class HardwareStatus(BaseModel):
    b1: Optional[BailStatus] = None
    b2: Optional[BailStatus] = None


class FeedCommand(BaseModel):
    bail: int
    grams: int


class DraftCommand(BaseModel):
    direction: Literal["left", "right", "straight"]


class HealthResponse(BaseModel):
    ok: bool = True


class EidEvent(BaseModel):
    eid: str
    timestamp: str


class GatewayFrame(BaseModel):
    type: str
    data: Dict
