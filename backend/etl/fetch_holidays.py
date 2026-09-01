"""한국천문연구원 특일 정보(공휴일) 배치 수집.

RoadLinkBaseline/DistrictVisitorBaseline이 순수 요일(dow) 단위라 평일 공휴일이
baseline을 오염시키는 문제를 보정하려고(services/traffic/calendar.py) 공휴일 날짜
목록이 필요하다. 월별 조회 API라 1년치는 12번 호출해야 함.

이 API도 다른 data.go.kr 서비스처럼 개별 활용신청이 필요할 수 있다 — 최초 실행 시
SERVICE_KEY_IS_NOT_REGISTERED_ERROR가 나면 data.go.kr에서 "특일 정보" 활용신청 필요
(TOUR_API_KEY와 같은 계정 공용 키 재사용, harness/DECISIONS.md의 기존 관례와 동일).

한 해가 이미 캐싱돼 있으면 스킵한다 — fetch_environment_batch.py에서 매시간 같이
돌아도 실제 API 호출은 연 1~2회 수준으로 유지하기 위함(공휴일은 자주 안 바뀜).
재수집하려면 force=True.

실행: backend/ 디렉토리에서 `python -m etl.fetch_holidays`
"""

from datetime import date, datetime
from urllib.parse import unquote

import requests

from core.config import settings
from db.base import Base
from db.models import HolidayCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_URL = "http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo"
_YEARS_AHEAD = 1  # 올해 + 내년. 음력 기반 공휴일도 API가 이미 양력으로 변환해서 줌


def _fetch_month(year: int, month: int) -> list[dict]:
    res = requests.get(
        _URL,
        params={
            "serviceKey": unquote(settings.TOUR_API_KEY),
            "solYear": year,
            "solMonth": f"{month:02d}",
            "numOfRows": 100,
            "_type": "json",
        },
        timeout=15,
    )
    data = res.json()

    # 활용신청 미승인 등 서비스 레벨 에러는 HTTP status(403 등)와 별개로 이 형태로 옴
    # (실측 확인: reason code 30 = SERVICE_KEY_IS_NOT_REGISTERED_ERROR, 다봄 때와 동일 패턴)
    if "OpenAPI_ServiceResponse" in data:
        err = data["OpenAPI_ServiceResponse"]["cmmMsgHeader"]
        raise RuntimeError(
            f"특일 정보 API 오류: {err['errMsg']} — data.go.kr에서 'SpcdeInfoService' 활용신청 필요"
        )

    res.raise_for_status()
    body = data["response"]["body"]

    if not body.get("items"):
        return []  # 그 달에 공휴일 없음

    item = body["items"]["item"]
    return item if isinstance(item, list) else [item]  # 1건뿐이면 dict로 옴(data.go.kr 공통 특성)


def fetch_year(year: int) -> list[dict]:
    items = []
    for month in range(1, 13):
        items.extend(_fetch_month(year, month))
    return items


def _year_already_cached(session, year: int) -> bool:
    return (
        session.query(HolidayCache)
        .filter(HolidayCache.date >= date(year, 1, 1))
        .filter(HolidayCache.date <= date(year, 12, 31))
        .first()
        is not None
    )


def main(force: bool = False) -> None:
    Base.metadata.create_all(engine)

    this_year = datetime.now().year
    target_years = [this_year + i for i in range(_YEARS_AHEAD + 1)]

    session = SessionLocal()
    try:
        total = 0
        for year in target_years:
            if not force and _year_already_cached(session, year):
                print(f"holiday_cache: {year}년 이미 캐싱됨, 스킵")
                continue

            items = fetch_year(year)
            records = [
                {"date": datetime.strptime(str(it["locdate"]), "%Y%m%d").date(), "name": it["dateName"]}
                for it in items
                if it.get("isHoliday") == "Y"
            ]
            if records:
                upsert(session, HolidayCache, records, "date")
                session.commit()
            total += len(records)
            print(f"holiday_cache: {year}년 {len(records)}건 수집")

        print(f"완료 (신규/갱신 {total}건)")
    finally:
        session.close()


if __name__ == "__main__":
    main()
