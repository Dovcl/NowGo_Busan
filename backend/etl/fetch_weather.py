"""기상청 단기예보(getVilageFcst) 배치 캐시.

부산 전역을 별도로 그리드 스캔하지 않고, DB에 이미 있는 tour_spot 좌표들이 속한 격자
셀만 수집한다 — 관광지 분포 자체가 이미 부산 전역에 퍼져 있어 이걸 그대로 재사용하면
충분하고(harness/DECISIONS.md 2026-08-12), 임의의 GPS 좌표는 조회 시점에 이 중
최근접 셀로 매칭된다(services/environment/lookup.py).

실행: backend/ 디렉토리에서 `python -m etl.fetch_weather`
(.env에 WEATHER_API_KEY 필요)
"""

from datetime import datetime, timedelta
from urllib.parse import unquote

import requests
from sqlalchemy import func

from core.config import settings
from db.base import Base
from db.models import TourSpot, WeatherCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert
from services.environment.grid import latlon_to_grid

_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst"
_BASE_HOURS = [2, 5, 8, 11, 14, 17, 20, 23]  # 단기예보 발표시각(3시간 간격)
_CATEGORIES = 12  # 한 발표시각당 항목 수(TMP/REH/WSD/POP 등) — numOfRows로 그대로 씀


def _latest_base_datetime(now: datetime) -> datetime:
    """이미 발표되고(API는 발표 후 10분 뒤부터 제공) 지금 시각보다 과거인 것 중 가장 최근 것."""
    today = [now.replace(hour=h, minute=10, second=0, microsecond=0) for h in _BASE_HOURS]
    yesterday = [c - timedelta(days=1) for c in today]
    return max(c for c in today + yesterday if c <= now)


def _grid_cells(session) -> set[tuple[int, int]]:
    """전국 격자 범위(nx 1~149, ny 1~253) 밖은 걸러낸다 — tour_spot 중 좌표가 아예
    없거나(코스형 콘텐츠) 잘못 지오코딩된 소수 행이 섞여 있어서 그대로 두면 그 셀 요청이
    API 에러로 떨어진다."""
    rows = session.query(func.ST_Y(TourSpot.geom), func.ST_X(TourSpot.geom)).all()
    cells = {latlon_to_grid(lat, lon) for lat, lon in rows}
    return {(nx, ny) for nx, ny in cells if 1 <= nx <= 149 and 1 <= ny <= 253}


def _fetch_cell(nx: int, ny: int, base_date: str, base_time: str) -> dict | None:
    res = requests.get(
        _URL,
        params={
            # data.go.kr가 이미 URL-encoding된 키를 주기 때문에, requests의 자동 인코딩과
            # 겹쳐 이중 인코딩되는 걸 막으려고 먼저 디코딩해서 넘긴다.
            "serviceKey": unquote(settings.WEATHER_API_KEY),
            "dataType": "JSON",
            "numOfRows": _CATEGORIES,
            "pageNo": 1,
            "base_date": base_date,
            "base_time": base_time,
            "nx": nx,
            "ny": ny,
        },
        timeout=5,
    )
    res.raise_for_status()
    body = res.json()["response"]["body"]
    if "items" not in body:
        return None
    values = {item["category"]: item["fcstValue"] for item in body["items"]["item"]}
    return {
        "nx": nx,
        "ny": ny,
        "temperature": float(values["TMP"]),
        "humidity": float(values["REH"]),
        "wind_speed": float(values["WSD"]),
        "precipitation_prob": float(values["POP"]),
        "fetched_at": datetime.now(),
    }


def main() -> None:
    Base.metadata.create_all(engine)  # weather_cache만 신규 생성, 기존 테이블은 no-op

    session = SessionLocal()
    try:
        cells = _grid_cells(session)
        base_dt = _latest_base_datetime(datetime.now())
        base_date, base_time = base_dt.strftime("%Y%m%d"), base_dt.strftime("%H00")

        records = [r for nx, ny in cells if (r := _fetch_cell(nx, ny, base_date, base_time))]
        upsert(session, WeatherCache, records, ["nx", "ny"])
        session.commit()
        print(f"weather_cache: {len(records)}/{len(cells)}건")
    finally:
        session.close()


if __name__ == "__main__":
    main()
