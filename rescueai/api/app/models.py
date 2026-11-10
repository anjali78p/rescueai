from typing import Literal, Optional
from pydantic import BaseModel, Field

Priority = Literal["low", "medium", "high", "critical"]
PRIORITY_RANK = {"low": 0, "medium": 1, "high": 2, "critical": 3}
RANK_PRIORITY = {v: k for k, v in PRIORITY_RANK.items()}

Status = Literal["new", "accepted", "en_route", "reached", "resolved"]
# Accept -> En Route -> Reached -> Resolve (strictly linear)
TRANSITIONS: dict[str, list[str]] = {
    "new": ["accepted"],
    "accepted": ["en_route"],
    "en_route": ["reached"],
    "reached": ["resolved"],
    "resolved": [],
}
ACTIVE_STATUSES = ("accepted", "en_route", "reached")

EMAIL_RE = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class Loc(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lng: float = Field(ge=-180, le=180)
    accuracy: Optional[float] = Field(default=None, ge=0)
    captured_at: Optional[str] = None


class SosIn(BaseModel):
    id: str = Field(pattern=r"^[A-Za-z0-9_-]{8,64}$")  # client-generated, makes sync idempotent
    severity: Priority = "high"
    message: str = Field(default="", max_length=1000)
    people: Optional[int] = Field(default=None, ge=1, le=500)
    location: Optional[Loc] = None
    location_at_sync: Optional[Loc] = None
    created_at: Optional[str] = None
    share_profile: bool = False


class SyncIn(BaseModel):
    items: list[SosIn] = Field(min_length=1, max_length=50)


class RegisterIn(BaseModel):
    name: str = Field(min_length=1, max_length=80)
    email: str = Field(pattern=EMAIL_RE, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    phone: Optional[str] = Field(default=None, max_length=20)
    emergency_contact: Optional[str] = Field(default=None, max_length=120)
    medical_notes: Optional[str] = Field(default=None, max_length=500)


class LoginIn(BaseModel):
    email: str
    password: str


class StatusIn(BaseModel):
    status: Status
    squad_id: Optional[str] = None
    note: Optional[str] = Field(default=None, max_length=300)


class BroadcastIn(BaseModel):
    title: str = Field(min_length=1, max_length=100)
    message: str = Field(min_length=1, max_length=500)
    level: Literal["info", "warning", "critical"] = "info"


class TriagePreviewIn(BaseModel):
    message: str = Field(max_length=1000)
    people: Optional[int] = Field(default=None, ge=1, le=500)
    severity: Priority = "high"
