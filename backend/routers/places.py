from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func
from sqlalchemy.orm import Session

from db.models import CategoryCode, NowgoScoreCache, TourSpot, TourSpotEnvClassification, TourSpotIntro
from db.places_queries import localized_column, nearby_food_places
from db.session import get_db
from schemas.places import PlaceDetailOut, PlaceOut

router = APIRouter()


def _place_query(db: Session, lang: str = "ko"):
    return db.query(
        TourSpot.contentid,
        localized_column(TourSpot.title, TourSpot.title_en, TourSpot.title_zh, lang, "title"),
        localized_column(TourSpot.addr1, TourSpot.addr1_en, TourSpot.addr1_zh, lang, "addr1"),
        TourSpot.sigungucode,
        TourSpot.firstimage,
        TourSpot.cat1,
        CategoryCode.cat3_name.label("category_name"),
        func.ST_X(TourSpot.geom).label("lng"),
        func.ST_Y(TourSpot.geom).label("lat"),
        TourSpotEnvClassification.env_group4,
        TourSpotEnvClassification.env_type_code,
        TourSpotEnvClassification.is_env_target,
        TourSpotIntro.usetime,
        TourSpotIntro.restdate,
        NowgoScoreCache.tour_type.label("nowgo_tour_type"),
        NowgoScoreCache.air_score.label("nowgo_air_score"),
        NowgoScoreCache.temp_score.label("nowgo_temp_score"),
        NowgoScoreCache.rain_score.label("nowgo_rain_score"),
        NowgoScoreCache.uv_score.label("nowgo_uv_score"),
        NowgoScoreCache.activities.label("nowgo_activities"),
        NowgoScoreCache.tips.label("nowgo_tips"),
    ).join(
        TourSpotEnvClassification,
        TourSpotEnvClassification.contentid == TourSpot.contentid,
    ).outerjoin(
        # cat3가 비어있는 레코드가 있을 수 있어 INNER가 아니라 OUTER JOIN
        CategoryCode,
        CategoryCode.code == TourSpot.cat3,
    ).outerjoin(
        # tour_spot_intro는 일부 레코드에 없을 수 있어 INNER가 아니라 OUTER JOIN
        TourSpotIntro,
        TourSpotIntro.contentid == TourSpot.contentid,
    ).outerjoin(
        # is_env_target=false거나 배치가 아직 안 돌았으면 없을 수 있어 OUTER JOIN
        NowgoScoreCache,
        NowgoScoreCache.contentid == TourSpot.contentid,
    )


def _to_place_dict(row) -> dict:
    """행 하나를 PlaceOut 입력 dict로. nowgo_* 평면 컬럼들을 PlaceOut.nowgo 하나로
    묶는다 — 값이 없으면(캐시 미존재) nowgo는 None."""
    data = dict(row._mapping)
    tour_type = data.pop("nowgo_tour_type")
    nowgo_fields = {
        "air_score": data.pop("nowgo_air_score"),
        "temp_score": data.pop("nowgo_temp_score"),
        "rain_score": data.pop("nowgo_rain_score"),
        "uv_score": data.pop("nowgo_uv_score"),
        "activities": data.pop("nowgo_activities"),
        # 이 컬럼을 새로 추가하기 전 계산된 캐시 행은 tips가 NULL일 수 있어 빈 목록으로 폴백
        "tips": data.pop("nowgo_tips") or [],
    }
    data["nowgo"] = {"tour_type": tour_type, **nowgo_fields} if tour_type is not None else None
    return data


@router.get("/places", response_model=list[PlaceOut], tags=["Places"])
def list_places(
    sigungucode: int | None = None,
    env_group4: str | None = None,
    lang: str = "ko",
    db: Session = Depends(get_db),
):
    """관광지 목록 (지도 핀용). 음식점·숙박·쇼핑까지 전부 포함한다 — 주변 맛집 추천 등
    다른 기능이 이 데이터를 쓸 수 있어야 해서 서버에서 미리 걸러내지 않는다. 응답의
    is_env_target은 "노출할지"가 아니라 "환경 신호등 점수를 받을 대상인지"(실내·음식점·
    숙박·쇼핑은 항상 false)를 뜻하며, 프론트가 이 값으로 화면 구성을 결정한다.

    lang=en/zh는 title/addr1을 EngService2/ChsService2로 정확매칭된 값으로 바꿔
    내려준다 — 매칭 안 된 관광지는 한국어 그대로 폴백(harness/DECISIONS.md 2026-09-10)."""
    query = _place_query(db, lang)
    if sigungucode is not None:
        query = query.filter(TourSpot.sigungucode == sigungucode)
    if env_group4 is not None:
        query = query.filter(TourSpotEnvClassification.env_group4 == env_group4)
    return [PlaceOut.model_validate(_to_place_dict(row)) for row in query.all()]


@router.get("/places/{contentid}", response_model=PlaceDetailOut, tags=["Places"])
def get_place(contentid: int, lang: str = "ko", db: Session = Depends(get_db)):
    query = _place_query(db, lang).add_columns(
        localized_column(TourSpotIntro.overview, TourSpotIntro.overview_en, TourSpotIntro.overview_zh, lang, "overview"),
        TourSpotIntro.homepage,
        TourSpotIntro.parking,
        TourSpotIntro.infocenter,
        TourSpotIntro.usefee,
    )
    row = query.filter(TourSpot.contentid == contentid).first()
    if row is None:
        raise HTTPException(status_code=404, detail="관광지를 찾을 수 없습니다")
    data = _to_place_dict(row)
    data["nearby_food"] = [dict(r._mapping) for r in nearby_food_places(db, contentid, lang)]
    return PlaceDetailOut.model_validate(data)
