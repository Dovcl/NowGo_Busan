"""부산 최상급 랜드마크(해수욕장 6곳 + 태종대·이기대·감천문화마을·용두산공원)가
`etl/fetch_tour_spots.py`의 `areaBasedList2?areaCode=6` 목록에 아예 안 잡히는
문제를 보정한다.

실측 확인(2026-09-12): TourAPI 원본 데이터 자체에서 이 항목들의 `areacode`/
`sigungucode` 필드가 빈 문자열이라 "부산(areaCode=6)" 목록 조회에서 서버 측
필터에 안 걸린다 — 우리 ETL 버그가 아니라 TourAPI 원본 데이터 결측(레거시 등록
항목으로 추정). `detailCommon2`를 contentid로 직접 호출하면 정상 조회되고,
`lDongRegnCd`/`lDongSignguCd`(신규 코드체계)는 이미 정상 채워져 있다 — 비어있는
건 구코드체계(`areacode`/`sigungucode`)뿐이라 여기서 직접 채워준다.

`cat3`도 함께 비어있어서 `classify_tour_type.py`의 cat3 기반 분류가 안 먹힌다
(자동으로 URBAN fallback됨) — 이건 `classify_tour_type.LOCATION_OVERRIDE_BY_TITLE`에
같이 등록해서 보정한다(이 파일에서 값을 조작하지 않고 그대로 둠 — cat3 결측은
사실이라 데이터를 정직하게 유지).
"""

import pandas as pd

from etl.seed_tour_spot_intro import sync_tour_spot_intro_from_df
from etl.seed_tour_spots import sync_tour_spot_and_classification
from etl.tourapi_client import fetch_detail_common, fetch_detail_intro

_AREA_CODE_BUSAN = 6

# contentid -> TourAPI 표준 시군구코드(sigungu_code.code, seed_data/tour_areaCode2_busan_sigungu.csv 기준).
# lDongRegnCd/lDongSignguCd(신규 코드체계)는 API 응답에 이미 정상 채워져 있어 그대로 두고,
# 이 구코드체계만 주소(addr1) 확인 후 직접 채운다.
MISSING_LANDMARK_SIGUNGUCODE: dict[int, int] = {
    126081: 16,   # 해운대해수욕장 -> 해운대구
    126078: 12,   # 광안리해수욕장 -> 수영구
    126080: 16,   # 송정해수욕장 -> 해운대구
    126079: 10,   # 다대포해수욕장 -> 사하구
    126098: 3,    # 일광해수욕장 -> 기장군
    1939570: 3,   # 임랑해수욕장 -> 기장군
    126658: 14,   # 태종대 -> 영도구
    1997221: 10,  # 감천문화마을 -> 사하구
    126121: 15,   # 용두산공원 -> 중구
    1945309: 4,   # 이기대 -> 남구
}


def fetch_missing_landmarks_df() -> pd.DataFrame:
    """위 화이트리스트를 contentid로 직접 조회해 tour_spot/tour_spot_intro
    싱크 함수가 기대하는 형태의 df로 만든다. 개별 항목 실패는 건너뛰고
    나머지는 계속 진행한다(fetch_tour_spots.fetch_changed_details와 동일 원칙)."""
    rows = []
    for contentid, sigungucode in MISSING_LANDMARK_SIGUNGUCODE.items():
        common = fetch_detail_common(str(contentid))
        if common is None:
            continue
        intro = fetch_detail_intro(str(contentid), str(common["contenttypeid"]))
        row = {**common, **(intro or {})}
        row["areacode"] = _AREA_CODE_BUSAN
        row["sigungucode"] = sigungucode
        rows.append(row)

    df = pd.DataFrame(rows)
    if df.empty:
        return df
    df = df.replace("", pd.NA)
    df["contenttypeid"] = df["contenttypeid"].astype(int)
    return df


def sync_missing_landmarks(session) -> None:
    df = fetch_missing_landmarks_df()
    if df.empty:
        print("누락 랜드마크: 조회 실패 0/0건")
        return
    sync_tour_spot_and_classification(session, df)
    sync_tour_spot_intro_from_df(session, df)
    print(f"누락 랜드마크 보정: {len(df)}/{len(MISSING_LANDMARK_SIGUNGUCODE)}건")
