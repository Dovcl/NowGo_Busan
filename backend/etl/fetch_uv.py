"""기상청 생활기상지수(getUVIdxV5) 배치 캐시.

MVP는 부산 전체 값(area_no=2600000000) 하나만 수집한다. 구·군 단위(법정동코드
5자리+00000)로도 조회는 되지만(harness/DECISIONS.md 2026-08-12 확인 완료), 자외선은
도시 내 지역 편차가 크지 않은 지표라 지금 세분화하는 건 과설계로 판단해 보류.

실행: backend/ 디렉토리에서 `python -m etl.fetch_uv`
(.env에 WEATHER_API_KEY 필요 — 기상청 API는 계정 키 하나를 여러 서비스에 재사용)
"""

from datetime import datetime
from urllib.parse import unquote

import requests

from core.config import settings
from db.base import Base
from db.models import UvIndexCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_URL = "https://apis.data.go.kr/1360000/LivingWthrIdxServiceV5/getUVIdxV5"
_BUSAN_AREA_NO = "2600000000"


def _latest_3h_slot(now: datetime) -> datetime:
    """자외선지수는 3시간 간격(0,3,6..21시)으로 발표된다."""
    return now.replace(hour=(now.hour // 3) * 3, minute=0, second=0, microsecond=0)


def main() -> None:
    Base.metadata.create_all(engine)  # uv_index_cache만 신규 생성, 기존 테이블은 no-op

    res = requests.get(
        _URL,
        params={
            # data.go.kr가 이미 URL-encoding된 키를 주기 때문에, requests의 자동 인코딩과
            # 겹쳐 이중 인코딩되는 걸 막으려고 먼저 디코딩해서 넘긴다.
            "serviceKey": unquote(settings.WEATHER_API_KEY),
            "dataType": "JSON",
            "numOfRows": 1,
            "pageNo": 1,
            "areaNo": _BUSAN_AREA_NO,
            "time": _latest_3h_slot(datetime.now()).strftime("%Y%m%d%H"),
        },
        timeout=5,
    )
    res.raise_for_status()
    item = res.json()["response"]["body"]["items"]["item"][0]
    record = {
        "area_no": _BUSAN_AREA_NO,
        "uv_index": int(item["h0"]) if item.get("h0") not in (None, "") else None,
        "fetched_at": datetime.now(),
    }

    session = SessionLocal()
    try:
        upsert(session, UvIndexCache, [record], "area_no")
        session.commit()
        print(f"uv_index_cache: {record}")
    finally:
        session.close()


if __name__ == "__main__":
    main()
