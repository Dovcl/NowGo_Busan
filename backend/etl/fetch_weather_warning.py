"""기상청 기상특보 조회서비스(getWthrWrnList) 배치 캐시.

부산 지점(stnId=159) 최근 3일치 발표 목록을 그대로 가져와 저장한다. 발표/해제 짝을
맞춰 "현재 유효한 특보"만 골라내는 로직은 MVP 범위 밖(YAGNI) — 프론트는 일단 최신순
피드로 노출한다.

실행: backend/ 디렉토리에서 `python -m etl.fetch_weather_warning`
(.env에 WEATHER_API_KEY 필요 — 기상청 API는 계정 키 하나를 여러 서비스에 재사용하지만,
data.go.kr에서 "기상청_기상특보 조회서비스" 활용신청을 별도로 승인받아야 호출 가능)
"""

from datetime import datetime, timedelta
from urllib.parse import unquote

import requests

from core.config import settings
from core.timezone import now_kst
from db.base import Base
from db.models import WeatherWarningCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_URL = "https://apis.data.go.kr/1360000/WthrWrnInfoService/getWthrWrnList"
_BUSAN_STN_ID = "159"
_LOOKBACK_DAYS = 3


def main() -> None:
    Base.metadata.create_all(engine)  # weather_warning_cache만 신규 생성, 기존 테이블은 no-op

    now = now_kst()
    res = requests.get(
        _URL,
        params={
            # data.go.kr가 이미 URL-encoding된 키를 주기 때문에, requests의 자동 인코딩과
            # 겹쳐 이중 인코딩되는 걸 막으려고 먼저 디코딩해서 넘긴다.
            "serviceKey": unquote(settings.WEATHER_API_KEY),
            "dataType": "JSON",
            "numOfRows": 100,
            "pageNo": 1,
            "stnId": _BUSAN_STN_ID,
            "fromTmFc": (now - timedelta(days=_LOOKBACK_DAYS)).strftime("%Y%m%d"),
            "toTmFc": now.strftime("%Y%m%d"),
        },
        timeout=5,
    )
    res.raise_for_status()

    body = res.json().get("response", {}).get("body")
    items = (body or {}).get("items", {}).get("item", []) if body else []

    records = [
        {
            "stn_id": _BUSAN_STN_ID,
            "tm_fc": datetime.strptime(str(item["tmFc"]), "%Y%m%d%H%M"),
            "title": item["title"],
            "fetched_at": datetime.now(),
        }
        for item in items
    ]

    session = SessionLocal()
    try:
        upsert(session, WeatherWarningCache, records, ["stn_id", "tm_fc", "title"])
        session.commit()
        print(f"weather_warning_cache: {len(records)}건")
    finally:
        session.close()


if __name__ == "__main__":
    main()
