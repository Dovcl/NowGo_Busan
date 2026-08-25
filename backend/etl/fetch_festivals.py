"""TourAPI searchFestival2(축제/공연/행사) — 부산 축제를 event_raw로 수집.

harness/DECISIONS.md Phase 0 참고. contenttypeid=15(축제)는 이제 tour_spot 시딩에서
빠졌고(seed_tour_spots.py), 그 데이터는 여기서 event_raw로 들어간다. searchFestival2는
eventStartDate가 필수 파라미터라 "20000101"부터 넓게 잡아 과거~예정 축제를 전부 받는다
(notebooks/03_tour_detail_explore.ipynb에서 이미 실측 검증된 파라미터 그대로 재사용 —
부산 31건, contenttypeid=15 시딩 제외분과 정확히 일치하는 것 확인됨).

이 event_raw는 아직 원본을 그대로 쌓아두기만 하는 단계다(Phase 0). 다봄/KOPIS를
붙이는 Phase 1, 실제로 소스 간 중복을 판별해 events로 합치는 Phase 2는 이후 작업.

실행: backend/ 디렉토리에서 `python -m etl.fetch_festivals`
(.env에 TOUR_API_KEY 필요)
"""

import re
from datetime import datetime
from urllib.parse import unquote

import requests

from core.config import settings
from db.base import Base
from db.models import EventRaw
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_BASE = "https://apis.data.go.kr/B551011/KorService2"
_NUM_OF_ROWS = 100
_SOURCE = "tourapi"

# TourAPI가 <a href="...">라벨</a> 형태로 주는 homepage에서 URL만 뽑는다 —
# etl/seed_tour_spot_intro.py의 _extract_homepage와 같은 패턴.
_HREF_RE = re.compile(r'href="([^"]+)"')


def _fetch_page(page: int) -> dict:
    res = requests.get(
        f"{_BASE}/searchFestival2",
        params={
            "serviceKey": unquote(settings.TOUR_API_KEY),
            "MobileOS": "ETC",
            "MobileApp": "NowGoBusan",
            "_type": "json",
            "numOfRows": _NUM_OF_ROWS,
            "pageNo": page,
            "arrange": "A",
            "areaCode": 6,  # 부산
            "eventStartDate": "20000101",
        },
        timeout=15,
    )
    res.raise_for_status()
    data = res.json()
    header = data.get("response", {}).get("header", {})
    if header.get("resultCode") != "0000":
        raise RuntimeError(f"searchFestival2 page {page} 실패: {header}")
    return data["response"]["body"]


def _extract_items(body: dict) -> list[dict]:
    item = body.get("items", {})
    item = item.get("item", []) if isinstance(item, dict) else []
    if isinstance(item, dict):
        item = [item]
    return item


def fetch_all() -> list[dict]:
    """전체 페이지 수집. totalCount와 실제 수집 건수가 다르면 예외를 던져서
    이번 수집을 통째로 버린다(fetch_road_traffic.py와 같은 무결성 원칙 — 부분 반영 금지)."""
    first = _fetch_page(1)
    total_count = int(first.get("totalCount") or 0)
    items = _extract_items(first)

    total_pages = -(-total_count // _NUM_OF_ROWS)  # ceil
    for page in range(2, total_pages + 1):
        items.extend(_extract_items(_fetch_page(page)))

    if len(items) != total_count:
        raise RuntimeError(f"수집 건수({len(items)})가 totalCount({total_count})와 불일치 — 이번 수집 중단")

    return items


def fetch_homepage(contentid: str) -> str | None:
    """detailCommon2로 이 축제의 공식 홈페이지 링크를 가져온다("자세히 보기"용).
    searchFestival2 목록 응답엔 이 필드가 없어서 항목당 1건씩 추가 호출이 필요함
    (seed_tour_spot_intro.py가 tour_spot 상세 정보를 받을 때 쓰는 것과 같은 패턴).
    defaultYN 등 옵션 플래그를 넣으면 INVALID_REQUEST_PARAMETER_ERROR가 나서(실측
    확인) contentId만 넘긴다. 개별 항목 실패는 전체를 막지 않고 그 항목만 링크 없이 둔다."""
    try:
        res = requests.get(
            f"{_BASE}/detailCommon2",
            params={
                "serviceKey": unquote(settings.TOUR_API_KEY),
                "MobileOS": "ETC",
                "MobileApp": "NowGoBusan",
                "_type": "json",
                "contentId": contentid,
            },
            timeout=15,
        )
        res.raise_for_status()
        data = res.json()
        if data.get("response", {}).get("header", {}).get("resultCode") != "0000":
            return None
        items = _extract_items(data["response"]["body"])
        homepage_raw = items[0].get("homepage") if items else None
        if not homepage_raw:
            return None
        match = _HREF_RE.search(homepage_raw)
        return match.group(1) if match else None
    except (requests.RequestException, KeyError, ValueError):
        return None


def main() -> None:
    Base.metadata.create_all(engine)  # event_raw만 신규 생성, 기존 테이블은 no-op

    session = SessionLocal()
    try:
        items = fetch_all()
        fetched_at = datetime.now()
        records = []
        homepage_found = 0
        for item in items:
            if not item.get("contentid"):
                continue
            homepage = fetch_homepage(item["contentid"])
            if homepage:
                homepage_found += 1
            records.append(
                {
                    "source": _SOURCE,
                    "source_event_id": str(item["contentid"]),
                    "raw_payload": item,
                    "fetched_at": fetched_at,
                    "source_url": homepage,
                }
            )

        upsert(session, EventRaw, records, ["source", "source_event_id"])
        session.commit()
        print(f"event_raw({_SOURCE}): {len(records)}건 수집 (홈페이지 링크 {homepage_found}건 확보)")
    finally:
        session.close()


if __name__ == "__main__":
    main()
