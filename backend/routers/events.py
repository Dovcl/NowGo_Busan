from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import Event, EventRaw, EventSourceMap
from db.session import get_db
from schemas.events import EventDetailOut, EventOut

router = APIRouter()


def _event_query(db: Session):
    return db.query(
        Event.id,
        Event.title,
        Event.start_date,
        Event.end_date,
        Event.venue,
        Event.address,
        Event.category,
        Event.image_url,
        func.ST_X(Event.geom).label("lng"),
        func.ST_Y(Event.geom).label("lat"),
    )


@router.get("/events", response_model=list[EventOut], tags=["Events"])
def list_events(db: Session = Depends(get_db)):
    """축제·행사 목록(Recommend 탭 + 캘린더용). 지금은 canonical events 전체를 그대로
    반환한다 — 개수가 아직 많지 않아(수백 건) 페이지네이션/기간 필터는 필요해지면 추가."""
    rows = _event_query(db).order_by(Event.start_date).all()
    return [EventOut.model_validate(row._mapping) for row in rows]


@router.get("/events/{event_id}", response_model=EventDetailOut, tags=["Events"])
def get_event(event_id: int, db: Session = Depends(get_db)):
    row = _event_query(db).filter(Event.id == event_id).first()
    if row is None:
        raise HTTPException(status_code=404, detail="행사를 찾을 수 없습니다")

    source_urls = (
        db.query(EventRaw.source_url)
        .join(
            EventSourceMap,
            (EventSourceMap.source == EventRaw.source) & (EventSourceMap.source_event_id == EventRaw.source_event_id),
        )
        .filter(EventSourceMap.event_id == event_id, EventRaw.source_url.isnot(None))
        .distinct()
        .all()
    )

    return EventDetailOut.model_validate({**row._mapping, "source_urls": [u[0] for u in source_urls]})
