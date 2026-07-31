"""부산 관광지 DB(tour_spot) vs 카카오맵 실제 검색 결과 커버리지 비교.

실행: backend/ 디렉토리에서 `python -m etl.verify_kakao_coverage`
(.env에 KAKAO_REST_API_KEY 필요 — 프론트가 쓰는 JS 키와는 다른, REST API 키)
"""

import csv
import time
from difflib import SequenceMatcher

import requests
from sqlalchemy import func

from core.config import settings
from db.models import ContentType, TourSpot
from db.session import SessionLocal

KAKAO_KEY = settings.KAKAO_REST_API_KEY
# 코스(25)·축제(15)는 좌표 하나짜리 "장소"가 아니라 이벤트/코스 개념이라 카카오 POI와 비교 대상이 아님
EXCLUDED_TYPES = (15, 25)
MATCH_RADIUS_M = 300  # 이 안이면 이름 안 봐도 매칭
NAME_MATCH_RADIUS_M = 800  # 이 안이면 이름 유사도로 추가 판정
NAME_MATCH_RATIO = 0.6
REQUEST_INTERVAL_S = 0.1
OUT_CSV = "etl/kakao_coverage_report.csv"


def name_similarity(a, b):
    norm = lambda s: s.replace(" ", "").lower()
    return SequenceMatcher(None, norm(a), norm(b)).ratio()


def search_kakao(title, lat, lng):
    res = requests.get(
        "https://dapi.kakao.com/v2/local/search/keyword.json",
        headers={"Authorization": f"KakaoAK {KAKAO_KEY}"},
        params={"query": title, "x": lng, "y": lat, "radius": 1000, "sort": "distance", "size": 5},
        timeout=5,
    )
    res.raise_for_status()
    return res.json()["documents"]


def best_match(title, candidates):
    """거리로 먼저 걸러내고, 애매한 범위(800m 이내)는 이름 유사도로 후보 중 최적을 고른다."""
    best = None
    for doc in candidates:
        dist = int(doc["distance"])
        ratio = name_similarity(title, doc["place_name"])
        if dist <= MATCH_RADIUS_M or (dist <= NAME_MATCH_RADIUS_M and ratio >= NAME_MATCH_RATIO):
            if best is None or ratio > best[1]:
                best = (doc, ratio, dist)
    return best


def main():
    if not KAKAO_KEY:
        raise SystemExit("backend/.env에 KAKAO_REST_API_KEY를 설정하세요")

    session = SessionLocal()
    rows = (
        session.query(TourSpot.contentid, TourSpot.title, func.ST_Y(TourSpot.geom), func.ST_X(TourSpot.geom))
        .join(ContentType, ContentType.contenttypeid == TourSpot.contenttypeid)
        .filter(ContentType.is_env_target.is_(True))
        .filter(TourSpot.contenttypeid.notin_(EXCLUDED_TYPES))
        .all()
    )
    session.close()

    with open(OUT_CSV, "w", newline="", encoding="utf-8-sig") as f:
        writer = csv.writer(f)
        writer.writerow(["contentid", "title", "kakao_name", "kakao_distance_m", "name_ratio", "matched"])
        for contentid, title, lat, lng in rows:
            try:
                candidates = search_kakao(title, lat, lng)
            except requests.RequestException as e:
                print(f"[스킵] {title}: {e}")
                continue

            match = best_match(title, candidates)
            if match is None:
                writer.writerow([contentid, title, "", "", "", False])
            else:
                doc, ratio, dist = match
                writer.writerow([contentid, title, doc["place_name"], dist, f"{ratio:.2f}", True])
            time.sleep(REQUEST_INTERVAL_S)

    print(f"완료: {OUT_CSV}")


if __name__ == "__main__":
    main()
