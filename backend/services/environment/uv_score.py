"""자외선 점수(s_uv 원형) 계산 — 팀 제공 노트북(Data_Preprocess.ipynb, `UVScoreCalculator`)
중 점수 변환 부분만 이식.

원본과 같이 관광지 주소로 찾은 행정구역(areaNo, uv_area.py)의 UV 지수에 임계값 변환을
적용한다(2026-09-19: 기존 "부산 전체 1개 값" 단순화를 되돌려 노트북 방식으로 맞춤 —
사용자 요청, 동네별로 지수가 실제로 다름). 지역 캐시는 etl/fetch_uv.py.

compose(유형별 가중합·신호등 판정)는 아직 미정이라 이 모듈은 손대지 않는다
(harness/DECISIONS.md 참고).
"""

from sqlalchemy.orm import Session

from db.models import UvIndexCache
from services.environment.uv_area import find_area_no

_BUSAN_AREA_NO = "2600000000"  # services/environment/lookup.py와 동일 — 부산 전체 1개 값만 사용

# UV 지수 상한(이하) -> 점수. 자외선이 강할수록(지수가 클수록) 점수가 낮아진다.
_UV_THRESHOLDS = [(2, 100.0), (5, 80.0), (7, 60.0), (10, 40.0)]
_UV_EXTREME_SCORE = 20.0  # 10 초과


def uv_score(uv_index: float) -> float:
    """UV 지수 -> 0~100 점수. 원본 노트북과 동일하게 구간 상한 이하(<=)를 그 구간 점수로 본다."""
    for threshold, score in _UV_THRESHOLDS:
        if uv_index <= threshold:
            return score
    return _UV_EXTREME_SCORE


def uv_score_for_address(uv_by_area: dict[str, int | None], address: str | None) -> dict:
    """관광지 주소 -> areaNo -> 그 지역 UV 지수/점수. 주소가 없거나 지역을 못 찾는
    "코스"형 관광지는 노트북에선 NaN이지만, 사용자 요청(2026-09-21)으로 부산 전체 대표값
    (2600000000)을 대신 쓴다. uv_by_area는 배치가 한 번만 읽어둔 {area_no: uv_index}."""
    uv_index = uv_by_area.get(find_area_no(address) or _BUSAN_AREA_NO)
    return {"uv_index": uv_index, "uv_score": uv_score(uv_index) if uv_index is not None else None}


def uv_score_lookup(session: Session) -> dict:
    """부산 전체 1개 UV 지수 캐시로 점수 계산. 캐시가 비어 있으면 각 필드가 None —
    다른 환경 데이터의 None 처리 방식과 동일(services/environment/lookup.py 참고)."""
    row = session.get(UvIndexCache, _BUSAN_AREA_NO)
    return {
        "fetched_at": row.fetched_at if row else None,
        "uv_index": row.uv_index if row else None,
        "uv_score": uv_score(row.uv_index) if row and row.uv_index is not None else None,
    }
