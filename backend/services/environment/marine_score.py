"""해양활동 적합도 점수(s_water 원형) 계산 — 팀 제공 노트북(Data_Preprocess.ipynb,
`MarineScoreCalculator`) 그대로 이식.

원본은 관광지마다 수기 매핑된 코드(swim_code/surf_code/rip_code)로 국립해양조사원
API를 직접 호출하는 클래스였다. 하지만 해수욕지수·서핑지수 API는 이안류와 달리 코드
파라미터 없이 전국 데이터를 한 번에 주기 때문에(harness/DECISIONS.md 2026-09-18),
우리는 이미 좌표 기반 최근접 매칭(nearest_beach_index/nearest_surf_index/
nearest_rip_current_station)으로 캐싱해뒀다 — 그래서 코드 매핑 없이 좌표 하나로
바로 조회하는 함수로 단순화했다.

원본은 swim_score/surf_score/marine_trip_score를 하나로 합치지 않고 3개를 따로
반환한다(관광지 유형에 따라 어느 것을 쓸지는 아직 미정 — 노트북의 최종 "관광점수
산정" 셀 자체가 아직 코드 없이 헤더만 있음).

compose(유형별 가중합·신호등 판정)는 아직 미정이라 이 모듈은 손대지 않는다
(harness/DECISIONS.md 참고).
"""

from sqlalchemy.orm import Session

from db.environment_queries import (
    nearest_beach_index,
    nearest_rip_current_station,
    nearest_sigungu_code,
    nearest_surf_index,
)
from db.models import SeaTripIndexCache

# 바다여행지수는 개별 지점이 아니라 구·군을 묶은 권역(부산은 부산북동/부산남서 2곳)
# 단위라 좌표 최근접 매칭이 아니라 구·군(TourAPI sigungucode) 매핑을 써야 한다 —
# 두 권역 기준점 사이 좌표(예: 해운대)가 실제로는 더 가까운 쪽이 아니라 행정구역
# 소속대로 묶여야 해서, 최근접 매칭을 시도했다가 해운대가 부산남서로 잘못 묶이는
# 걸 실측으로 발견하고 팀 노트북의 구·군 매핑(marine_trip_map)대로 수정했다.
# 코드값은 etl/seed_data/tour_areaCode2_busan_sigungu.csv 기준.
_SIGUNGU_TO_TRIP_REGION = {
    3: "부산북동",  # 기장군
    16: "부산북동",  # 해운대구
    12: "부산북동",  # 수영구
    10: "부산남서",  # 사하구
    11: "부산남서",  # 서구
    1: "부산남서",  # 강서구
    4: "부산남서",  # 남구
    14: "부산남서",  # 영도구
}

# 해수욕/서핑 5단계 텍스트 등급 -> 0~100 점수. API 원문 표기가 공백 유무를 오가서
# ("매우나쁨" vs "매우 나쁨") 공백을 제거하고 비교한다.
_LEVEL_SCORE_MAP = {
    "매우좋음": 100.0,
    "좋음": 75.0,
    "보통": 50.0,
    "나쁨": 25.0,
    "매우나쁨": 0.0,
}

# 이안류 4단계 -> 해수욕 점수에 곱하는 안전보정 계수(독립 점수가 아니라 배율).
_RIP_FACTOR_MAP = {"관심": 1.0, "주의": 0.8, "경계": 0.4, "위험": 0.0}


def level_to_score(text: str | None) -> float | None:
    """등급 텍스트 -> 0~100 점수. "매우나쁨"을 "나쁨"보다 먼저 검사해야 오분류가 안 난다."""
    if not text:
        return None
    compact = text.replace(" ", "")
    for level in ("매우나쁨", "매우좋음", "좋음", "보통", "나쁨"):
        if level in compact:
            return _LEVEL_SCORE_MAP[level]
    return None


def _rip_factor(risk_level: str | None) -> float | None:
    if not risk_level:
        return None
    for level, factor in _RIP_FACTOR_MAP.items():
        if level in risk_level:
            return factor
    return None


def swim_score(session: Session, lat: float, lon: float) -> dict:
    """해수욕지수 -> 0~100 점수. 이안류 관측이 있는 해변(해운대/송정/임랑)이면 그
    안전보정 계수를 곱해서 반영하고, 없는 해변은 해수욕지수 점수를 그대로 쓴다."""
    beach = nearest_beach_index(session, lat, lon)
    if beach is None:
        return {"fetched_at": None, "level": None, "rip_level": None, "swim_score": None}

    base_score = level_to_score(beach.total_index)
    rip = nearest_rip_current_station(session, lat, lon)
    rip_level = rip.risk_level if rip else None
    factor = _rip_factor(rip_level)

    score = base_score * factor if base_score is not None and factor is not None else base_score

    return {
        "fetched_at": beach.fetched_at,
        "level": beach.total_index,
        "rip_level": rip_level,
        "swim_score": score,
    }


def surf_score(session: Session, lat: float, lon: float) -> dict:
    """서핑지수 -> 0~100 점수. surf_index_cache는 이미 초급/중급/상급 중 가장 높은
    등급 1건만 저장돼 있어(etl/fetch_surf_index.py) 여기서는 변환만 하면 된다."""
    surf = nearest_surf_index(session, lat, lon)
    if surf is None:
        return {"fetched_at": None, "level": None, "skill_grade": None, "surf_score": None}

    return {
        "fetched_at": surf.fetched_at,
        "level": surf.total_index,
        "skill_grade": surf.skill_grade,
        "surf_score": level_to_score(surf.total_index),
    }


def sea_trip_score(session: Session, lat: float, lon: float) -> dict:
    """바다여행지수 -> 0~100 점수. 좌표가 속한 구·군을 먼저 찾고(nearest_sigungu_code),
    그 구·군이 속한 권역(부산북동/부산남서)의 캐시를 조회한다. 내륙 구·군(예: 부산진구)은
    두 권역 어디에도 안 묶여 있어 None — 바다여행지수 자체가 해안 구·군 전용이라 정상."""
    sigungu = nearest_sigungu_code(session, lat, lon)
    region_name = _SIGUNGU_TO_TRIP_REGION.get(sigungu)
    if region_name is None:
        return {"fetched_at": None, "level": None, "region_name": None, "sea_trip_score": None}

    trip = session.get(SeaTripIndexCache, region_name)
    if trip is None:
        return {"fetched_at": None, "level": None, "region_name": region_name, "sea_trip_score": None}

    return {
        "fetched_at": trip.fetched_at,
        "level": trip.total_index,
        "region_name": trip.region_name,
        "sea_trip_score": level_to_score(trip.total_index),
    }
