"""교통 혼잡도(s_traffic) 계산.

`s_traffic = clamp(현재속도 / baseline속도, 0, 1)` 기반 계산.
관광지 반경 내 여러 링크면 평균값으로 집계.

- 1.0 = 원활 (평소와 동일)
- 0.5 = 보통 (평소보다 50% 느림)
- 0.0 = 정체 (정지 상태)

도로 baseline이 아직 3일치도 안 쌓인 cold-start 구간에서는 구·군 방문객수
baseline(`DistrictVisitorBaseline`)으로 대체한다(harness/DECISIONS.md 참고).
"""

from collections import defaultdict
from datetime import datetime

from sqlalchemy.orm import Session

from db.environment_queries import nearest_road_links, nearest_sigungu_code
from db.models import DistrictVisitorBaseline, RoadLinkBaseline, RoadLinkTrafficCache, RoadLinkTrafficHistory
from services.traffic.calendar import effective_dow

MIN_BASELINE_SAMPLES = 3  # baseline으로 인정할 최소 관측 횟수(같은 요일·시간대 3주, 이번 관측 포함)


def _without_current(baseline: RoadLinkBaseline, current_speed: float | None, obs_date) -> tuple[float, int]:
    """(평소 평균 속도, 표본 수). 수집 시 이번 관측이 baseline에 이미 합산되므로(같은 날짜로 갱신됨),
    그대로 비교하면 자기 자신과 비교해 비율이 1.0 쪽으로 쏠린다 — 이번 관측을 빼서 직전까지의 평소만 남긴다."""
    n = baseline.sample_count
    if baseline.last_sample_date == obs_date and current_speed is not None and n > 1:
        return (baseline.avg_speed * n - current_speed) / (n - 1), n - 1
    return baseline.avg_speed, n


def calculate_traffic_congestion(
    session: Session, lat: float, lon: float, link_limit: int = 10, radius_m: int = 500
) -> tuple[float | None, str | None, float | None, float | None, str | None]:
    """관광지 좌표 기반 교통 혼잡도 계산.

    Args:
        session: DB 세션
        lat, lon: 관광지 좌표
        link_limit: 반경 내에서 고려할 최대 링크 개수
        radius_m: 검색 반경 (미터)

    Returns:
        (s_traffic, source, current_speed, baseline_speed, congested_road_name) 튜플.
        - source: 'road'(실제 도로 baseline) 또는 'district_fallback'(구·군 방문객수, cold-start용)
        - current_speed/baseline_speed: 반경 내 링크 평균 속도(km/h, s_traffic과 같은 링크 집합으로
          집계). district_fallback은 방문객 비율이라 속도 단위가 아니므로 항상 None
        - congested_road_name: 집계에 쓰인 링크 중 현재 속도가 가장 낮은 링크의 도로명
          ("정체 구간" 표시용). 마찬가지로 district_fallback이면 None
        - 데이터가 전혀 없으면 전부 None
    """
    # 반경 내 가까운 링크 조회
    nearby_links = nearest_road_links(session, lat, lon, limit=link_limit, radius_m=radius_m)

    if not nearby_links:
        return None, None, None, None, None  # 반경 내 링크 없음 (산, 도서 지역 등) — 구·군 대체도 안 씀

    # 구·군 대체 신호용 요일 (공휴일이면 일요일 패턴으로 대체)
    current_dow = effective_dow(session, datetime.now().date())

    traffic_scores = []
    current_speeds = []
    baseline_speeds = []
    worst_speed = None
    worst_road_name = None

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

        # 이 속도가 관측된 시각(원본 statsDt, 현재보다 1시간 이상 이전)의 요일·시간대 baseline과 비교
        obs = current_traffic.observed_at
        baseline = (
            session.query(RoadLinkBaseline)
            .filter_by(link_id=link_id, dow=effective_dow(session, obs.date()), hour=obs.hour)
            .first()
        )

        if not baseline or baseline.avg_speed is None or baseline.sample_count < MIN_BASELINE_SAMPLES:
            continue  # baseline 데이터 부족 (최소 3주 필요)

        usual_speed, _ = _without_current(baseline, current_traffic.current_speed, obs.date())
        if usual_speed <= 0:
            continue

        # s_traffic 계산: 현재 속도 / 평상시 속도
        s_traffic = min(max(current_traffic.current_speed / usual_speed, 0), 1)
        traffic_scores.append(s_traffic)
        current_speeds.append(current_traffic.current_speed)
        baseline_speeds.append(usual_speed)

        if worst_speed is None or current_traffic.current_speed < worst_speed:
            worst_speed = current_traffic.current_speed
            worst_road_name = link.road_name

    if traffic_scores:
        return (
            sum(traffic_scores) / len(traffic_scores),
            "road",
            sum(current_speeds) / len(current_speeds),
            sum(baseline_speeds) / len(baseline_speeds),
            worst_road_name,
        )

    # 링크는 있지만 도로 baseline이 아직 부족 — cold-start 동안만 구·군 대체 신호 시도
    fallback = _district_fallback_score(session, lat, lon, current_dow)
    if fallback is not None:
        return fallback, "district_fallback", None, None, None
    return None, None, None, None, None


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


