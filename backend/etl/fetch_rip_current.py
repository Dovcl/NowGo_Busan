"""국립해양조사원 이안류 지수(GetRipCurrentApiService) 배치 캐시.

부산 해수욕장 3곳(해운대/송정/임랑)만 대상 — 전국 10개 중 부산은 이 셋뿐임
(harness/DECISIONS.md 2026-08-12, 오픈API 활용가이드 확인). 매년 6~9월에만
관측이 도는 계절 서비스라, 그 외 기간엔 호출해도 빈 결과가 정상이다.

실행: backend/ 디렉토리에서 `python -m etl.fetch_rip_current`
(.env에 TOUR_API_KEY_IAN 필요)
"""

from datetime import datetime
from urllib.parse import unquote

import requests
from geoalchemy2 import WKTElement

from core.config import settings
from db.base import Base
from db.models import RipCurrentCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_URL = "https://apis.data.go.kr/1192136/ripCurrent/GetRipCurrentApiService"
_BUSAN_BEACH_CODES = {"HAE": "해운대 해수욕장", "SONGJUNG": "송정 해수욕장", "IMRANG": "임랑 해수욕장"}


def _fetch_latest(beach_code: str) -> dict | None:
    """당일 관측치가 5분 간격으로 여러 건 오므로, 그중 가장 최근 시각 1건만 쓴다."""
    res = requests.get(
        _URL,
        params={
            "serviceKey": unquote(settings.TOUR_API_KEY_IAN),
            "type": "json",
            "beachCode": beach_code,
            "numOfRows": 300,
        },
        timeout=8,
    )
    res.raise_for_status()
    body = res.json().get("body")
    if not body or not body.get("items"):
        return None  # 비시즌(10~5월)엔 정상적으로 빈 응답

    items = body["items"]["item"]
    latest = max(items, key=lambda i: i["obsrvnDt"])
    return {
        "station_code": latest["obsvtrId"],
        "station_name": latest["obsvtrNm"],
        "geom": WKTElement(f"POINT({latest['lot']} {latest['lat']})", srid=4326),
        "index_value": latest["lastScr"],
        "risk_level": latest["lastScrCn"],
        "wave_height": latest["wvhgt"],
        "water_temp": latest["wtem"],
        "observed_at": datetime.strptime(latest["obsrvnDt"], "%Y-%m-%d %H:%M"),
        "fetched_at": datetime.now(),
    }


def main() -> None:
    Base.metadata.create_all(engine)  # rip_current_cache만 신규 생성, 기존 테이블은 no-op

    records = [r for code in _BUSAN_BEACH_CODES if (r := _fetch_latest(code))]

    session = SessionLocal()
    try:
        if records:
            upsert(session, RipCurrentCache, records, "station_code")
            session.commit()
        print(f"rip_current_cache: {len(records)}/{len(_BUSAN_BEACH_CODES)}건 (비시즌엔 0건이 정상)")
    finally:
        session.close()


if __name__ == "__main__":
    main()
