"""환경 데이터 캐시 테이블 대상 PostGIS 공간 쿼리. (CLAUDE.md 규칙: PostGIS 쿼리는
반드시 backend/db/ 안에서만 작성)"""

from datetime import date

from geoalchemy2 import Geography
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import (
    AirQualityCache,
    Event,
    RipCurrentCache,
    RoadLinkCache,
    RoadLinkTrafficCache,
    RoadLinkBaseline,
    TourSpot,
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


def nearest_rip_current_station(
    session: Session, lat: float, lon: float, max_distance_m: int = 5000
) -> RipCurrentCache | None:
    """좌표에서 가장 가까운 이안류 관측 해수욕장. 부산엔 3곳뿐이라 대기질처럼 무제한
    최근접 매칭을 하면 엉뚱한 관광지(예: 태종대)에도 먼 해변의 위험도가 붙어버릴 수
    있음 — 그 해변이거나 바로 근처(반경 5km)일 때만 의미 있는 데이터라 그 밖이면 None."""
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
