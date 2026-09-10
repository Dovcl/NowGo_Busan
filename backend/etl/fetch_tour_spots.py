"""TourAPI KorService2 areaBasedList2를 매일 1회 호출해 tour_spot 목록을
실시간으로 갱신한다. 그동안은 노트북에서 1회성으로 뽑은 CSV 스냅샷
(seed_data/tour_areaBasedList2_busan_all.csv)에만 의존해서 데이터가 갱신되지
않았음 — 이 스크립트가 그 자리를 대체한다(harness/DECISIONS.md 참고).

상세(detailCommon2/detailIntro2)는 관광지 전체(763건 내외)를 매번 다시 부르지
않고, 목록에서 modifiedtime이 DB와 다르거나 신규인 관광지만 골라서 호출한다 —
TourAPI 키의 일일 호출 한도가 낮아(사용자 확인: 1,000회/일 이하) 매일 전체를
다시 부르면 한도를 바로 넘긴다. 최초 실행도 CSV 스냅샷이 이미 baseline으로
깔려 있어(seed_tour_spots.py/seed_tour_spot_intro.py) 전체가 아니라 그 이후
신규/변경분만 호출된다.

주의: areaBasedList2/detailCommon2/detailIntro2의 실제 파라미터·응답 형태는
fetch_festivals.py(searchFestival2)와 seed_data/*.csv(같은 API 계열의 과거
응답)를 기준으로 작성했지만, 이 스크립트 자체는 라이브 API에 대고 실행/검증된
적이 없다 — 처음 돌릴 때 반드시 실제 응답을 확인할 것.

실행: backend/ 디렉토리에서 `python -m etl.fetch_tour_spots`
(.env에 TOUR_API_KEY 필요)
"""

from urllib.parse import unquote

import pandas as pd
import requests

from core.config import settings
from db.models import TourSpot
from db.session import SessionLocal
from etl.seed_tour_spot_intro import sync_tour_spot_intro_from_df
from etl.seed_tour_spots import parse_tour_time, sync_tour_spot_and_classification

_BASE = "https://apis.data.go.kr/B551011/KorService2"
_NUM_OF_ROWS = 100
_AREA_CODE_BUSAN = 6
_FESTIVAL_CONTENTTYPEID = 15  # fetch_festivals.py가 event_raw로 별도 수집


def _request(path: str, params: dict) -> dict:
    res = requests.get(
        f"{_BASE}/{path}",
        params={
            "serviceKey": unquote(settings.TOUR_API_KEY),
            "MobileOS": "ETC",
            "MobileApp": "NowGoBusan",
            "_type": "json",
            **params,
        },
        timeout=15,
    )
    res.raise_for_status()
    data = res.json()
    header = data.get("response", {}).get("header", {})
    if header.get("resultCode") != "0000":
        raise RuntimeError(f"{path} 실패: {header}")
    return data["response"]["body"]


def _extract_items(body: dict) -> list[dict]:
    item = body.get("items", {})
    item = item.get("item", []) if isinstance(item, dict) else []
    if isinstance(item, dict):
        item = [item]
    return item


def fetch_all_list() -> list[dict]:
    """fetch_festivals.py와 같은 무결성 원칙 — totalCount와 실제 수집 건수가
    다르면 이번 수집을 통째로 버린다(부분 반영 금지)."""
    params = {"numOfRows": _NUM_OF_ROWS, "pageNo": 1, "arrange": "A", "areaCode": _AREA_CODE_BUSAN}
    first = _request("areaBasedList2", params)
    total_count = int(first.get("totalCount") or 0)
    items = _extract_items(first)

    total_pages = -(-total_count // _NUM_OF_ROWS)  # ceil
    for page in range(2, total_pages + 1):
        items.extend(_extract_items(_request("areaBasedList2", {**params, "pageNo": page})))

    if len(items) != total_count:
        raise RuntimeError(f"수집 건수({len(items)})가 totalCount({total_count})와 불일치 — 이번 수집 중단")
    return items


def fetch_detail_common(contentid: str) -> dict | None:
    body = _request("detailCommon2", {"contentId": contentid})
    items = _extract_items(body)
    return items[0] if items else None


def fetch_detail_intro(contentid: str, contenttypeid: str) -> dict | None:
    body = _request("detailIntro2", {"contentId": contentid, "contentTypeId": contenttypeid})
    items = _extract_items(body)
    return items[0] if items else None


def _changed_contentids(session, df: pd.DataFrame) -> set[int]:
    """신규 관광지이거나 목록의 modifiedtime이 DB에 저장된 값과 다른 것만
    상세 재조회 대상으로 고른다(parse_tour_time으로 목록의 원본 문자열을 DB와
    같은 datetime으로 변환해 비교)."""
    existing = dict(session.query(TourSpot.contentid, TourSpot.modifiedtime).all())
    changed = set()
    for row in df.itertuples():
        contentid = int(row.contentid)
        modifiedtime = parse_tour_time(row.modifiedtime)
        if contentid not in existing or existing[contentid] != modifiedtime:
            changed.add(contentid)
    return changed


def fetch_changed_details(df: pd.DataFrame, changed_ids: set[int]) -> pd.DataFrame:
    """변경분 contentid만 detailCommon2 + detailIntro2를 호출해 sync_tour_spot_intro_from_df가
    기대하는 병합된 df로 만든다. 개별 항목 실패는 그 항목만 건너뛰고 전체 수집은 막지 않는다
    (fetch_festivals.py의 fetch_homepage와 같은 원칙)."""
    rows = []
    for row in df.itertuples():
        contentid = int(row.contentid)
        if contentid not in changed_ids:
            continue
        try:
            common = fetch_detail_common(str(contentid))
            intro = fetch_detail_intro(str(contentid), str(int(row.contenttypeid)))
        except (requests.RequestException, RuntimeError, ValueError):
            continue
        if common is None:
            continue
        rows.append({**common, **(intro or {})})
    return pd.DataFrame(rows)


def main() -> None:
    session = SessionLocal()
    try:
        items = fetch_all_list()
        df = pd.DataFrame(items)
        # CSV(pd.read_csv)는 빈 칸을 자동으로 NaN 처리하지만, 라이브 JSON은 값이
        # 없는 숫자 필드(mlevel 등)를 빈 문자열 ""로 준다 — 실측 확인(contenttypeid=16
        # 일부 항목에서 mlevel=""로 와서 smallint insert가 실패했음). sync_tour_spot_
        # and_classification은 CSV 기준으로 짜여 있어 NaN을 기대하므로 여기서 맞춰준다.
        df = df.replace("", pd.NA)
        df["contenttypeid"] = df["contenttypeid"].astype(int)
        df = df[df["contenttypeid"] != _FESTIVAL_CONTENTTYPEID].reset_index(drop=True)

        changed_ids = _changed_contentids(session, df)
        sync_tour_spot_and_classification(session, df)
        session.commit()
        print(f"tour_spot 목록 갱신 완료 (전체 {len(df)}건, 신규/변경 상세 대상 {len(changed_ids)}건)")

        if changed_ids:
            detail_df = fetch_changed_details(df, changed_ids)
            if not detail_df.empty:
                sync_tour_spot_intro_from_df(session, detail_df)
                session.commit()
            print(f"tour_spot_intro 상세 갱신: {len(detail_df)}건 (요청 {len(changed_ids)}건 중)")
        else:
            print("tour_spot_intro: 변경분 없음")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
