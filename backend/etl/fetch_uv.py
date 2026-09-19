"""기상청 생활기상지수(getUVIdxV5) 배치 캐시 — 부산 전 지역(구·군·동) 단위.

팀 노트북(Data_Preprocess.ipynb, `UVScoreCalculator`)과 같은 방식: areaNo를 비운 채
전국 자료를 한 번에 받아 부산(areaNo 26...)만 추리고, 각 지역마다 "현재 시각을 넘지 않는
가장 최근 예보 열(h0/h3/h6...)"의 값을 그 지역의 지금 자외선지수로 쓴다.
관광지 ↔ areaNo 매칭은 services/environment/uv_area.py.
(2600000000 = 부산 전체 대표값 — 홈 화면 등 기존 조회는 이 행을 그대로 쓴다.)

실행: backend/ 디렉토리에서 `python -m etl.fetch_uv`
(.env에 WEATHER_API_KEY 필요 — 기상청 API는 계정 키 하나를 여러 서비스에 재사용)
"""

from datetime import datetime
from urllib.parse import unquote

import requests

from core.config import settings
from core.timezone import now_kst
from db.base import Base
from db.models import UvIndexCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_URL = "https://apis.data.go.kr/1360000/LivingWthrIdxServiceV5/getUVIdxV5"
_BUSAN_PREFIX = "26"


def _select_forecast_hour(base_date: str, request_time: str, forecast_hours: list[int]) -> int | None:
    """노트북 `_select_forecast_column`과 동일 — 발표 기준시각(base_date)부터 request_time까지
    경과한 시간 이하 중 가장 큰 예보 시간을 고르고, 없으면 가장 작은 걸 고른다."""
    if not forecast_hours:
        return None
    base = datetime.strptime(base_date, "%Y%m%d%H")
    target = datetime.strptime(request_time, "%Y%m%d%H")
    diff_hour = max((target - base).total_seconds() / 3600.0, 0)
    past = [h for h in forecast_hours if h <= diff_hour]
    return max(past) if past else min(forecast_hours)


def _uv_index(item: dict, request_time: str) -> int | None:
    hours = sorted(int(k[1:]) for k in item if k.startswith("h") and k[1:].isdigit())
    selected = _select_forecast_hour(item["date"], request_time, hours)
    value = item.get(f"h{selected}") if selected is not None else None
    return int(value) if value not in (None, "") else None


def main() -> None:
    Base.metadata.create_all(engine)  # uv_index_cache만 신규 생성, 기존 테이블은 no-op

    request_time = now_kst().strftime("%Y%m%d%H")
    res = requests.get(
        _URL,
        params={
            # data.go.kr가 이미 URL-encoding된 키를 주기 때문에, requests의 자동 인코딩과
            # 겹쳐 이중 인코딩되는 걸 막으려고 먼저 디코딩해서 넘긴다.
            "serviceKey": unquote(settings.WEATHER_API_KEY),
            "dataType": "JSON",
            "numOfRows": 5000,
            "pageNo": 1,
            "areaNo": "",
            "time": request_time,
        },
        timeout=60,
    )
    res.raise_for_status()
    items = res.json()["response"]["body"]["items"]["item"]

    now = datetime.now()
    by_area: dict[str, dict] = {}
    for item in items:
        area_no = str(item["areaNo"]).strip()
        if not area_no.startswith(_BUSAN_PREFIX):
            continue
        record = {"area_no": area_no, "uv_index": _uv_index(item, request_time), "fetched_at": now}
        # 같은 areaNo가 중복이면 값이 있는 첫 행 우선(노트북과 동일)
        if area_no not in by_area or (by_area[area_no]["uv_index"] is None and record["uv_index"] is not None):
            by_area[area_no] = record

    session = SessionLocal()
    try:
        upsert(session, UvIndexCache, list(by_area.values()), "area_no")
        session.commit()
        print(f"uv_index_cache: {len(by_area)}개 지역 (기준 {request_time})")
    finally:
        session.close()


if __name__ == "__main__":
    main()