def traffic_history_for_spot(
    session: Session, lat: float, lon: float, link_limit: int = 10, radius_m: int = 500
) -> list[dict]:
    """"오늘 실측 vs 평소 baseline" 그래프용 — 오늘 0시부터 지금까지 시간대별 속도.

    반경 내 링크들의 RoadLinkTrafficHistory(최근 48시간 이력)를 시간대별로 평균 내
    실측 속도를, 같은 링크들의 RoadLinkBaseline(dow×hour)을 24시간 전체로 평소 속도를
    만든다. baseline은 sample_count < 3(3주 미만 관측)인 시간대는 아직 못 믿을 값이라
    None으로 뺀다 — 나머지 화면과 동일한 기준(harness/DECISIONS.md).
    """
    nearby_links = nearest_road_links(session, lat, lon, limit=link_limit, radius_m=radius_m)
    if not nearby_links:
        return []
    link_ids = [link.link_id for link in nearby_links]

    now = datetime.now()
    today_start = datetime(now.year, now.month, now.day)
    dow = effective_dow(session, now.date())

    history_rows = (
        session.query(RoadLinkTrafficHistory)
        .filter(RoadLinkTrafficHistory.link_id.in_(link_ids))
        .filter(RoadLinkTrafficHistory.observed_at >= today_start)
        .all()
    )
    speeds_by_hour: dict[int, list[float]] = defaultdict(list)
    today_speed: dict[tuple, float] = {}
    for row in history_rows:
        if row.current_speed is not None:
            speeds_by_hour[row.observed_at.hour].append(row.current_speed)
            today_speed[(row.link_id, row.observed_at.hour)] = row.current_speed

    baseline_rows = (
        session.query(RoadLinkBaseline)
        .filter(RoadLinkBaseline.link_id.in_(link_ids))
        .filter(RoadLinkBaseline.dow == dow)
        .all()
    )
    baseline_by_hour: dict[int, list[float]] = defaultdict(list)
    for b in baseline_rows:
        if b.avg_speed is not None and b.sample_count >= MIN_BASELINE_SAMPLES:
            usual_speed, _ = _without_current(b, today_speed.get((b.link_id, b.hour)), now.date())
            if usual_speed > 0:
                baseline_by_hour[b.hour].append(usual_speed)

    def avg(values: list[float] | None) -> float | None:
        return sum(values) / len(values) if values else None

    return [
        {
            "hour": hour,
            "current_speed": avg(speeds_by_hour.get(hour)),
            "baseline_speed": avg(baseline_by_hour.get(hour)),
        }
        for hour in range(24)
    ]
