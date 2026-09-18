"""환경 데이터 캐시 테이블 대상 PostGIS 공간 쿼리. (CLAUDE.md 규칙: PostGIS 쿼리는
반드시 backend/db/ 안에서만 작성)"""

from datetime import date

from geoalchemy2 import Geography
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import (
    AirQualityCache,
    BeachIndexCache,
    Event,
    RipCurrentCache,
    RoadLinkCache,
    RoadLinkTrafficCache,
    RoadLinkBaseline,
    SurfIndexCache,
    TourSpot,
    WeatherObsGridCell,
)


def nearest_air_quality_station(session: Session, lat: float, lon: float) -> AirQualityCache | None:
    """좌표에서 가장 가까운 측정소 캐시 1건. 아직 측정소 좌표를 못 채웠으면(테이블이 비어
    있으면) None — 대기질만 빠진 채로 나머지 환경 데이터는 정상 응답되도록 호출부에서 처리."""
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    return (
        session.query(AirQualityCache)
        .order_by(AirQualityCache.geom.op("<->")(point))
        .first()
    )


def all_air_quality_stations(session: Session) -> list[dict]:
    """모든 측정소 캐시 + 좌표(lat/lon). air_score.py의 Modified IDW는 최근접 1곳이 아니라
    전체 측정소 거리분포가 필요해서 nearest_air_quality_station과 별도로 둔다."""
    rows = session.query(
        AirQualityCache,
        func.ST_Y(AirQualityCache.geom).label("lat"),
        func.ST_X(AirQualityCache.geom).label("lon"),
    ).all()
    return [
        {
            "station_name": a.station_name,
            "lat": lat,
            "lon": lon,
            "pm10_24": a.pm10_24,
            "pm25_24": a.pm25_24,
            "so2": a.so2,
            "no2": a.no2,
            "o3": a.o3,
            "co": a.co,
            "fetched_at": a.fetched_at,
        }
        for a, lat, lon in rows
    ]


def nearest_weather_obs_grid_cell(session: Session, lat: float, lon: float) -> WeatherObsGridCell | None:
    """좌표에서 가장 가까운 API허브 관측격자 참조 셀. 이 격자는 좌표<->격자 변환식이
    없어(weather_obs_grid_cell 참고) 최근접 매칭으로 대체한다. etl/fetch_weather_observation.py가
    "어느 셀을 수집할지" 정할 때, services/environment/weather_score.py가 좌표 하나의
    관측값을 조회할 때 둘 다 이 함수를 쓴다."""
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    return (
        session.query(WeatherObsGridCell)
        .order_by(WeatherObsGridCell.geom.op("<->")(point))
        .first()
    )


def nearest_rip_current_station(
    session: Session, lat: float, lon: float, max_distance_m: int = 1500
) -> RipCurrentCache | None:
    """좌표에서 가장 가까운 이안류 관측 해수욕장. 부산엔 3곳뿐이라 대기질처럼 무제한
    최근접 매칭을 하면 엉뚱한 관광지(예: 태종대)에도 먼 해변의 위험도가 붙어버릴 수
    있음 — 그 해변이거나 바로 근처일 때만 의미 있는 데이터라 그 밖이면 None.
    반경은 원래 5km였으나, 해운대~광안리처럼 서로 다른 해변인데도 5km 이내라
    해운대 관측치가 광안리에 잘못 붙는 사례를 marine_score.py 작업 중 실측으로 발견해
    1.5km로 좁힘 — 실제 해운대/송정/임랑 관측점은 각자 해당 해변과 30~150m 거리라
    영향 없음(2026-09-18)."""
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    return (
        session.query(RipCurrentCache)
        .filter(
            func.ST_DWithin(
                RipCurrentCache.geom.cast(Geography), func.cast(point, Geography), max_distance_m
            )
        )
        .order_by(RipCurrentCache.geom.op("<->")(point))
        .first()
    )


