"""환경 데이터 캐시 테이블 대상 PostGIS 공간 쿼리. (CLAUDE.md 규칙: PostGIS 쿼리는
반드시 backend/db/ 안에서만 작성)"""

from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import AirQualityCache


def nearest_air_quality_station(session: Session, lat: float, lon: float) -> AirQualityCache | None:
    """좌표에서 가장 가까운 측정소 캐시 1건. 아직 측정소 좌표를 못 채웠으면(테이블이 비어
    있으면) None — 대기질만 빠진 채로 나머지 환경 데이터는 정상 응답되도록 호출부에서 처리."""
    point = func.ST_SetSRID(func.ST_MakePoint(lon, lat), 4326)
    return (
        session.query(AirQualityCache)
        .order_by(AirQualityCache.geom.op("<->")(point))
        .first()
    )
