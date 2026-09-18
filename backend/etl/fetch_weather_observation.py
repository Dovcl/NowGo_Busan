"""기상청 API허브 지상관측 실황(기온/1시간강수량/10분풍속) 배치 캐시.

data.go.kr 단기예보(fetch_weather.py)는 격자 셀 하나당 API를 한 번씩 불러야 하지만,
이 API허브 엔드포인트는 관측종류(ta_chi/rn_60m/ws_10m) 하나당 전국 격자를 통째로 준다
— 그래서 필요한 셀 개수와 무관하게 호출은 관측종류 수(3)만큼만 하면 된다. 격자<->위경도
변환식이 없어(비균일 재투영), 부산 권역 셀은 참조표(weather_obs_grid_cell,
etl/seed_weather_obs_grid.py로 미리 시딩)에서 최근접 매칭으로 찾는다.

실행: backend/ 디렉토리에서 `python -m etl.fetch_weather_observation`
(.env에 KMA_API_KEY 필요 — data.go.kr WEATHER_API_KEY와는 다른 키, API허브 전용)
"""

import array
import logging
from datetime import datetime, timedelta

import numpy as np
import requests
from sqlalchemy import func

from core.config import settings
from core.timezone import now_kst
from db.base import Base
from db.environment_queries import nearest_weather_obs_grid_cell
from db.models import TourSpot, WeatherObsCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

logger = logging.getLogger(__name__)

_URL = "https://apihub.kma.go.kr/api/typ01/cgi-bin/url/nph-sfc_obs_nc_api"
# obs 파라미터명 -> WeatherObsCache 컬럼명
_OBS_FIELDS = {"ta_chi": "temperature", "rn_60m": "rainfall_60m", "ws_10m": "wind_speed"}
_LOOKBACK_STEPS = 7  # 5분 간격으로 최대 30분 전까지 재시도 (fetch_weather.py의 base_date 폴백과 같은 목적)


def _base_tm(now: datetime) -> datetime:
    """관측 자료 게시 지연을 감안해 현재시각 60분 전을 5분 단위로 내림."""
    target = now - timedelta(minutes=60)
    return target.replace(minute=(target.minute // 5) * 5, second=0, microsecond=0)


def _parse_grid(text: str) -> np.ndarray:
    """API허브 ASCII 실황격자 응답 -> 2차원 배열. 헤더 첫 줄에 (nx, ny), 본문은 한 줄에
    10개씩(응답 전체로는 42만 줄) 쉼표로 끊어 나온다. 결측치는 -999로 옴.

    한 번에 문자열 전체를 토큰화하면(예전 방식) nx*ny(약 420만)개짜리 파이썬 문자열
    리스트가 생기는데, 이게 관측종류 3개(ta_chi/rn_60m/ws_10m)만큼 쌓이면서 cron
    메모리 한도(512MB)를 넘겨 실제로 배치가 죽는 걸 프로덕션에서 확인함(2026-09-19).
    그래서 줄 단위로 즉시 array.array(더블 배열, 파이썬 객체 오버헤드 없음)에 흘려
    넣어 한 번에 살아있는 토큰 개수를 "그 줄만큼"으로 줄인다."""
    stripped = text.strip()
    if not stripped or stripped.lower().startswith("error"):
        raise ValueError(f"API허브 응답 오류: {stripped[:200]}")

    lines = text.splitlines()
    header = [x for x in lines[0].replace("=", "").split(",") if x.strip()]
    if len(header) < 2:
        raise ValueError(f"격자 헤더를 읽을 수 없습니다: {lines[0]}")
    nx, ny = int(header[0]), int(header[1])

    values = array.array("d")
    for line in lines[1:]:
        line = line.strip().replace("=", "")
        if not line:
            continue
        values.extend(float(tok) for tok in line.split(",") if tok)

    if len(values) != nx * ny:
        raise ValueError(f"격자 개수 불일치: {len(values)} != {nx * ny}")

    grid = np.frombuffer(values, dtype=np.float64).reshape(ny, nx).copy()
    grid[np.isclose(grid, -999.0)] = np.nan
    return grid


def _fetch_grid(obs: str, tm: str) -> np.ndarray | None:
    res = requests.get(
        _URL,
        params={"obs": obs, "disp": "A", "authKey": settings.KMA_API_KEY, "tm": tm},
        timeout=60,
    )
    res.raise_for_status()
    try:
        return _parse_grid(res.text)
    except ValueError as e:
        logger.debug(f"API허브 NO_DATA: {obs} {tm} ({e})")
        return None


def _target_cells(session) -> dict[tuple[int, int], None]:
    """tour_spot 좌표별 최근접 관측격자 셀 (중복 제거). 좌표가 격자 범위 밖이거나
    없는 소수 행은 nearest_weather_obs_grid_cell이 그냥 가장 가까운 셀을 돌려주므로
    fetch_weather.py의 nx/ny 유효범위 필터 같은 별도 처리가 필요 없다."""
    rows = session.query(func.ST_Y(TourSpot.geom), func.ST_X(TourSpot.geom)).filter(TourSpot.geom.isnot(None)).all()
    cells: dict[tuple[int, int], None] = {}
    for lat, lon in rows:
        cell = nearest_weather_obs_grid_cell(session, lat, lon)
        if cell:
            cells[(cell.grid_x, cell.grid_y)] = None
    return cells


def main() -> None:
    Base.metadata.create_all(engine)  # weather_obs_cache만 신규 생성, 기존 테이블은 no-op

    session = SessionLocal()
    try:
        cells = _target_cells(session)
        if not cells:
            logger.warning("fetch_weather_observation: 대상 격자 셀 없음")
            return

        now = now_kst()
        grids = None
        used_tm = None
        for step in range(_LOOKBACK_STEPS):
            tm = (_base_tm(now) - timedelta(minutes=5 * step)).strftime("%Y%m%d%H%M")
            fetched = {obs: _fetch_grid(obs, tm) for obs in _OBS_FIELDS}
            if all(g is not None for g in fetched.values()):
                grids, used_tm = fetched, tm
                break

        if grids is None:
            logger.warning("fetch_weather_observation: 사용 가능한 관측격자를 찾지 못함")
            return

        fetched_at = datetime.now()
        records = []
        for grid_x, grid_y in cells:
            record = {"grid_x": grid_x, "grid_y": grid_y, "fetched_at": fetched_at}
            for obs, field in _OBS_FIELDS.items():
                value = grids[obs][grid_y, grid_x]
                record[field] = None if np.isnan(value) else float(value)
            records.append(record)

        upsert(session, WeatherObsCache, records, ["grid_x", "grid_y"])
        session.commit()
        logger.info(f"weather_obs_cache: {len(records)}/{len(cells)}건 (tm={used_tm})")
    except Exception as e:
        logger.error(f"fetch_weather_observation error: {e}", exc_info=True)
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