def nearest_beach_index(
    session: Session, lat: float, lon: float, max_distance_m: int = 5000
) -> BeachIndexCache | None:
    """좌표에서 가장 가까운 해수욕지수 예보. 이안류와 같은 이유로 반경 5km 컷오프를
    둔다 — 무제한 최근접 매칭이면 먼 관광지에도 엉뚱한 해수욕장 상태가 붙어버림."""
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    return (
        session.query(BeachIndexCache)
        .filter(func.ST_DWithin(BeachIndexCache.geom.cast(Geography), func.cast(point, Geography), max_distance_m))
        .order_by(BeachIndexCache.geom.op("<->")(point))
        .first()
    )


def nearest_surf_index(
    session: Session, lat: float, lon: float, max_distance_m: int = 5000
) -> SurfIndexCache | None:
    """좌표에서 가장 가까운 서핑지수 예보. nearest_beach_index와 동일한 이유로 반경 컷오프."""
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    return (
        session.query(SurfIndexCache)
        .filter(func.ST_DWithin(SurfIndexCache.geom.cast(Geography), func.cast(point, Geography), max_distance_m))
        .order_by(SurfIndexCache.geom.op("<->")(point))
        .first()
    )


def nearest_road_links(
    session: Session, lat: float, lon: float, limit: int = 10, radius_m: int = 500
) -> list[RoadLinkCache]:
    """좌표 반경 내에서 가장 가까운 도로 링크 최대 N개.

    Args:
        lat, lon: 관광지 좌표 (WGS84)
        limit: 반환할 최대 링크 개수
        radius_m: 검색 반경 (미터)

    Returns:
        거리순 정렬된 링크 리스트 (반경 내 링크가 limit개 미만이면 그만큼만)
    """
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    return (
        session.query(RoadLinkCache)
        .filter(
            func.ST_DWithin(
                RoadLinkCache.geom.cast(Geography), func.cast(point, Geography), radius_m
            )
        )
        .order_by(RoadLinkCache.geom.op("<->")(point))
        .limit(limit)
        .all()
    )


def nearby_active_event(session: Session, lat: float, lon: float, today: date, radius_m: int = 1500) -> Event | None:
    """오늘이 행사 기간에 포함되고 좌표 반경 내인 가장 가까운 축제·행사 1건.

    "주변 혼잡도가 왜 평소보다 높은지" 설명용 배지라 관광지 좌표(500m)보다 넓게
    잡는다. end_date가 없는 항목(단일일 행사)은 start_date를 종료일로 취급한다.
    좌표 없는 소스(KOPIS 등)는 geom이 null이라 자연히 제외된다."""
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    return (
        session.query(Event)
        .filter(Event.geom.isnot(None))
        .filter(Event.start_date <= today)
        .filter(func.coalesce(Event.end_date, Event.start_date) >= today)
        .filter(func.ST_DWithin(Event.geom.cast(Geography), func.cast(point, Geography), radius_m))
        .order_by(Event.geom.op("<->")(point))
        .first()
    )


def nearest_sigungu_code(session: Session, lat: float, lon: float, max_distance_m: int = 30000) -> int | None:
    """좌표에서 가장 가까운 관광지의 구·군(TourAPI sigungucode)으로 근사. 구·군 경계
    폴리곤이 DB에 없어 정확한 point-in-polygon 대신 최근접 관광지로 대체한다 —
    s_traffic cold-start 대체 신호처럼 근사치로 충분한 용도에만 쓸 것.
    부산은 폭이 40km 안팎이라 30km 컷오프는 부산 밖 좌표를 걸러내는 용도."""
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    row = (
        session.query(TourSpot.sigungucode)
        .filter(TourSpot.sigungucode.isnot(None))
        .filter(func.ST_DWithin(TourSpot.geom.cast(Geography), func.cast(point, Geography), max_distance_m))
        .order_by(TourSpot.geom.op("<->")(point))
        .first()
    )
    return row[0] if row else None
