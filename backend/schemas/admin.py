from datetime import date, datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict


class DedupCandidateSideOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    source: str
    source_event_id: str
    title: str
    start_date: date | None
    end_date: date | None
    venue: str | None
    image_url: str | None


class DedupCandidateOut(BaseModel):
    id: int
    total_score: float
    title_score: float
    date_score: float
    venue_score: float
    a: DedupCandidateSideOut
    b: DedupCandidateSideOut


class DedupResolveRequest(BaseModel):
    decision: Literal["SAME", "DIFFERENT"]


class AdminUserOut(BaseModel):
    id: int
    nickname: str
    email: str | None
    role: Literal["tourist", "admin"]
    signup_source: Literal["kakao", "google", "email"]
    created_at: datetime
    is_withdrawn: bool


class AdminUserListOut(BaseModel):
    items: list[AdminUserOut]
    total: int


class AdminUserStatsOut(BaseModel):
    total_users: int
    new_today: int


class AdminUserCreateRequest(BaseModel):
    nickname: str
    email: str
    password: str
    role: Literal["tourist", "admin"] = "tourist"


class AdminUserRoleUpdateRequest(BaseModel):
    ids: list[int]
    role: Literal["tourist", "admin"]


class AdminUserIdsRequest(BaseModel):
    ids: list[int]
