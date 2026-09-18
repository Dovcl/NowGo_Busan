"""국립해양조사원 서핑지수 예보(GetFcstSurfingApiServicev2) 배치 캐시.

fetch_beach_index.py와 같은 구조 — 파라미터 없이 전국 서핑 포인트를 한 번에 돌려주며,
그중 부산 2곳(송정/다대포)만 걸러 저장한다. 한 지점·한 시간대에도 숙련도등급
(초급/중급/상급)별로 행이 3개씩 오는데, 등급마다 totalIndex가 다를 수 있어(예: 상급만
"보통", 나머지는 "나쁨") 팀 제공 노트북(MarineScoreCalculator._prepare_surf_code)과
동일하게 그중 점수가 가장 높은 등급 1건만 골라 저장한다.

실행: backend/ 디렉토리에서 `python -m etl.fetch_surf_index`
(.env에 TOUR_API_KEY_IAN 필요 — 이안류/해수욕지수와 같은 국립해양조사원 계정 키)
"""

from datetime import date
from urllib.parse import unquote

import requests
from geoalchemy2 import WKTElement

from core.config import settings
from core.timezone import now_kst
from db.base import Base
from db.models import SurfIndexCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert
from services.environment.marine_score import level_to_score

_URL = "https://apis.data.go.kr/1192136/fcstSurfingv2/GetFcstSurfingApiServicev2"
_BUSAN_SURF_SPOTS = {"송정해수욕장", "다대포해수욕장"}
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
    """오늘 날짜 + 지금 시간대(오전/오후) 슬롯들 중, 숙련도등급(초급/중급/상급)별로
    나뉜 후보 중 점수가 가장 높은 것 하나. 오늘 슬롯이 없으면 가장 이른 슬롯으로 대체."""
    current = [s for s in slots if s["predcYmd"] == today and s["predcNoonSeCd"] == half]
    if current:
        return max(current, key=lambda s: level_to_score(s["totalIndex"]) or 0.0)
    return min(slots, key=lambda s: (s["predcYmd"], s["predcNoonSeCd"]))


def main() -> None:
    Base.metadata.create_all(engine)  # surf_index_cache만 신규 생성, 기존 테이블은 no-op

    now = now_kst()
    today = now.strftime("%Y-%m-%d")
    half = _current_half(now)

    by_spot: dict[str, list[dict]] = {}
    for item in _fetch_all():
        if item["surfPlcNm"] in _BUSAN_SURF_SPOTS:
            by_spot.setdefault(item["surfPlcNm"], []).append(item)

    records = []
    for name, slots in by_spot.items():
        slot = _pick_current_slot(slots, today, half)
        records.append({
            "station_name": name,
            "geom": WKTElement(f"POINT({slot['lot']} {slot['lat']})", srid=4326),
            "wave_height": float(slot["avgWvhgt"]),
            "wave_period": float(slot["avgWvpd"]),
            "water_temp": float(slot["avgWtem"]),
            "wind_speed": float(slot["avgWspd"]),
            "skill_grade": slot["grdCn"],
            "total_index": slot["totalIndex"],
            "forecast_date": date.fromisoformat(slot["predcYmd"]),
            "forecast_half": slot["predcNoonSeCd"],
            "fetched_at": now,
        })

    session = SessionLocal()
    try:
        if records:
            upsert(session, SurfIndexCache, records, "station_name")
            session.commit()
        print(f"surf_index_cache: {len(records)}/{len(_BUSAN_SURF_SPOTS)}건")
    finally:
        session.close()


if __name__ == "__main__":
    main()
