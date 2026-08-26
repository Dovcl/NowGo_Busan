from datetime import date
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
