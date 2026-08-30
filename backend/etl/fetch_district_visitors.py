"""한국관광공사_빅데이터_지역별 방문자수_GW(locgoRegnVisitrDDList) 배치 수집.

harness/DECISIONS.md 참고 — s_traffic(도로 baseline)이 아직 3일치도 안 쌓인
cold-start 구간에서만 쓰는 대체 신호. 구·군 단위 "이 요일엔 보통 이 정도 붐빈다"는
고정 패턴이며, 절대 방문객 수 추정치가 아니다(요일별 상대 비율만 저장).

이 API는 지역 필터 파라미터가 없어 전국 데이터를 그대로 받은 뒤 부산(signguCode
26 prefix)만 골라 쓴다. 실측 결과 월 단위로 한 번에 갱신되고 약 1개월 지연이
있음(2026-08-30 기준 7월 데이터까지 존재, 8월은 아직 없음) — 정확한 지연 일수를
가정하지 않고, 가장 최근에 데이터가 채워진 완결 월부터 역순으로 탐색한다.

실행: backend/ 디렉토리에서 `python -m etl.fetch_district_visitors`
(.env에 TOUR_API_KEY 필요 — 관광빅데이터 활용신청 승인된 계정 키, 새 키 불필요)
"""

import calendar
from collections import defaultdict
from datetime import date
from urllib.parse import unquote

import requests

from core.config import settings
from db.base import Base
from db.models import DistrictVisitorBaseline, SigunguCode
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_URL = "https://apis.data.go.kr/B551011/DataLabService/locgoRegnVisitrDDList"
_NUM_OF_ROWS = 30000  # 전국 약 268개 시군구 x 3 touDivCd x 31일 최대치를 한 번에 커버
_MONTHS_TO_COLLECT = 2  # 요일당 표본을 충분히 확보하기 위한 최소 기간(각 요일당 약 8~9일치)
_MAX_LOOKBACK_MONTHS = 6  # 이보다 오래 데이터가 없으면 API 자체 문제로 보고 중단
_MIN_SAMPLE = 3  # RoadLinkBaseline과 동일 기준(harness/DECISIONS.md 2026-08-20)
_VISITOR_TOU_DIV_CODES = {"2", "3"}  # 외지인+외국인 (1=현지인은 방문객이 아니라 제외)


def _fetch_month(year: int, month: int) -> list[dict] | None:
    """해당 달 전체(1일~말일) 전국 데이터를 1콜로 수집. 아직 데이터가 없으면 None."""
    start = date(year, month, 1)
    end = date(year, month, calendar.monthrange(year, month)[1])
    res = requests.get(
        _URL,
        params={
            "serviceKey": unquote(settings.TOUR_API_KEY),
            "MobileOS": "ETC",
            "MobileApp": "NowGoBusan",
            "_type": "json",
            "startYmd": start.strftime("%Y%m%d"),
            "endYmd": end.strftime("%Y%m%d"),
            "numOfRows": _NUM_OF_ROWS,
            "pageNo": 1,
        },
        timeout=30,
    )
    res.raise_for_status()
    body = res.json()["response"]["body"]
    total_count = body.get("totalCount") or 0
    if total_count == 0:
        return None
    items = body["items"]["item"]
    if total_count != len(items):
        raise RuntimeError(f"{year}-{month:02d}: totalCount({total_count}) != 수신 건수({len(items)})")
    return items


def fetch_recent_months(months: int = _MONTHS_TO_COLLECT, max_lookback: int = _MAX_LOOKBACK_MONTHS) -> list[dict]:
    """가장 최근에 데이터가 채워진 완결 월부터 역순으로 `months`개월치를 모은다."""
    today = date.today()
    y, m = today.year, today.month
    collected: list[list[dict]] = []
    checked = 0
    while len(collected) < months and checked < max_lookback:
        m -= 1
        if m == 0:
            m, y = 12, y - 1
        checked += 1
        items = _fetch_month(y, m)
        if items is not None:
            collected.append(items)

    if len(collected) < months:
        raise RuntimeError(f"최근 {max_lookback}개월 내 데이터가 채워진 달을 {months}개 못 찾음")

    return [item for month_items in collected for item in month_items]


def build_baseline_records(items: list[dict], signgu_to_sigungu: dict[str, int]) -> list[dict]:
    """(sigungu_code, dow)별 방문객수 평균을 그 구 전체 평균 대비 비율로 환산한다."""
    daily_visitors: dict[tuple[int, str], float] = defaultdict(float)  # (sigungu_code, baseYmd) -> 방문객수 합
    for it in items:
        sigungu_code = signgu_to_sigungu.get(it.get("signguCode"))
        if sigungu_code is None or it.get("touDivCd") not in _VISITOR_TOU_DIV_CODES:
            continue
        tou_num = it.get("touNum")
        if tou_num is None:
            continue
        daily_visitors[(sigungu_code, it["baseYmd"])] += float(tou_num)

    by_dow: dict[tuple[int, int], list[float]] = defaultdict(list)  # (sigungu_code, dow) -> [일별 방문객수]
    overall_by_district: dict[int, list[float]] = defaultdict(list)
    for (sigungu_code, ymd), total in daily_visitors.items():
        dow = date(int(ymd[:4]), int(ymd[4:6]), int(ymd[6:8])).weekday()
        by_dow[(sigungu_code, dow)].append(total)
        overall_by_district[sigungu_code].append(total)

    records = []
    for (sigungu_code, dow), values in by_dow.items():
        overall_values = overall_by_district[sigungu_code]
        overall_avg = sum(overall_values) / len(overall_values)
        if overall_avg <= 0:
            continue
        dow_avg = sum(values) / len(values)
        records.append({
            "sigungu_code": sigungu_code,
            "dow": dow,
            "visitor_ratio": dow_avg / overall_avg,
            "sample_count": len(values),
        })
    return records


def main() -> None:
    Base.metadata.create_all(engine)

    session = SessionLocal()
    try:
        signgu_to_sigungu = {
            str(row.signgu_code): row.code
            for row in session.query(SigunguCode).filter(SigunguCode.signgu_code.isnot(None))
        }

        items = fetch_recent_months()
        records = build_baseline_records(items, signgu_to_sigungu)
        usable = [r for r in records if r["sample_count"] >= _MIN_SAMPLE]

        if usable:
            upsert(session, DistrictVisitorBaseline, usable, ["sigungu_code", "dow"])
            session.commit()

        print(
            f"district_visitor_baseline: {len(usable)}건 갱신 "
            f"(원본 {len(items)}건 -> 구·군x요일 {len(records)}건 -> 표본부족 제외 후 {len(usable)}건)"
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
