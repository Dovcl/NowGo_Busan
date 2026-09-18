"""국립해양조사원 바다여행지수 예보(GetFcstSeaTripApiServicev2) 배치 캐시.

fetch_beach_index.py와 같은 구조 — 파라미터 없이 전국 권역을 한 번에 돌려준다. 다만
해수욕/서핑처럼 개별 해변이 아니라 구·군을 묶은 넓은 권역 단위라, 부산은 "부산북동"
(기장군/해운대구/수영구)/"부산남서"(사하구/서구/강서구/남구/영도구) 2곳뿐이다.

실행: backend/ 디렉토리에서 `python -m etl.fetch_sea_trip_index`
(.env에 TOUR_API_KEY_IAN 필요 — 이안류/해수욕/서핑지수와 같은 국립해양조사원 계정 키)
"""

from datetime import date
from urllib.parse import unquote

import requests
from geoalchemy2 import WKTElement

from core.config import settings
from core.timezone import now_kst
from db.base import Base
from db.models import SeaTripIndexCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_URL = "https://apis.data.go.kr/1192136/fcstSeaTripv2/GetFcstSeaTripApiServicev2"
_BUSAN_REGIONS = {"부산북동", "부산남서"}
_PAGE_SIZE = 300


def _fetch_all() -> list[dict]:
    key = unquote(settings.TOUR_API_KEY_IAN)
    items: list[dict] = []
    page = 1
    while True:
        res = requests.get(
            _URL, params={"serviceKey": key, "type": "json", "numOfRows": _PAGE_SIZE, "pageNo": page}, timeout=15
        )
        res.raise_for_status()
        body = res.json().get("body")
        if not body or not body.get("items"):
            break
        items.extend(body["items"]["item"])
        if len(items) >= body.get("totalCount", 0):
            break
        page += 1
    return items


def _current_half(now) -> str:
    return "오전" if now.hour < 12 else "오후"


def _pick_current_slot(slots: list[dict], today: str, half: str) -> dict:
    """오늘 날짜 + 지금 시간대(오전/오후) 슬롯을 찾고, 없으면 가장 이른 슬롯으로 대체."""
    for slot in slots:
        if slot["predcYmd"] == today and slot["predcNoonSeCd"] == half:
            return slot
    return min(slots, key=lambda s: (s["predcYmd"], s["predcNoonSeCd"]))


def main() -> None:
    Base.metadata.create_all(engine)  # sea_trip_index_cache만 신규 생성, 기존 테이블은 no-op

    now = now_kst()
    today = now.strftime("%Y-%m-%d")
    half = _current_half(now)

    by_region: dict[str, list[dict]] = {}
    for item in _fetch_all():
        if item["sareaDtlNm"] in _BUSAN_REGIONS:
            by_region.setdefault(item["sareaDtlNm"], []).append(item)

    records = []
    for name, slots in by_region.items():
        slot = _pick_current_slot(slots, today, half)
        records.append({
            "region_name": name,
            "geom": WKTElement(f"POINT({slot['lot']} {slot['lat']})", srid=4326),
            "air_temp": float(slot["avgArtmp"]),
            "wind_speed": float(slot["avgWspd"]),
            "water_temp": float(slot["avgWtem"]),
            "wave_height": float(slot["avgWvhgt"]),
            "current_speed": float(slot["avgCrsp"]),
            "tide_phase": slot["tdlvHrCn"],
            "weather_text": slot["weather"],
            "total_index": slot["totalIndex"],
            "forecast_date": date.fromisoformat(slot["predcYmd"]),
            "forecast_half": slot["predcNoonSeCd"],
            "fetched_at": now,
        })

    session = SessionLocal()
    try:
        if records:
            upsert(session, SeaTripIndexCache, records, "region_name")
            session.commit()
        print(f"sea_trip_index_cache: {len(records)}/{len(_BUSAN_REGIONS)}건")
    finally:
        session.close()


if __name__ == "__main__":
    main()
