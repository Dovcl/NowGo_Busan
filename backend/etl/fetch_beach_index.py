"""국립해양조사원 해수욕지수 예보(GetFcstBeachApiServicev2) 배치 캐시.

이안류(fetch_rip_current.py)와 달리 beachCode 파라미터가 없어 전국 해수욕장을
한 번에 돌려준다 — 그중 부산 7곳(해운대/광안리/송정/다대포/일광/임랑/송도)만 걸러
저장한다. 예보 자료라 해수욕장마다 여러 날짜×오전/오후 슬롯이 함께 오는데, 그중
"오늘, 지금 시간대(오전/오후)" 슬롯 하나만 골라 저장한다.

실행: backend/ 디렉토리에서 `python -m etl.fetch_beach_index`
(.env에 TOUR_API_KEY_IAN 필요 — 이안류와 같은 국립해양조사원 계정 키)
"""

from datetime import date
from urllib.parse import unquote

import requests
from geoalchemy2 import WKTElement

from core.config import settings
from core.timezone import now_kst
from db.base import Base
from db.models import BeachIndexCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_URL = "https://apis.data.go.kr/1192136/fcstBeachv2/GetFcstBeachApiServicev2"
_BUSAN_BEACHES = {"해운대해수욕장", "광안리해수욕장", "송정해수욕장", "다대포해수욕장", "일광해수욕장", "임랑해수욕장", "송도해수욕장"}
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
    Base.metadata.create_all(engine)  # beach_index_cache만 신규 생성, 기존 테이블은 no-op

    now = now_kst()
    today = now.strftime("%Y-%m-%d")
    half = _current_half(now)

    by_beach: dict[str, list[dict]] = {}
    for item in _fetch_all():
        if item["bbchNm"] in _BUSAN_BEACHES:
            by_beach.setdefault(item["bbchNm"], []).append(item)

    records = []
    for name, slots in by_beach.items():
        slot = _pick_current_slot(slots, today, half)
        records.append({
            "station_name": name,
            "geom": WKTElement(f"POINT({slot['lot']} {slot['lat']})", srid=4326),
            "wave_height": float(slot["maxWvhgt"]),
            "water_temp": float(slot["avgWtem"]),
            "air_temp": float(slot["avgArtmp"]),
            "wind_speed": float(slot["maxWspd"]),
            "open_status": slot["opnStat"],
            "total_index": slot["totalIndex"],
            "forecast_date": date.fromisoformat(slot["predcYmd"]),
            "forecast_half": slot["predcNoonSeCd"],
            "fetched_at": now,
        })

    session = SessionLocal()
    try:
        if records:
            upsert(session, BeachIndexCache, records, "station_name")
            session.commit()
        print(f"beach_index_cache: {len(records)}/{len(_BUSAN_BEACHES)}건")
    finally:
        session.close()


if __name__ == "__main__":
    main()
