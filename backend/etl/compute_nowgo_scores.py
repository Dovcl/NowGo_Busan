"""관광지별 NowGo Score 배치 계산 (services/environment/nowgo_score.py).

외부 API를 부르지 않는다 — 이미 이번 배치에서 갱신된 대기/기온강수/UV/해양 캐시들만
읽어서 계산한다. 그래서 fetch_environment_batch.py의 다른 ETL들(특히
fetch_weather_observation/fetch_air_quality/fetch_uv/fetch_beach_index/
fetch_surf_index/fetch_sea_trip_index) 뒤에 마지막으로 실행돼야 한다.

is_env_target=True인 관광지만 대상(실내·음식점·숙박·쇼핑은 애초에 NowGo Score 대상이
아님, tour_spot_env_classification 참고).

실행: backend/ 디렉토리에서 `python -m etl.compute_nowgo_scores`
"""

import logging
from datetime import datetime

from sqlalchemy import func

from db.environment_queries import nearest_rip_current_station
from db.models import NowgoScoreCache, TourSpot, TourSpotEnvClassification
from db.schema_migrations import ensure_schema
from db.session import SessionLocal
from etl.seed_tour_spots import upsert
from services.environment.air_score import air_score
from services.environment.marine_score import sea_trip_score, surf_score, swim_score
from services.environment.nowgo_score import compute_nowgo_score, generate_tips
from db.models import UvIndexCache
from services.environment.uv_score import uv_score_for_address
from services.environment.weather_score import weather_score

logger = logging.getLogger(__name__)


def _target_spots(session) -> list[tuple[int, float, float, str | None]]:
    rows = (
        session.query(TourSpot.contentid, func.ST_Y(TourSpot.geom), func.ST_X(TourSpot.geom), TourSpot.addr1)
        .join(TourSpotEnvClassification, TourSpotEnvClassification.contentid == TourSpot.contentid)
        .filter(TourSpotEnvClassification.is_env_target.is_(True))
        .filter(TourSpot.geom.isnot(None))
        .all()
    )
    return list(rows)


def main() -> None:
    ensure_schema()  # nowgo_score_cache 신규 생성 + air/temp/rain/uv_score 컬럼 보강

    session = SessionLocal()
    try:
        spots = _target_spots(session)
        if not spots:
            logger.warning("compute_nowgo_scores: 대상 관광지 없음")
            return

        # UV는 지역(구·군·동)별 캐시 전체를 한 번만 읽어두고 관광지마다 주소로 골라 쓴다
        uv_by_area = {r.area_no: r.uv_index for r in session.query(UvIndexCache).all()}

        now = datetime.now()
        records = []
        for contentid, lat, lon, addr1 in spots:
            uv = uv_score_for_address(uv_by_area, addr1)
            air = air_score(session, lat, lon)
            weather = weather_score(session, lat, lon)
            marine_scores = {
                "swim_score": swim_score(session, lat, lon)["swim_score"],
                "surf_score": surf_score(session, lat, lon)["surf_score"],
                "marine_trip_score": sea_trip_score(session, lat, lon)["sea_trip_score"],
            }

            result = compute_nowgo_score(
                air["air_score"], weather["temp_score"], weather["rain_score"], uv["uv_score"], marine_scores
            )

            rip = nearest_rip_current_station(session, lat, lon)
            tips = generate_tips(
                uv_index=uv["uv_index"],
                temperature=weather["temperature"],
                rainfall_60m=weather["rainfall_60m"],
                air_score=air["air_score"],
                rip_level=rip.risk_level if rip else None,
            )

            records.append({
                "contentid": contentid,
                "tour_type": result["tour_type"],
                "air_score": result["air_score"],
                "temp_score": result["temp_score"],
                "rain_score": result["rain_score"],
                "uv_score": result["uv_score"],
                "activities": result["activities"],
                "tips": tips,
                "computed_at": now,
            })

        upsert(session, NowgoScoreCache, records, "contentid")
        session.commit()
        logger.info(f"nowgo_score_cache: {len(records)}/{len(spots)}건")
    except Exception as e:
        logger.error(f"compute_nowgo_scores error: {e}", exc_info=True)
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
