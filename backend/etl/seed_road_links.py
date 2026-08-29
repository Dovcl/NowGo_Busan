"""RoadLinkCache 좌표 마스터 시드 — 국토교통부 표준노드링크에서 LINESTRING 추출.

원본 파일(NODELINKDATA.zip, 전국 단위 약 257MB)은 크기 때문에 repo에 안 넣고
its.go.kr/nodelink/nodelinkRef 에서 수동 다운로드해서 SOURCE_DIR에 압축 해제해
둬야 한다. LINKTrafficList가 준 lkId 그대로 exact match — 부산 prefix(130~145)로
먼저 필터링하지 않는다(그러면 유효한 링크를 놓침, harness/DECISIONS.md 참고).

이 스크립트는 정적 데이터라 최초 1회 + 월 1회 정도만 재실행하면 된다(표준노드링크
자체가 월 단위로만 갱신됨).

실행: backend/ 디렉토리에서 `python -m etl.seed_road_links`
"""

import sys
from pathlib import Path
from urllib.parse import unquote

import requests
import shapefile
from geoalchemy2 import WKTElement
from pyproj import Transformer

from core.config import settings
from db.base import Base
from db.models import RoadLinkCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

SOURCE_DIR = Path(
    "/private/tmp/claude-501/-Users-gimdohyeon-Projects-NowGo-Busan/407f3f57-0ee7-40bc-b38e-18c06b332585"
    "/scratchpad/nodelink_extracted"
)
_TRAFFIC_URL = "https://apis.data.go.kr/6260000/BusanITSLINKTraffic/LINKTrafficList"
_TRANSFORMER = Transformer.from_crs("EPSG:5186", "EPSG:4326", always_xy=True)


def _fetch_all_traffic_link_ids() -> set[str]:
    """LINKTrafficList 전체를 훑어서 지금 실시간으로 제공되는 lkId 집합을 구한다
    (좌표 마스터는 이 집합 기준으로만 채우면 됨 — 안 쓰이는 링크까지 42,873개 다 넣을 필요 없음)."""
    key = unquote(settings.TOUR_API_KEY)
    first = requests.get(
        _TRAFFIC_URL,
        params={"ServiceKey": key, "pageNo": 1, "numOfRows": 100, "resultType": "json"},
        timeout=15,
    ).json()
    total_count = first["content"]["totalCount"]
    total_pages = -(-total_count // 100)

    ids = {it["lkId"] for it in first["content"]["items"]}
    for page in range(2, total_pages + 1):
        d = requests.get(
            _TRAFFIC_URL,
            params={"ServiceKey": key, "pageNo": page, "numOfRows": 100, "resultType": "json"},
            timeout=15,
        ).json()
        ids.update(it["lkId"] for it in d["content"]["items"])
    return ids


def build_linestring_wkt(points: list[tuple[float, float]]) -> str:
    """EPSG:5186 좌표열을 WGS84 LINESTRING WKT로 변환."""
    coords = [_TRANSFORMER.transform(x, y) for x, y in points]
    coord_str = ", ".join(f"{lon} {lat}" for lon, lat in coords)
    return f"LINESTRING({coord_str})"


def extract_matched_links(wanted_ids: set[str]) -> list[dict]:
    """전국 표준노드링크(MOCT_LINK)에서 wanted_ids와 exact match되는 것만 추출."""
    r = shapefile.Reader(str(SOURCE_DIR / "MOCT_LINK"), encoding="cp949")
    records = []
    for sr in r.iterShapeRecords():
        link_id = str(sr.record["LINK_ID"])
        if link_id not in wanted_ids:
            continue
        records.append({
            "link_id": link_id,
            "road_name": sr.record["ROAD_NAME"],
            "geom": WKTElement(build_linestring_wkt(sr.shape.points), srid=4326),
            "length_m": sr.record["LENGTH"],
        })
    return records


def main() -> None:
    if not (SOURCE_DIR / "MOCT_LINK.shp").exists():
        print(f"원본 shapefile이 없습니다: {SOURCE_DIR}")
        print("its.go.kr/nodelink/nodelinkRef 에서 NODELINKDATA.zip을 받아 위 경로에 압축 해제하세요.")
        sys.exit(1)

    Base.metadata.create_all(engine)

    wanted_ids = _fetch_all_traffic_link_ids()
    print(f"실시간 제공 link_id: {len(wanted_ids)}건")

    records = extract_matched_links(wanted_ids)
    print(f"좌표 exact match: {len(records)}건 (미매칭 {len(wanted_ids) - len(records)}건, 원인 미확정 — DECISIONS.md 참고)")

    session = SessionLocal()
    try:
        upsert(session, RoadLinkCache, records, "link_id")
        session.commit()
        print(f"road_link_cache: {len(records)}건 시드 완료")
    finally:
        session.close()


if __name__ == "__main__":
    main()
