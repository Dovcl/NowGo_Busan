from datetime import date

from pydantic import BaseModel, ConfigDict


class EventOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    start_date: date | None
    end_date: date | None
    venue: str | None
    address: str | None
    lat: float | None
    lng: float | None
    category: str | None  # festival / performance — 소스별 원 카테고리 최대한 보존
    image_url: str | None


class EventDetailOut(EventOut):
    """/events/{id} 전용. event_source_map을 거쳐 원본(event_raw)의 상세 링크까지 같이 준다.
    목록(/events)은 카드용이라 이 조인까지 매 행마다 하면 무거워지므로 상세에서만 한다."""

    source_urls: list[str]  # TourAPI는 공개 상세 페이지가 없어 비어있을 수 있음, KOPIS는 티켓 페이지
