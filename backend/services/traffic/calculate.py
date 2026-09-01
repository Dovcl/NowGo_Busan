"""교통 혼잡도(s_traffic) 계산.

`s_traffic = clamp(현재속도 / baseline속도, 0, 1)` 기반 계산.
관광지 반경 내 여러 링크면 평균값으로 집계.

- 1.0 = 원활 (평소와 동일)
- 0.5 = 보통 (평소보다 50% 느림)
- 0.0 = 정체 (정지 상태)

도로 baseline이 아직 3일치도 안 쌓인 cold-start 구간에서는 구·군 방문객수
baseline(`DistrictVisitorBaseline`)으로 대체한다(harness/DECISIONS.md 참고).
"""

from datetime import datetime

from sqlalchemy.orm import Session

from db.environment_queries import nearest_road_links, nearest_sigungu_code
from db.models import DistrictVisitorBaseline, RoadLinkBaseline, RoadLinkTrafficCache
from services.traffic.calendar import effective_dow


def calculate_traffic_congestion(
    session: Session, lat: float, lon: float, link_limit: int = 10, radius_m: int = 500
) -> tuple[float | None, str | None]:
    """관광지 좌표 기반 교통 혼잡도 계산.

    Args:
        session: DB 세션
        lat, lon: 관광지 좌표
        link_limit: 반경 내에서 고려할 최대 링크 개수
        radius_m: 검색 반경 (미터)

    Returns:
        (s_traffic, source) 튜플. source는 'road'(실제 도로 baseline) 또는
        'district_fallback'(구·군 방문객수 baseline, cold-start용). 데이터가
        전혀 없으면 (None, None).
    """
    # 반경 내 가까운 링크 조회
    nearby_links = nearest_road_links(session, lat, lon, limit=link_limit, radius_m=radius_m)

    if not nearby_links:
        return None, None  # 반경 내 링크 없음 (산, 도서 지역 등) — 도로 맥락 자체가 없어 구·군 대체도 안 씀

    # 현재 시간대의 baseline 기준값 준비 (공휴일이면 일요일 패턴으로 대체)
    now = datetime.now()
    current_dow = effective_dow(session, now.date())
    current_hour = now.hour

    traffic_scores = []

    for link in nearby_links:
        link_id = link.link_id

        # 현재 실시간 속도 조회
        current_traffic = (
            session.query(RoadLinkTrafficCache)
            .filter_by(link_id=link_id)
            .order_by(RoadLinkTrafficCache.fetched_at.desc())
            .first()
        )

        if not current_traffic or current_traffic.current_speed is None:
            continue  # 이 링크의 현재 데이터 없음

        # 해당 요일/시간대의 baseline 조회
        baseline = (
            session.query(RoadLinkBaseline)
            .filter_by(link_id=link_id, dow=current_dow, hour=current_hour)
            .first()
        )

        if not baseline or baseline.avg_speed is None or baseline.sample_count < 3:
            # baseline 데이터 부족 (최소 3주 필요)
            continue

        # s_traffic 계산: 현재 속도 / 평상시 속도
        s_traffic = min(max(current_traffic.current_speed / baseline.avg_speed, 0), 1)
        traffic_scores.append(s_traffic)

    if traffic_scores:
        return sum(traffic_scores) / len(traffic_scores), "road"

    # 링크는 있지만 도로 baseline이 아직 부족 — cold-start 동안만 구·군 대체 신호 시도
    fallback = _district_fallback_score(session, lat, lon, current_dow)
    if fallback is not None:
        return fallback, "district_fallback"
    return None, None


def _district_fallback_score(session: Session, lat: float, lon: float, dow: int) -> float | None:
    """구·군 요일별 방문객 비율로 만든 임시 대체 신호. 실시간 신호가 아니라
    "이 구는 이 요일에 보통 이 정도 붐빈다"는 고정 패턴이다."""
    sigungu_code = nearest_sigungu_code(session, lat, lon)
    if sigungu_code is None:
        return None

    baseline = (
        session.query(DistrictVisitorBaseline)
        .filter_by(sigungu_code=sigungu_code, dow=dow)
        .first()
    )
    if not baseline or not baseline.visitor_ratio or baseline.sample_count < 3:
        return None

    return min(max(1 / baseline.visitor_ratio, 0), 1)
