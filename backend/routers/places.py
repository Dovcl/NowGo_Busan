from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import CategoryCode, TourSpot, TourSpotEnvClassification, TourSpotIntro
from db.session import get_db
from schemas.places import PlaceDetailOut, PlaceOut

router = APIRouter()


def _place_query(db: Session):
    return db.query(
        TourSpot.contentid,
        TourSpot.title,
        TourSpot.addr1,
        TourSpot.sigungucode,
        TourSpot.firstimage,
        CategoryCode.cat3_name.label("category_name"),
        func.ST_X(TourSpot.geom).label("lng"),
        func.ST_Y(TourSpot.geom).label("lat"),
        TourSpotEnvClassification.env_group4,
        TourSpotEnvClassification.env_type_code,
        TourSpotEnvClassification.is_env_target,
    ).join(
        TourSpotEnvClassification,
        TourSpotEnvClassification.contentid == TourSpot.contentid,
    ).outerjoin(
        # cat3가 비어있는 레코드가 있을 수 있어 INNER가 아니라 OUTER JOIN
        CategoryCode,
        CategoryCode.code == TourSpot.cat3,
    )


@router.get("/places", response_model=list[PlaceOut], tags=["Places"])
def list_places(
    sigungucode: int | None = None,
    env_group4: str | None = None,
    db: Session = Depends(get_db),
):
    """관광지 목록 (지도 핀용). 음식점·숙박·쇼핑까지 전부 포함한다 — 주변 맛집 추천 등
    다른 기능이 이 데이터를 쓸 수 있어야 해서 서버에서 미리 걸러내지 않는다. 응답의
    is_env_target은 "노출할지"가 아니라 "환경 신호등 점수를 받을 대상인지"(실내·음식점·
    숙박·쇼핑은 항상 false)를 뜻하며, 프론트가 이 값으로 화면 구성을 결정한다."""
    query = _place_query(db)
    if sigungucode is not None:
        query = query.filter(TourSpot.sigungucode == sigungucode)
    if env_group4 is not None:
        query = query.filter(TourSpotEnvClassification.env_group4 == env_group4)
    return [PlaceOut.model_validate(row._mapping) for row in query.all()]


@router.get("/places/{contentid}", response_model=PlaceDetailOut, tags=["Places"])
def get_place(contentid: int, db: Session = Depends(get_db)):
    # tour_spot_intro는 일부 레코드에 없을 수 있어 INNER가 아니라 OUTER JOIN
    query = _place_query(db).add_columns(
        TourSpotIntro.overview,
        TourSpotIntro.homepage,
        TourSpotIntro.usetime,
        TourSpotIntro.restdate,
        TourSpotIntro.parking,
        TourSpotIntro.infocenter,
        TourSpotIntro.usefee,
    ).outerjoin(TourSpotIntro, TourSpotIntro.contentid == TourSpot.contentid)
    row = query.filter(TourSpot.contentid == contentid).first()
    if row is None:
        raise HTTPException(status_code=404, detail="관광지를 찾을 수 없습니다")
    return PlaceDetailOut.model_validate(row._mapping)
