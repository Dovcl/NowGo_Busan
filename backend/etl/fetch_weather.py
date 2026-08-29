"""기상청 초단기예보(getUltraSrtFcst) 배치 캐시.

초단기예보는 매시 30분 발표되며, API 조회는 보수적으로 45분 이후 발표분을 사용한다.
부산 전역을 별도로 그리드 스캔하지 않고, DB에 이미 있는 tour_spot 좌표들이 속한 격자
셀만 수집한다 — 관광지 분포 자체가 이미 부산 전역에 퍼져 있어 이걸 그대로 재사용하면
충분하고, 임의의 GPS 좌표는 조회 시점에 이 중 최근접 셀로 매칭된다(services/environment/lookup.py).

실행: backend/ 디렉토리에서 `python -m etl.fetch_weather` (또는 스케줄러가 매시간 자동 실행)
(.env에 WEATHER_API_KEY 필요)
"""

import logging
from collections import defaultdict
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

logger = logging.getLogger(__name__)

_URL = "https://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getUltraSrtFcst"
# 한 발표시각 응답엔 이후 6시간치 예보가 들어있음(1시간 간격, 최대 6개 슬롯).
_NUM_ROWS = 1000
_FORECAST_HOURS = 6
_FORECAST_STEP_HOURS = 1
_BASE_FALLBACK_HOURS = 6


def _latest_base_datetime(now: datetime) -> datetime:
    """조회 가능한 최신 초단기예보 발표시각(HH30)을 돌려준다."""
    if now.minute >= 45:
        return now.replace(minute=30, second=0, microsecond=0)
    return (now - timedelta(hours=1)).replace(minute=30, second=0, microsecond=0)


def _base_datetime_candidates(now: datetime) -> list[datetime]:
    """최신 발표분이 아직 NO_DATA이면 직전 발표분으로 내려가며 재시도한다."""
    latest = _latest_base_datetime(now)
    return [latest - timedelta(hours=i) for i in range(_BASE_FALLBACK_HOURS)]


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
            "numOfRows": _NUM_ROWS,
            "pageNo": 1,
            "base_date": base_date,
            "base_time": base_time,
            "nx": nx,
            "ny": ny,
        },
        timeout=5,
    )
    res.raise_for_status()

    data = res.json()
    # API 에러 코드 확인
    if data.get("response", {}).get("header", {}).get("resultCode") != "00":
        code = data["response"]["header"]["resultCode"]
        msg = data["response"]["header"]["resultMsg"]
        logger.debug(f"API NO_DATA: {code} {msg} (nx={nx}, ny={ny})")
        return None

    body = data.get("response", {}).get("body")
    if not body or "items" not in body:
        return None

    # (fcstDate, fcstTime)별로 카테고리를 묶는다 — 응답이 "슬롯 × 카테고리" 평면 목록이라서.
    slots = defaultdict(dict)
    for item in body["items"]["item"]:
        slots[(item["fcstDate"], item["fcstTime"])][item["category"]] = item["fcstValue"]

    def _slot_dt(date_time):
        return datetime.strptime(f"{date_time[0]}{date_time[1]}", "%Y%m%d%H%M")

    ordered = sorted(slots.items(), key=lambda kv: _slot_dt(kv[0]))
    if not ordered:
        return None

    # "지금" 스냅샷은 가장 이른 슬롯 값을 그대로 쓴다.
    (cur_date, cur_time), current = ordered[0]

    # 초단기예보의 다음 6시간 예보를 시간별로 뽑는다.
    forecast = []
    for (date_, time_), values in ordered:
        if int(time_[:2]) % _FORECAST_STEP_HOURS != 0:
            continue
        if "T1H" not in values or "SKY" not in values:
            continue
        forecast.append({
            "fcst_date": date_,
            "fcst_time": time_,
            "temperature": float(values["T1H"]),
            "sky": int(values["SKY"]),
            "precipitation_type": int(values.get("PTY", 0)),
            "precipitation_prob": None,
        })
        if len(forecast) >= _FORECAST_HOURS // _FORECAST_STEP_HOURS:
            break

    return {
        "nx": nx,
        "ny": ny,
        "temperature": float(current["T1H"]),
        "humidity": float(current["REH"]),
        "wind_speed": float(current["WSD"]),
        "precipitation_prob": None,
        "sky": int(current["SKY"]),
        "precipitation_type": int(current["PTY"]),
        "forecast": forecast,
        "fetched_at": datetime.now(),
    }


def main() -> None:
    Base.metadata.create_all(engine)  # weather_cache만 신규 생성, 기존 테이블은 no-op

    session = SessionLocal()
    try:
        cells = _grid_cells(session)
        records = []
        base_date = base_time = None
        for base_dt in _base_datetime_candidates(datetime.now()):
            base_date, base_time = base_dt.strftime("%Y%m%d"), base_dt.strftime("%H%M")
            records = [r for nx, ny in cells if (r := _fetch_cell(nx, ny, base_date, base_time))]
            if records:
                break

        if not records:
            logger.warning(f"weather_cache: 0/{len(cells)}건 (latest base: {base_date} {base_time})")
            return

        upsert(session, WeatherCache, records, ["nx", "ny"])
        session.commit()
        logger.info(f"weather_cache: {len(records)}/{len(cells)}건 (base: {base_date} {base_time})")
    except Exception as e:
        logger.error(f"fetch_weather error: {e}", exc_info=True)
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
