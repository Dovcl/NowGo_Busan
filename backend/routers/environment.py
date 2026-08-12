from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from db.session import get_db
from schemas.environment import EnvironmentOut
from services.environment.lookup import get_environment

router = APIRouter()


@router.get("/environment", response_model=EnvironmentOut, tags=["Environment"])
def read_environment(lat: float, lon: float, db: Session = Depends(get_db)):
    """좌표 하나로 날씨·대기질·자외선을 조회한다. 관광지 상세페이지든 GPS 기반 "내 주변"
    기능이든 좌표만 주면 동일하게 동작한다(harness/DECISIONS.md 2026-08-12 참고). 전부
    배치로 미리 캐싱된 값이라 매 요청마다 외부 API를 호출하지 않는다."""
    return get_environment(db, lat, lon)
