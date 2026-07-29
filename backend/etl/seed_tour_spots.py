"""backend/etl/seed_data/ CSV -> PostGIS 5개 테이블 시드 스크립트.

실행: backend/ 디렉토리에서 `python -m etl.seed_tour_spots`
(db.models, etl.classify_tour_type을 절대 import로 쓰기 때문에 backend/가 cwd여야 함)
"""

from datetime import datetime
from pathlib import Path

import pandas as pd
from geoalchemy2 import WKTElement
from sqlalchemy.dialects.postgresql import insert as pg_insert

from db.models import (
    CategoryCode,
    ContentType,
    SigunguCode,
    TourSpot,
    TourSpotEnvClassification,
)
from db.session import SessionLocal
from etl.classify_tour_type import classify

_SEED_DATA_DIR = Path(__file__).resolve().parent / "seed_data"
SIGUNGU_CSV = _SEED_DATA_DIR / "tour_areaCode2_busan_sigungu.csv"
CATEGORY_CSV = _SEED_DATA_DIR / "tour_categoryCode2_all.csv"
CONTENT_TYPE_CSV = _SEED_DATA_DIR / "tour_contentTypeId.csv"
TOUR_SPOT_CSV = _SEED_DATA_DIR / "tour_areaBasedList2_busan_all.csv"


def upsert(session, model, records: list[dict], pk_col: str) -> None:
    """records를 한 번에 INSERT하되, PK가 이미 있으면 나머지 컬럼을 갱신한다.
    (재실행해도 에러 없이 최신값으로 덮어써지도록 — 개발 중 스키마/데이터가 자주 바뀌어서 필요)"""
    if not records:
        return
    stmt = pg_insert(model).values(records)
    update_cols = {
        col.name: getattr(stmt.excluded, col.name)
        for col in model.__table__.columns
        if col.name != pk_col
    }
    stmt = stmt.on_conflict_do_update(index_elements=[pk_col], set_=update_cols)
    session.execute(stmt)


def seed_sigungu_code(session) -> None:
    df = pd.read_csv(SIGUNGU_CSV)
    records = [{"code": int(row.code), "name": row.name} for row in df.itertuples()]
    upsert(session, SigunguCode, records, "code")
    print(f"sigungu_code: {len(records)}건")


def seed_category_code(session) -> None:
    df = pd.read_csv(CATEGORY_CSV)
    df = df.where(pd.notna(df), None)
    records = df.to_dict(orient="records")
    upsert(session, CategoryCode, records, "code")
    print(f"category_code: {len(records)}건")


def seed_content_type(session) -> None:
    df = pd.read_csv(CONTENT_TYPE_CSV)
    df = df.where(pd.notna(df), None)
    records = df.to_dict(orient="records")
    upsert(session, ContentType, records, "contenttypeid")
    print(f"content_type: {len(records)}건")


def _parse_tour_time(raw) -> datetime | None:
    # TourAPI 원본 형식: 20230101120000 (문자열이 아니라 정수로 읽힘)
    if pd.isna(raw):
        return None
    return datetime.strptime(str(int(raw)), "%Y%m%d%H%M%S")


def _none_if_nan(value):
    return None if pd.isna(value) else value


def seed_tour_spot_and_classification(session) -> None:
    df = pd.read_csv(TOUR_SPOT_CSV)
    classified = classify(df)  # env_type_code, env_group4 등 6개 컬럼 추가됨

    tour_spot_records = []
    classification_records = []

    for row in classified.itertuples():
        sigungucode = _none_if_nan(row.sigungucode)
        tour_spot_records.append(
            {
                "contentid": int(row.contentid),
                "contenttypeid": int(row.contenttypeid),
                "title": row.title,
                "addr1": _none_if_nan(row.addr1),
                "addr2": _none_if_nan(row.addr2),
                "areacode": _none_if_nan(row.areacode),
                "sigungucode": int(sigungucode) if sigungucode is not None else None,
                "cat1": _none_if_nan(row.cat1),
                "cat2": _none_if_nan(row.cat2),
                "cat3": _none_if_nan(row.cat3),
                "tel": _none_if_nan(row.tel),
                "zipcode": _none_if_nan(row.zipcode),
                "mlevel": _none_if_nan(row.mlevel),
                "firstimage": _none_if_nan(row.firstimage),
                "firstimage2": _none_if_nan(row.firstimage2),
                "cpyrhtdivcd": _none_if_nan(row.cpyrhtDivCd),
                "createdtime": _parse_tour_time(row.createdtime),
                "modifiedtime": _parse_tour_time(row.modifiedtime),
                "ldongregncd": _none_if_nan(row.lDongRegnCd),
                "ldongsignugucd": _none_if_nan(row.lDongSignguCd),
                "lclssystm1": _none_if_nan(row.lclsSystm1),
                "lclssystm2": _none_if_nan(row.lclsSystm2),
                "lclssystm3": _none_if_nan(row.lclsSystm3),
                "geom": WKTElement(f"POINT({row.mapx} {row.mapy})", srid=4326),
            }
        )

        classification_records.append(
            {
                "contentid": int(row.contentid),
                "env_type_code": row.env_type_code,
                "env_group4": row.env_group4,
                "is_outdoor": bool(row.is_outdoor),
                "is_env_target": bool(row.is_env_target),
                "direct_water_contact": bool(row.direct_water_contact),
                "water_quality_zone": bool(row.water_quality_zone),
            }
        )

    # tour_spot이 먼저 있어야 tour_spot_env_classification의 FK가 통과됨
    upsert(session, TourSpot, tour_spot_records, "contentid")
    print(f"tour_spot: {len(tour_spot_records)}건")

    upsert(session, TourSpotEnvClassification, classification_records, "contentid")
    print(f"tour_spot_env_classification: {len(classification_records)}건")


def main() -> None:
    session = SessionLocal()
    try:
        # FK 순서: lookup 3개(서로 독립) -> tour_spot -> tour_spot_env_classification
        seed_sigungu_code(session)
        seed_category_code(session)
        seed_content_type(session)
        seed_tour_spot_and_classification(session)
        session.commit()
        print("시드 완료")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
