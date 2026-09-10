"""EngService2/ChsService2에서 부산 관광지 영어·중국어(간체) 정보를 가져와
TourSpot.title_en/title_zh/addr1_en/addr1_zh, TourSpotIntro.overview_en/overview_zh에 채운다.

KorService2와 contentid 체계가 완전히 별개라(실측 확인 — 같은 관광지도 서비스마다
번호가 다름, 공식 대조 필드도 없음) 직접 조회로 이어붙일 수 없다. 대신 외국어
제목에 흔히 괄호로 들어있는 원본 한국어명(예: "168 Stairs (168계단)")을
tour_spot.title과 정확히 일치시켜서만 연결한다 — 부분/유사 매칭은 하지 않는다
(오매칭 방지가 커버리지보다 우선, harness/DECISIONS.md 2026-09-10 참고).

실측 기준 매칭률은 낮다(부산 기준 영어 158건 중 39건, 중국어 155건 중 19건) —
외국어 서비스 자체가 KorService2보다 훨씬 작고 의료관광 등 다른 콘텐츠 위주다.
매칭 안 되는 관광지는 컬럼이 NULL로 남고 프론트가 한국어(title/addr1/overview)로
폴백한다.

실행: backend/ 디렉토리에서 `python -m etl.fetch_tour_spot_translations`
(.env에 ENG_SERVICE_API_KEY, CHN_SERVICE_API_KEY 필요 — TOUR_API_KEY와 별도로
data.go.kr에서 각각 활용신청·승인이 필요하다)
"""

import re
from urllib.parse import unquote

import requests

from core.config import settings
from db.models import TourSpot, TourSpotIntro
from db.schema_migrations import ensure_schema
from db.session import SessionLocal
from etl.seed_tour_spots import upsert

_BASE = "https://apis.data.go.kr/B551011"
_NUM_OF_ROWS = 100
_AREA_CODE_BUSAN = 6

# TourAPI 외국어 서비스 실제 경로명 — 흔히 예상하는 "EngService2"/"ChnService2"와
# 달리 중국어는 "Chs"(간체)/"Cht"(번체)로 갈라져 있다(실측 확인, ChnService2/ChnService1은
# NO_OPENAPI_SERVICE_ERROR). 프론트 zh 로케일이 간체 기준이라 ChsService2를 쓴다.
LANGUAGES = {
    "en": {"service": "EngService2", "api_key": lambda: settings.ENG_SERVICE_API_KEY},
    "zh": {"service": "ChsService2", "api_key": lambda: settings.CHN_SERVICE_API_KEY},
}

_PAREN_KOREAN_RE = re.compile(r"\(([^)]*[가-힣][^)]*)\)")


def _request(service: str, api_key: str, path: str, params: dict) -> dict:
    res = requests.get(
        f"{_BASE}/{service}/{path}",
        params={
            "serviceKey": unquote(api_key),
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
        raise RuntimeError(f"{service}/{path} 실패: {header}")
    return data["response"]["body"]


def _extract_items(body: dict) -> list[dict]:
    item = body.get("items", {})
    item = item.get("item", []) if isinstance(item, dict) else []
    if isinstance(item, dict):
        item = [item]
    return item


def fetch_all_list(service: str, api_key: str) -> list[dict]:
    """이 목록은 매칭 후보일 뿐이라(실제 반영은 매칭 성공분만) fetch_festivals.py처럼
    totalCount 불일치로 전체를 버리지는 않는다 — 페이지 일부가 비어도 그만큼만 덜
    매칭될 뿐, 데이터 정합성 문제로 이어지지 않는다."""
    params = {"numOfRows": _NUM_OF_ROWS, "pageNo": 1, "arrange": "A", "areaCode": _AREA_CODE_BUSAN}
    first = _request(service, api_key, "areaBasedList2", params)
    total_count = int(first.get("totalCount") or 0)
    items = _extract_items(first)

    total_pages = -(-total_count // _NUM_OF_ROWS)
    for page in range(2, total_pages + 1):
        items.extend(_extract_items(_request(service, api_key, "areaBasedList2", {**params, "pageNo": page})))
    return items


def match_korean_title(title: str) -> str | None:
    """"168 Stairs (168계단)" -> "168계단". 괄호 안에 한글이 없으면(순수 영문 표기 등) None."""
    m = _PAREN_KOREAN_RE.search(title)
    return m.group(1).strip() if m else None


def fetch_detail_common(service: str, api_key: str, contentid: str) -> dict | None:
    body = _request(service, api_key, "detailCommon2", {"contentId": contentid})
    items = _extract_items(body)
    return items[0] if items else None


def sync_language(session, lang: str, kor_title_to_contentid: dict[str, int]) -> int:
    cfg = LANGUAGES[lang]
    api_key = cfg["api_key"]()
    if not api_key:
        print(f"[{lang}] API 키 없음 — 스킵")
        return 0

    items = fetch_all_list(cfg["service"], api_key)
    intro_records = []
    matched = 0

    for item in items:
        kor_title = match_korean_title(item.get("title", ""))
        contentid = kor_title_to_contentid.get(kor_title) if kor_title else None
        if contentid is None:
            continue

        try:
            detail = fetch_detail_common(cfg["service"], api_key, item["contentid"])
        except (requests.RequestException, RuntimeError, ValueError):
            continue
        if detail is None:
            continue

        # tour_spot은 매칭 자체가 기존 title 기준이라 항상 이미 존재하는 행이다 — upsert()를
        # 쓰면 contenttypeid/title/geom 등 NOT NULL 컬럼이 없어 INSERT 단계에서 실패하므로
        # 일반 UPDATE로 그 행의 번역 컬럼 2개만 갱신한다.
        session.query(TourSpot).filter(TourSpot.contentid == contentid).update(
            {
                f"title_{lang}": detail.get("title") or item.get("title"),
                f"addr1_{lang}": detail.get("addr1") or item.get("addr1"),
            }
        )
        matched += 1

        overview = detail.get("overview")
        if overview:
            intro_records.append({"contentid": contentid, f"overview_{lang}": overview})

    # tour_spot_intro는 전 컬럼이 nullable(PK 제외)이라 upsert()가 안전 — 아직 상세가
    # 한 번도 안 채워진 관광지(tour_spot_intro 행 자체가 없는 경우)도 이걸로 새로 생긴다.
    if intro_records:
        upsert(session, TourSpotIntro, intro_records, "contentid")
    return matched


def main() -> None:
    ensure_schema()  # title_en/title_zh 등 신규 컬럼 — 웹서비스보다 이 cron이 먼저 돌 수도 있어서
    session = SessionLocal()
    try:
        kor_title_to_contentid = dict(session.query(TourSpot.title, TourSpot.contentid).all())
        for lang in LANGUAGES:
            matched = sync_language(session, lang, kor_title_to_contentid)
            session.commit()
            print(f"[{lang}] {matched}건 매칭·갱신")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
