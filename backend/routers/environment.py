from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.environment import EnvironmentOut, TrafficHistoryOut, WeatherWarningOut
from services.environment.lookup import get_environment, recent_weather_warnings
from services.traffic.calculate import traffic_history_for_spot

router = APIRouter()


@router.get("/environment", response_model=EnvironmentOut, tags=["Environment"])
def read_environment(lat: float, lon: float, db: Session = Depends(get_db)):
    """좌표 하나로 날씨·대기질·자외선을 조회한다. 관광지 상세페이지든 GPS 기반 "내 주변"
    기능이든 좌표만 주면 동일하게 동작한다(harness/DECISIONS.md 2026-08-12 참고). 전부
    배치로 미리 캐싱된 값이라 매 요청마다 외부 API를 호출하지 않는다."""
    return get_environment(db, lat, lon)


@router.get("/environment/traffic-history", response_model=TrafficHistoryOut, tags=["Environment"])
def read_traffic_history(lat: float, lon: float, db: Session = Depends(get_db)):
    """"오늘 실측 vs 평소 baseline" 그래프용 — 오늘 0시~지금 시간대별 실측 속도 +
    24시간 전체 baseline 속도. 반경 내 도로 링크가 없으면 빈 리스트."""
    return {"hours": traffic_history_for_spot(db, lat, lon)}


@router.get("/weather-warnings", response_model=list[WeatherWarningOut], tags=["Environment"])
def read_weather_warnings(db: Session = Depends(get_db)):
    """부산 지점 최근 기상특보 발표 목록(최신순). 좌표 무관 — 도시 전역 단위 피드."""
    return [
        {"title": row.title, "issued_at": row.tm_fc}
        for row in recent_weather_warnings(db)
    ]
