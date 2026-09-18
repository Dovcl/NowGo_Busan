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


class EventSourceLink(BaseModel):
    source: str  # 'tourapi' / 'dabom' / 'kopis' — 프론트가 라벨(다봄/KOPIS 등)로 매핑
    url: str


class EventDetailOut(EventOut):
    """/events/{id} 전용. event_source_map을 거쳐 원본(event_raw)의 상세 링크까지 같이 준다.
    목록(/events)은 카드용이라 이 조인까지 매 행마다 하면 무거워지므로 상세에서만 한다."""

    # 여러 소스에서 매칭돼 병합된 행사는 링크가 2개 이상일 수 있어(다봄+KOPIS 등)
    # 어느 사이트로 가는 링크인지 구분할 수 있게 source를 같이 준다.
    source_urls: list[EventSourceLink]
