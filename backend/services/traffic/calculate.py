"""교통 혼잡도(s_traffic) 계산.

`s_traffic = clamp(현재속도 / baseline속도, 0, 1)` 기반 계산.
관광지 반경 내 여러 링크면 평균값으로 집계.

- 1.0 = 원활 (평소와 동일)
- 0.5 = 보통 (평소보다 50% 느림)
- 0.0 = 정체 (정지 상태)
"""

from datetime import datetime

from sqlalchemy.orm import Session

from db.environment_queries import nearest_road_links
from db.models import RoadLinkBaseline, RoadLinkTrafficCache


def calculate_traffic_congestion(
    session: Session, lat: float, lon: float, link_limit: int = 10, radius_m: int = 500
) -> float | None:
    """관광지 좌표 기반 교통 혼잡도 계산.

    Args:
        session: DB 세션
        lat, lon: 관광지 좌표
        link_limit: 반경 내에서 고려할 최대 링크 개수
        radius_m: 검색 반경 (미터)

    Returns:
        s_traffic 값 (0~1, None이면 데이터 부족)
    """
    # 반경 내 가까운 링크 조회
    nearby_links = nearest_road_links(session, lat, lon, limit=link_limit, radius_m=radius_m)

    if not nearby_links:
        return None  # 반경 내 링크 없음 (산, 도서 지역 등)

    # 현재 시간대의 baseline 기준값 준비
    now = datetime.now()
    current_dow = now.weekday()  # 0=월, 6=일
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

    if not traffic_scores:
        return None  # 비교할 baseline이 충분한 링크가 없음

    # 여러 링크의 평균으로 최종 점수 계산
    return sum(traffic_scores) / len(traffic_scores)
