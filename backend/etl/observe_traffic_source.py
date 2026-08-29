"""[임시 관찰용, 프로덕션 아님] LINKTrafficList 원본이 정말 "시간 단위 immutable
snapshot"인지 검증하기 위한 스크립트. harness/DECISIONS.md 2026-08-20 참고.

fetch_road_traffic.py(프로덕션 sentinel ETL)와 완전히 분리 — 이 스크립트는 DB에
아무것도 쓰지 않고, page 1/47/93 세 페이지만 읽어서 CSV에 로그만 남긴다.

관찰이 끝나면(2~4시간, launchd 등록 해제 후) traffic_source_observation.csv를 보고
- 같은 statsDt 안에서 payload_hash가 안 바뀌는지 (진짜 immutable snapshot인지)
- statsDt가 언제/몇 분 간격으로 넘어가는지
- lag_minutes(fetched_at - statsDt)가 몇 분대인지
를 확인해서 RoadLinkHourlyBuffer 제거 여부와 운영계정 신청량을 최종 확정한다.

실행: backend/ 디렉토리에서 `python -m etl.observe_traffic_source`
"""

import csv
import hashlib
from datetime import datetime
from pathlib import Path
from urllib.parse import unquote

import requests

from core.config import settings

_URL = "https://apis.data.go.kr/6260000/BusanITSLINKTraffic/LINKTrafficList"
_PAGES = [1, 47, 93]
_OUT_PATH = Path(__file__).parent / "traffic_source_observation.csv"
_FIELDS = ["fetched_at", "page_no", "statsDt", "lag_minutes", "payload_hash", "item_count"]


def _fetch_page(page: int) -> dict:
    res = requests.get(
        _URL,
        params={
            "ServiceKey": unquote(settings.TOUR_API_KEY),
            "pageNo": page,
            "numOfRows": 100,
            "resultType": "json",
        },
        timeout=15,
    )
    res.raise_for_status()
    return res.json()


def _payload_hash(items: list[dict]) -> str:
    # link_id 순서가 안 바뀐다는 보장이 없으니 정렬 후 해시 (spd/vol/link_id만 반영)
    parts = sorted(f"{it['lkId']}:{it.get('spd')}:{it.get('vol')}" for it in items)
    return hashlib.sha256("|".join(parts).encode()).hexdigest()[:12]


def observe_once() -> list[dict]:
    fetched_at = datetime.now()
    rows = []
    for page in _PAGES:
        d = _fetch_page(page)
        items = d["content"]["items"]
        stats_dt_raw = items[0]["statsDt"]
        stats_dt = datetime.strptime(stats_dt_raw, "%Y-%m-%dT%H:%M:%S")
        rows.append({
            "fetched_at": fetched_at.isoformat(timespec="seconds"),
            "page_no": page,
            "statsDt": stats_dt_raw,
            "lag_minutes": round((fetched_at - stats_dt).total_seconds() / 60, 1),
            "payload_hash": _payload_hash(items),
            "item_count": len(items),
        })
    return rows


def main() -> None:
    is_new = not _OUT_PATH.exists()
    rows = observe_once()
    with open(_OUT_PATH, "a", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=_FIELDS)
        if is_new:
            w.writeheader()
        w.writerows(rows)
    for r in rows:
        print(f"{r['fetched_at']} page={r['page_no']} statsDt={r['statsDt']} lag={r['lag_minutes']}m hash={r['payload_hash']}")


if __name__ == "__main__":
    main()
