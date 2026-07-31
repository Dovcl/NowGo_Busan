"""tour_detailCommon2 + tour_detailIntro2 CSV -> tour_spot_intro 테이블 시드 스크립트.

tour_spot이 먼저 채워져 있어야 FK가 통과됨 -> seed_tour_spots.py 실행 후에 돌릴 것.
실행: backend/ 디렉토리에서 `python -m etl.seed_tour_spot_intro`
"""

import re
from pathlib import Path

import pandas as pd

from db.base import Base
from db.models import TourSpotIntro
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_SEED_DATA_DIR = Path(__file__).resolve().parent / "seed_data"
DETAIL_COMMON_CSV = _SEED_DATA_DIR / "tour_detailCommon2_busan_all.csv"
DETAIL_INTRO_CSV = _SEED_DATA_DIR / "tour_detailIntro2_busan_all.csv"

# 정규화 필드명 -> {contenttypeid: 원본 컬럼명}.
# 코스(25)는 대응하는 원본 컬럼이 없어서(거리/소요시간/테마 위주) 매핑하지 않음 -> 항상 NULL.
FIELD_MAP: dict[str, dict[int, str]] = {
    "usetime": {12: "usetime", 14: "usetimeculture", 28: "usetimeleports", 15: "usetimefestival"},
    "restdate": {12: "restdate", 14: "restdateculture", 28: "restdateleports"},
    "parking": {12: "parking", 14: "parkingculture", 28: "parkingleports"},
    "infocenter": {12: "infocenter", 14: "infocenterculture", 28: "infocenterleports"},
    "usefee": {14: "usefee", 28: "usefeeleports"},
}

_HREF_RE = re.compile(r'href="([^"]+)"')
_TAG_RE = re.compile(r"<[^>]+>")


def _clean_text(raw) -> str | None:
    """<br> 등 잔여 HTML 태그를 걷어내고 앞뒤 구분자를 정리한다."""
    if pd.isna(raw) or not str(raw).strip():
        return None
    text = _TAG_RE.sub(", ", str(raw)).strip(", ").strip()
    return text or None


def _extract_homepage(raw) -> str | None:
    """TourAPI가 <a href="...">라벨</a> 형태로 주기 때문에 URL만 뽑아낸다."""
    if pd.isna(raw) or not str(raw).strip():
        return None
    match = _HREF_RE.search(str(raw))
    return match.group(1) if match else _clean_text(raw)


def _pick_by_type(row, column_map: dict[int, str]) -> str | None:
    col = column_map.get(int(row["contenttypeid"]))
    if col is None:
        return None
    return _clean_text(row.get(col))


def seed_tour_spot_intro(session) -> None:
    common = pd.read_csv(DETAIL_COMMON_CSV)
    intro = pd.read_csv(DETAIL_INTRO_CSV)
    # contenttypeid는 두 CSV 모두에 있지만 common 쪽 값을 기준으로 삼음 (항상 채워져 있음)
    merged = common.merge(intro.drop(columns=["contenttypeid"]), on="contentid", how="left")

    records = []
    for _, row in merged.iterrows():
        record = {
            "contentid": int(row["contentid"]),
            "overview": _clean_text(row.get("overview")),
            "homepage": _extract_homepage(row.get("homepage")),
        }
        for field, column_map in FIELD_MAP.items():
            record[field] = _pick_by_type(row, column_map)
        records.append(record)

    upsert(session, TourSpotIntro, records, "contentid")
    print(f"tour_spot_intro: {len(records)}건")


def main() -> None:
    Base.metadata.create_all(engine)  # tour_spot_intro만 신규 생성, 기존 테이블은 no-op
    session = SessionLocal()
    try:
        seed_tour_spot_intro(session)
        session.commit()
        print("시드 완료")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
