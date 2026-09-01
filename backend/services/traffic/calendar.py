"""공휴일 보정 — baseline 조회용 요일을 공휴일이면 일요일(6)로 대체.

RoadLinkBaseline/DistrictVisitorBaseline은 순수 요일(dow) 단위로 쌓이는데, 평일
공휴일(예: 화요일인 광복절)은 그 요일의 평소 패턴과 다르게 움직인다(관광지는 더
붐비고 업무 도로는 더 한산함) — 그대로 두면 baseline이 오염되고 "오늘 왜 이렇게
다르지" 오탐도 생긴다. 가장 비슷한 패턴인 일요일로 근사한다(harness/DECISIONS.md 참고).
"""

from datetime import date

from sqlalchemy.orm import Session

from db.models import HolidayCache

_SUNDAY = 6


def effective_dow(session: Session, d: date) -> int:
    is_holiday = session.get(HolidayCache, d) is not None
    return _SUNDAY if is_holiday else d.weekday()
