"""에어코리아 측정소 좌표 + 실시간 측정값 배치 캐시.

측정소 좌표(자주 안 바뀜)와 측정값(매번 갱신)을 두 API에서 각각 받아 station_name으로
합친 뒤 한 번에 upsert한다 — 두 스크립트로 나누면 서로 다른 컬럼만 갱신하다가 나머지를
NULL로 덮어쓰는 문제가 생겨서, 하나로 합쳐 매번 완전한 행만 쓴다.

시도별 실시간 측정정보 API가 측정소 하나하나가 아니라 부산 전체를 한 번에 주기 때문에,
호출은 총 2회(측정소 목록 1 + 측정값 1)로 끝난다 — api-quota-check.md의 기존 "136회/일"
추정치보다 훨씬 가볍다(아래 참고).

실행: backend/ 디렉토리에서 `python -m etl.fetch_air_quality`
(.env에 AIR_KOREA_API_KEY 필요 — 대기오염정보 상품이 "중지" 상태면 두 번째 호출만 실패함,
harness/DECISIONS.md 2026-08-12 참고)
"""

from datetime import datetime
from urllib.parse import unquote

import requests
from geoalchemy2 import WKTElement

from core.config import settings
from db.base import Base
from db.models import AirQualityCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_STATION_URL = "https://apis.data.go.kr/B552584/MsrstnInfoInqireSvc/getMsrstnList"
_MEASURE_URL = "https://apis.data.go.kr/B552584/ArpltnInforInqireSvc/getCtprvnRltmMesureDnsty"


def _service_key() -> str:
    # data.go.kr가 이미 URL-encoding된 키를 주므로, requests의 자동 인코딩과 겹쳐
    # 이중 인코딩되는 걸 막으려고 먼저 디코딩해서 넘긴다.
    return unquote(settings.AIR_KOREA_API_KEY)


def _fetch_stations() -> dict[str, tuple[float, float]]:
    """station_name -> (lat, lon). 필드명이 dmX/dmY지만 실제 값은 각각 위도/경도다
    (에어코리아 API 문서의 필드명과 실제 의미가 반대로 되어 있음, 샘플 응답으로 확인)."""
    res = requests.get(
        _STATION_URL,
        params={
            "serviceKey": _service_key(),
            "returnType": "json",
            "numOfRows": 100,
            "pageNo": 1,
            "addr": "부산",
        },
        timeout=5,
    )
    res.raise_for_status()
    items = res.json()["response"]["body"]["items"]
    return {item["stationName"]: (float(item["dmX"]), float(item["dmY"])) for item in items}


def _num_or_none(value: str | None) -> float | None:
    # 측정 불가 시간대엔 "-"로 옴
    if value in (None, "-", ""):
        return None
    return float(value)


def _int_or_none(value: str | None) -> int | None:
    if value in (None, "-", ""):
        return None
    return int(value)


def _fetch_measurements() -> dict[str, dict]:
    """station_name -> {pm10, pm25, o3}."""
    res = requests.get(
        _MEASURE_URL,
        params={
            "serviceKey": _service_key(),
            "returnType": "json",
            "numOfRows": 100,
            "pageNo": 1,
            "sidoName": "부산",
            "ver": "1.3",
        },
        timeout=5,
    )
    res.raise_for_status()
    items = res.json()["response"]["body"]["items"]
    return {
        item["stationName"]: {
            "pm10": _num_or_none(item.get("pm10Value")),
            "pm25": _num_or_none(item.get("pm25Value")),
            "o3": _num_or_none(item.get("o3Value")),
            # 환경부 공식 4단계 등급(1=좋음~4=매우나쁨). 에어코리아가 이미 등급을
            # 계산해서 주므로 우리가 임의로 기준값을 정하지 않고 그대로 저장한다.
            "pm10_grade": _int_or_none(item.get("pm10Grade")),
            "pm25_grade": _int_or_none(item.get("pm25Grade")),
        }
        for item in items
    }


def main() -> None:
    Base.metadata.create_all(engine)  # air_quality_cache만 신규 생성, 기존 테이블은 no-op

    stations = _fetch_stations()
    measurements = _fetch_measurements()
    fetched_at = datetime.now()

    records = [
        {
            "station_name": name,
            "geom": WKTElement(f"POINT({lon} {lat})", srid=4326),
            "fetched_at": fetched_at,
            **measurements[name],
        }
        for name, (lat, lon) in stations.items()
        if name in measurements  # 두 API의 측정소명이 어긋나는 소수 케이스는 건너뜀
    ]

    session = SessionLocal()
    try:
        upsert(session, AirQualityCache, records, "station_name")
        session.commit()
        print(f"air_quality_cache: {len(records)}/{len(stations)}건")
    finally:
        session.close()


if __name__ == "__main__":
    main()
