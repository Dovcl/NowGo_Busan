"""TourAPI KorService2 저수준 호출 헬퍼.

`fetch_tour_spots.py`(목록 갱신)와 `fetch_missing_landmarks.py`(화이트리스트
상세 조회)가 같은 detailCommon2/detailIntro2 호출 로직을 공유하기 위해
분리했다(둘이 서로를 import하면 순환참조가 생김)."""

from urllib.parse import unquote

import requests

from core.config import settings

BASE = "https://apis.data.go.kr/B551011/KorService2"


def request(path: str, params: dict) -> dict:
    res = requests.get(
        f"{BASE}/{path}",
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


def extract_items(body: dict) -> list[dict]:
    item = body.get("items", {})
    item = item.get("item", []) if isinstance(item, dict) else []
    if isinstance(item, dict):
        item = [item]
    return item


def fetch_detail_common(contentid: str) -> dict | None:
    body = request("detailCommon2", {"contentId": contentid})
    items = extract_items(body)
    return items[0] if items else None


def fetch_detail_intro(contentid: str, contenttypeid: str) -> dict | None:
    body = request("detailIntro2", {"contentId": contentid, "contentTypeId": contenttypeid})
    items = extract_items(body)
    return items[0] if items else None
