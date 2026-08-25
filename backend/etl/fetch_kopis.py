"""KOPIS(공연예술통합전산망) 공연목록(pblprfr) + 축제목록(prffest) — 부산을 event_raw로 수집.

harness/DECISIONS.md Phase 1 참고. TourAPI(searchFestival2)만으로는 티켓 공연(콘서트/
뮤지컬/연극 등)이 거의 안 잡혀서 KOPIS로 커버리지를 넓힌다.

TourAPI와 다른 점 몇 가지(전부 실측으로 확인):
- 응답이 JSON이 아니라 XML이고, `<dbs><db>...</db></dbs>` 형태의 평평한 항목 리스트라
  ElementTree로 직접 파싱한다.
- totalCount가 응답에 없다 — 한 페이지(rows개)보다 적게 오면 마지막 페이지로 간주한다.
- stdate/eddate가 필수이고, 날짜 범위는 "그 기간과 겹치는 공연"을 돌려준다(시작일이
  범위보다 훨씬 이전이어도 종료일이 범위 안이면 포함됨 — 실측 확인, 오픈런 공연도 잘 잡힘).
  TourAPI 축제(31건)처럼 전체를 다 가져올 필요는 없고(KOPIS는 전국 규모 데이터라 과거까지
  넓히면 수천 건), "지금부터 N일" 범위로 스코프를 좁힌다.
- signgucode=26(법정동 지역코드, 부산 — TourAPI 원본 데이터의 lDongRegnCd와 동일 체계)로
  부산만 필터링.
- pblprfr(공연 전체)와 prffest(그중 festival=Y인 것만)는 서로 겹치는 mt20id가 나올 수
  있어서(같은 공연이 두 목록에 다 걸림), 저장 전에 dict를 merge해 한 항목당 한 행만
  event_raw에 들어가게 한다(안 그러면 나중에 upsert가 두 번 일어나며 필드가 덮어써짐).
- 가끔 페이지 요청이 일시적으로 실패하는 게 실측으로 확인돼(재시도하면 바로 성공), 재시도
  로직을 넣는다(fetch_road_traffic.py와 같은 패턴).

실행: backend/ 디렉토리에서 `python -m etl.fetch_kopis`
(.env에 KOPIS_API_KEY 필요 — kopis.or.kr에서 별도 발급, data.go.kr 키와 무관)
"""

import time
import xml.etree.ElementTree as ET
from datetime import datetime, timedelta

import requests

from core.config import settings
from db.base import Base
from db.models import EventRaw
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_BASE = "http://www.kopis.or.kr/openApi/restful"
_NUM_OF_ROWS = 100
_MAX_RETRY = 3
_LOOKAHEAD_DAYS = 180  # KOPIS는 전국 이력 데이터라 TourAPI처럼 전체를 안 받고 "다가오는 N일"만
_SIGNGUCODE_BUSAN = 26
_SOURCE = "kopis"


def _fetch_page(path: str, page: int, stdate: str, eddate: str) -> list[dict]:
    for attempt in range(_MAX_RETRY):
        res = requests.get(
            f"{_BASE}{path}",
            params={
                "service": settings.KOPIS_API_KEY,
                "stdate": stdate,
                "eddate": eddate,
                "cpage": page,
                "rows": _NUM_OF_ROWS,
                "signgucode": _SIGNGUCODE_BUSAN,
            },
            timeout=15,
        )
        if res.status_code == 200:
            root = ET.fromstring(res.text)
            return [{child.tag: child.text for child in db} for db in root.findall("db")]
        time.sleep(0.5)
    raise RuntimeError(f"{path} page {page} 수집 실패(재시도 {_MAX_RETRY}회 소진, 마지막 status={res.status_code})")


def fetch_all(path: str, stdate: str, eddate: str) -> list[dict]:
    """totalCount가 없는 API라, 한 페이지가 rows보다 적게 오면 마지막 페이지로 간주."""
    items = []
    page = 1
    while True:
        page_items = _fetch_page(path, page, stdate, eddate)
        items.extend(page_items)
        if len(page_items) < _NUM_OF_ROWS:
            break
        page += 1
    return items


def main() -> None:
    Base.metadata.create_all(engine)  # event_raw는 Phase 0에서 이미 생성됨, no-op

    today = datetime.now()
    stdate = today.strftime("%Y%m%d")
    eddate = (today + timedelta(days=_LOOKAHEAD_DAYS)).strftime("%Y%m%d")

    performances = fetch_all("/pblprfr", stdate, eddate)
    festivals = fetch_all("/prffest", stdate, eddate)

    # mt20id 기준으로 merge — 두 목록에 같은 공연이 겹칠 수 있어서 한 항목당 한 행만 만든다.
    merged: dict[str, dict] = {}
    for item in performances + festivals:
        mt20id = item.get("mt20id")
        if not mt20id:
            continue
        merged.setdefault(mt20id, {}).update(item)

    fetched_at = datetime.now()
    records = [
        {
            "source": _SOURCE,
            "source_event_id": mt20id,
            "raw_payload": payload,
            "fetched_at": fetched_at,
            # 실측 확인: menuId 파라미터가 없거나 mt20id를 소문자로 쓰면 홈으로 리다이렉트되고
            # 내용이 안 뜬다(사용자가 발견) — menuId=MNU_00020 + mt20Id(대문자 I) 조합이어야 함.
            "source_url": f"http://www.kopis.or.kr/por/db/pblprfr/pblprfrView.do?menuId=MNU_00020&mt20Id={mt20id}",
        }
        for mt20id, payload in merged.items()
    ]

    session = SessionLocal()
    try:
        upsert(session, EventRaw, records, ["source", "source_event_id"])
        session.commit()
        print(
            f"event_raw({_SOURCE}): {len(records)}건 수집 "
            f"(공연 {len(performances)} + 축제 {len(festivals)}, 중복 병합 후 {len(records)}, "
            f"기간 {stdate}~{eddate})"
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
