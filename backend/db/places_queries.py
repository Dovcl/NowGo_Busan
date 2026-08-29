"""관광지 대상 PostGIS 공간 쿼리. (CLAUDE.md 규칙: PostGIS 쿼리는 backend/db/ 안에서만 작성)"""

from geoalchemy2 import Geography
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import TourSpot

FOOD_CAT1 = "A05"  # tour_spot.cat1 대분류 코드: 음식


def nearby_food_places(session: Session, contentid: int, limit: int = 3):
    """상세페이지 "주변 추천 맛집" 용. 관광지 좌표에서 가까운 음식점 최대 limit개를
    거리(미터)와 함께 반환한다."""
    target = session.query(TourSpot.geom).filter(TourSpot.contentid == contentid).scalar_subquery()
    distance = func.ST_Distance(
        TourSpot.geom.cast(Geography), func.cast(target, Geography)
    ).label("distance_m")
    return (
        session.query(TourSpot.contentid, TourSpot.title, TourSpot.firstimage, distance)
        .filter(TourSpot.cat1 == FOOD_CAT1, TourSpot.contentid != contentid)
        .order_by(distance)
        .limit(limit)
        .all()
    )
