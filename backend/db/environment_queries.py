"""환경 데이터 캐시 테이블 대상 PostGIS 공간 쿼리. (CLAUDE.md 규칙: PostGIS 쿼리는
반드시 backend/db/ 안에서만 작성)"""

from geoalchemy2 import Geography
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import AirQualityCache, RipCurrentCache


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
