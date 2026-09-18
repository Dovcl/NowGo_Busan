"""자외선 점수(s_uv 원형) 계산 — 팀 제공 노트북(Data_Preprocess.ipynb, `UVScoreCalculator`)
중 점수 변환 부분만 이식.

원본은 구·군별(areaNo) UV 예보를 전체 조회해 h0/h3/h6... 시간대 중 하나를 골라 쓰는
클래스였다. 하지만 우리는 2026-08-12 결정대로 구·군 세분화 없이 부산 전체 1개 값
(uv_index_cache, area_no='2600000000')만 캐싱하는 아키텍처를 그대로 유지한다 — 그래서
좌표/구·군 구분 없이 이미 캐싱된 값 하나에 임계값 변환만 적용하는 함수로 단순화했다.
나중에 구·군 세분화로 바뀌어도 uv_score() 자체(순수 변환)는 그대로 두고 호출부(캐시
조회)만 바뀌면 된다.

compose(유형별 가중합·신호등 판정)는 아직 미정이라 이 모듈은 손대지 않는다
(harness/DECISIONS.md 참고).
"""

from sqlalchemy.orm import Session

from db.models import UvIndexCache

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


def uv_score_lookup(session: Session) -> dict:
    """부산 전체 1개 UV 지수 캐시로 점수 계산. 캐시가 비어 있으면 각 필드가 None —
    다른 환경 데이터의 None 처리 방식과 동일(services/environment/lookup.py 참고)."""
    row = session.get(UvIndexCache, _BUSAN_AREA_NO)
    return {
        "fetched_at": row.fetched_at if row else None,
        "uv_index": row.uv_index if row else None,
        "uv_score": uv_score(row.uv_index) if row and row.uv_index is not None else None,
    }
