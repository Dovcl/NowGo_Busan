"""수집 파이프라인 데이터 점검 — 관리자 전용.

날씨/UV/대기질/이안류/도로교통/공휴일/구·군 방문객 baseline 등 배치 ETL이 실제로
데이터를 쌓고 있는지 테이블 그대로 확인하기 위한 용도(harness/DECISIONS.md의
s_traffic/공휴일 보정 작업 참고). 화면 노출용이 아니라 운영 점검용이라 컬럼을 가공하지
않고 원본 그대로 페이지네이션해서 보여준다. `require_admin`이 실제 보안 경계."""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.models import (
    AirQualityCache,
    DistrictVisitorBaseline,
    HolidayCache,
    RipCurrentCache,
    RoadLinkBaseline,
    RoadLinkTrafficCache,
    RoadLinkTrafficHistory,
    UvIndexCache,
    User,
    WeatherCache,
)
from db.session import get_db
from routers.auth import require_admin

router = APIRouter(prefix="/admin/data", tags=["Admin"])

# {테이블 키: (모델, 정렬 컬럼, 방향)} — 정렬은 "최근 걸 먼저 보고 싶다"는 점검 목적에 맞춤.
# 화이트리스트 방식만 허용 — 임의 테이블명을 받지 않는다(정보 노출·SQL 인젝션 방지).
_TABLE_REGISTRY = {
    "road_link_baseline": (RoadLinkBaseline, "sample_count", "desc"),
    "road_link_traffic_cache": (RoadLinkTrafficCache, "fetched_at", "desc"),
    "road_link_traffic_history": (RoadLinkTrafficHistory, "observed_at", "desc"),
    "holiday_cache": (HolidayCache, "date", "asc"),
    "district_visitor_baseline": (DistrictVisitorBaseline, "sigungu_code", "asc"),
    "weather_cache": (WeatherCache, "fetched_at", "desc"),
    "uv_index_cache": (UvIndexCache, "fetched_at", "desc"),
    "air_quality_cache": (AirQualityCache, "fetched_at", "desc"),
    "rip_current_cache": (RipCurrentCache, "fetched_at", "desc"),
}


@router.get("/tables")
def list_tables(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """테이블 목록 + 각 총 행 수 — 데이터가 쌓이고 있는지 한눈에 보는 용도."""
    return [
        {"table": key, "row_count": db.query(model).count()}
        for key, (model, _order_col, _direction) in _TABLE_REGISTRY.items()
    ]


@router.get("/tables/{table}")
def list_table_rows(
    table: str,
    page: int = 1,
    page_size: int = 20,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if table not in _TABLE_REGISTRY:
        raise HTTPException(status_code=404, detail="알 수 없는 테이블입니다")
    if page < 1 or not (1 <= page_size <= 200):
        raise HTTPException(status_code=400, detail="page/page_size 범위를 확인해주세요")

    model, order_col, direction = _TABLE_REGISTRY[table]
    # geom(PostGIS) 컬럼은 그대로 직렬화가 안 돼서 목록에서 제외 — 점검 목적엔 좌표보다
    # 갱신 시각·표본 수가 더 중요함
    columns = [c.name for c in model.__table__.columns if c.type.__class__.__name__ != "Geometry"]

    total = db.query(model).count()
    order_by_col = getattr(model, order_col)
    query = db.query(model).order_by(order_by_col.desc() if direction == "desc" else order_by_col.asc())
    rows = query.offset((page - 1) * page_size).limit(page_size).all()

    return {
        "table": table,
        "columns": columns,
        "rows": [{col: getattr(row, col) for col in columns} for row in rows],
        "total": total,
        "page": page,
        "page_size": page_size,
    }
