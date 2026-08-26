"""부산문화포털 다봄(BusanCultureThemeService) 공연·전시 목록 — event_raw로 수집.

harness/DECISIONS.md Phase 1(다봄 재개) 참고. TOUR_API_KEY 활용신청이 승인돼서
새 키 없이 기존 계정 키로 바로 동작함(실측 확인).

TourAPI/KOPIS와 다른 점(전부 실측으로 확인):
- 응답 헤더는 `code`/`message`(예: "00"/"NORMAL_CODE") — TourAPI(`0000`)와도 KOPIS(XML)와도
  다른 자체 포맷.
- **날짜 필터 파라미터가 없음**(opStDt 등 여러 이름으로 시도해봤지만 전부 무시됨). 대신
  응답이 등록 순서(res_no, 대략 연월 접두어)로 오래된 것부터 정렬돼 있어서, 마지막 페이지
  근처에 최신/예정 항목이 몰려있다. 그래도 정확히 어디부터가 "안 끝난 행사"인지는 등록순과
  실제 공연기간이 항상 일치하진 않아서(예: 예전에 등록해놓고 기간이 긴 것) 전체(현재
  15,224건, 16페이지)를 다 받은 뒤 op_ed_dt로 직접 걸러낸다 — 매 실행 16콜이면 부담 없음.
- 이미지 필드가 아예 없음(TourAPI firstimage, KOPIS poster 같은 게 없음) — event_raw엔
  그대로 저장하고, 카드에 이미지가 비어도 정상(수집 이슈 아님).
- `dabom_url`이 목록 응답에 이미 완성된 형태로 들어있어서(TourAPI처럼 상세 API를 따로
  안 불러도 됨, KOPIS처럼 URL을 직접 조립할 필요도 없음) 그대로 source_url로 씀. http
  URL이지만 실제로 정상 응답하는 것 확인(https로도 접속 확인) — 브라우저에서 그대로 열림.
- `prg_nm`(전시/클래식/연극/뮤지컬/무용/전통예술/대중음악/복합/기타)이 카테고리 신호로
  바로 씀직함 — "전시"만 골라내면 이 프로젝트의 5개 카테고리 중 실데이터가 하나도 없던
  `exhibition`을 처음으로 채울 수 있음(build_events.py의 normalize_dabom에서 처리).

실행: backend/ 디렉토리에서 `python -m etl.fetch_dabom`
(.env의 TOUR_API_KEY 그대로 사용 — 다봄 전용 키 없음)
"""

from datetime import date, datetime
from urllib.parse import unquote

import requests

from core.config import settings
from db.base import Base
from db.models import EventRaw
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_URL = "https://apis.data.go.kr/6260000/BusanCultureThemeService/getBusanCultureTheme"
_NUM_OF_ROWS = 1000
_SOURCE = "dabom"


def _fetch_page(page: int) -> dict:
    res = requests.get(
        _URL,
        params={
            "serviceKey": unquote(settings.TOUR_API_KEY),
            "pageNo": page,
            "numOfRows": _NUM_OF_ROWS,
            "resultType": "json",
        },
        timeout=20,
    )
    res.raise_for_status()
    data = res.json()["getBusanCultureTheme"]
    if data.get("header", {}).get("code") != "00":
        raise RuntimeError(f"getBusanCultureTheme page {page} 실패: {data.get('header')}")
    return data


def fetch_all() -> list[dict]:
    """전체 페이지 수집. 이 API는 날짜 필터가 없어서 매번 전체를 받고 나중에 거른다
    (지금 기준 16페이지, ~15,224건 — 부담 없는 수준). 수집 건수가 totalCount와 다르면
    이번 수집을 통째로 버린다(다른 fetch 스크립트와 같은 무결성 원칙)."""
    first = _fetch_page(1)
    total_count = int(first.get("totalCount") or 0)
    items = list(first["item"])

    total_pages = -(-total_count // _NUM_OF_ROWS)
    for page in range(2, total_pages + 1):
        items.extend(_fetch_page(page)["item"])

    if len(items) != total_count:
        raise RuntimeError(f"수집 건수({len(items)})가 totalCount({total_count})와 불일치 — 이번 수집 중단")

    return items


def _still_relevant(item: dict, today: date) -> bool:
    """이미 끝난 행사는 event_raw에 안 쌓는다(15,224건 대부분이 과거 이력이라 그대로
    다 넣으면 노이즈만 커짐 — KOPIS도 같은 이유로 180일 윈도우로 스코프를 좁혔음)."""
    raw_end = item.get("op_ed_dt")
    if not raw_end:
        return False
    try:
        end_date = datetime.strptime(raw_end, "%Y-%m-%d").date()
    except ValueError:
        return False  # "0000-00-00" 같은 결측 더미값
    return end_date >= today


def main() -> None:
    Base.metadata.create_all(engine)  # event_raw는 이미 있음, no-op

    session = SessionLocal()
    try:
        items = fetch_all()
        today = date.today()
        relevant = [item for item in items if _still_relevant(item, today)]

        fetched_at = datetime.now()
        records = [
            {
                "source": _SOURCE,
                "source_event_id": str(item["res_no"]),
                "raw_payload": item,
                "fetched_at": fetched_at,
                "source_url": item.get("dabom_url"),
            }
            for item in relevant
            if item.get("res_no")
        ]

        upsert(session, EventRaw, records, ["source", "source_event_id"])
        session.commit()
        print(f"event_raw({_SOURCE}): 전체 {len(items)}건 중 진행중/예정 {len(records)}건 수집")
    finally:
        session.close()


if __name__ == "__main__":
    main()
