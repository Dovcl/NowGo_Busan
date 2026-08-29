"""부산광역시_링크소통정보(LINKTrafficList) 실시간 스냅샷 수집 — sentinel 방식.

harness/DECISIONS.md 2026-08-20 참고. 원본 데이터는 15분이 아니라 **시간 단위
snapshot**으로 갱신됨(93페이지 전체가 항상 동일한 statsDt, 정시 단위로만 바뀌는 것
실측 확인 — 다만 지연 폭은 아직 관찰 중). 그래서 매번 93페이지를 다 긁지 않고:

  1. page 1만 가볍게 확인(sentinel)
  2. statsDt가 이전에 처리한 snapshot과 같으면 그대로 종료(API 호출 1회로 끝)
  3. 새 snapshot이면 그때만 나머지 페이지를 마저 수집

이 스크립트를 10분 주기로 돌리면 하루 호출량이 대략 6*24(sentinel) + 24*92(신규
snapshot마다 전체) ≈ 2,352회 — 매번 93페이지씩 긁는 것과 큰 차이가 없으면서, 반영
지연은 최대 10분으로 줄어든다.

cycle integrity: 새 snapshot을 다 모은 뒤 (1) unique link 수 == totalCount
(2) 모든 페이지의 statsDt가 서로 동일 — 이 둘을 만족할 때만 DB에 쓴다. 수집 도중
원본이 갱신돼서 한 사이클에 두 시간대가 섞이면 그 사이클은 통째로 버리고 다음 주기에
다시 시도한다(부분 반영 금지).

RoadLinkHourlyBuffer는 아직 안 씀 — "같은 statsDt 안에서 spd/vol도 정말 고정인지"가
검증되기 전까지는 시간당 대표값을 그냥 그 snapshot 값 자체로 취급(관측 1회 = baseline
1 sample). 값이 실제로도 매번 같다면 이 buffer 테이블 자체가 불필요해질 수 있음.

실행: backend/ 디렉토리에서 `python -m etl.fetch_road_traffic`
(.env에 TOUR_API_KEY 필요 — 부산광역시 링크소통정보 활용신청 승인된 계정 키)
"""

from datetime import datetime
from urllib.parse import unquote

import requests
from sqlalchemy import func

from core.config import settings
from db.base import Base
from db.models import RoadLinkCache, RoadLinkTrafficCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_URL = "https://apis.data.go.kr/6260000/BusanITSLINKTraffic/LINKTrafficList"
_NUM_OF_ROWS = 100
_MAX_RETRY = 3
_MAX_PLAUSIBLE_SPEED_KMH = 150  # 이보다 크면 센서 오류로 간주


def _fetch_page(page: int) -> dict:
    res = requests.get(
        _URL,
        params={
            "ServiceKey": unquote(settings.TOUR_API_KEY),
            "pageNo": page,
            "numOfRows": _NUM_OF_ROWS,
            "resultType": "json",
        },
        timeout=15,
    )
    res.raise_for_status()
    return res.json()


def _fetch_page_with_retry(page: int) -> list[dict] | None:
    for _ in range(_MAX_RETRY):
        try:
            d = _fetch_page(page)
            if d.get("resultCode") == "00":
                return d["content"]["items"]
        except (requests.RequestException, KeyError, ValueError):
            pass
    return None


def get_last_processed_stats_dt(session) -> datetime | None:
    """별도 상태 테이블 없이 RoadLinkTrafficCache에 이미 반영된 최신 observed_at으로 판단."""
    return session.query(func.max(RoadLinkTrafficCache.observed_at)).scalar()


def fetch_full_snapshot() -> tuple[list[dict], int]:
    """전체 페이지를 동적으로 계산해서 수집(93 하드코딩 없음). 실패 페이지는 재시도."""
    first = _fetch_page(1)
    total_count = first["content"]["totalCount"]
    total_pages = -(-total_count // _NUM_OF_ROWS)  # ceil

    items = list(first["content"]["items"])
    failed_pages = []
    for page in range(2, total_pages + 1):
        page_items = _fetch_page_with_retry(page)
        if page_items is None:
            failed_pages.append(page)
        else:
            items.extend(page_items)

    if failed_pages:
        raise RuntimeError(f"{len(failed_pages)}개 페이지 수집 실패(재시도 {_MAX_RETRY}회 소진): {failed_pages}")

    return items, total_count


def validate_snapshot(items: list[dict], total_count: int) -> datetime:
    """DB에 쓰기 전 원본(9,207개) 기준 무결성 검증. 실패하면 예외를 던져서
    이 사이클을 통째로 버리게 한다. 성공하면 이 snapshot의 공통 statsDt를 반환."""
    unique_ids = {it["lkId"] for it in items}
    if len(unique_ids) != total_count:
        raise RuntimeError(f"unique link_id 수({len(unique_ids)})가 totalCount({total_count})와 불일치")

    stats_dts = set()
    for it in items:
        if not it.get("lkId") or not it.get("statsDt"):
            raise RuntimeError(f"필수 필드 누락: {it}")
        stats_dts.add(it["statsDt"])

    if len(stats_dts) != 1:
        # 수집 도중 원본이 갱신되어 한 사이클에 두 시간대가 섞인 경우 — 통째로 버림
        raise RuntimeError(f"한 사이클 안에 서로 다른 statsDt가 섞임: {stats_dts}")

    return datetime.strptime(stats_dts.pop(), "%Y-%m-%dT%H:%M:%S")


def filter_usable_links(items: list[dict], session) -> tuple[list[dict], list[str]]:
    """RoadLinkCache에 좌표가 있는 링크만 골라낸다(FK 제약 — 좌표 없는 소수는 로그만)."""
    known_ids = {row[0] for row in session.query(RoadLinkCache.link_id).all()}
    usable = [it for it in items if it["lkId"] in known_ids]
    unmatched = [it["lkId"] for it in items if it["lkId"] not in known_ids]
    return usable, unmatched


def build_traffic_records(items: list[dict], stats_dt: datetime, fetched_at: datetime) -> list[dict]:
    """이상치 필터링 후 RoadLinkTrafficCache upsert용 레코드 생성.
    speed와 volume은 독립적으로 검증한다 — volume만 결측이어도 speed는 살린다."""
    records = []
    for it in items:
        speed = it.get("spd")
        if speed is None or speed <= 0 or speed > _MAX_PLAUSIBLE_SPEED_KMH:
            continue  # 속도 자체가 이상치면 이 링크는 이번 사이클 갱신 스킵

        volume = it.get("vol")
        if volume is not None and volume < 0:
            volume = None  # 음수 교통량만 결측 처리, speed는 그대로 씀

        records.append({
            "link_id": it["lkId"],
            "current_speed": speed,
            "current_volume": volume,
            "observed_at": stats_dt,  # API statsDt (Asia/Seoul 기준 naive datetime)
            "fetched_at": fetched_at,
        })
    return records


def main() -> None:
    Base.metadata.create_all(engine)

    session = SessionLocal()
    try:
        last_processed = get_last_processed_stats_dt(session)

        # sentinel: page 1만 먼저 확인해서 새 snapshot인지 본다
        first = _fetch_page(1)
        stats_dt_sample = datetime.strptime(first["content"]["items"][0]["statsDt"], "%Y-%m-%dT%H:%M:%S")
        if last_processed is not None and stats_dt_sample <= last_processed:
            print(f"새 snapshot 없음 (원본 statsDt={stats_dt_sample}, 이미 처리한 최신={last_processed}) — 스킵")
            return

        items, total_count = fetch_full_snapshot()
        stats_dt = validate_snapshot(items, total_count)

        usable, unmatched = filter_usable_links(items, session)
        fetched_at = datetime.now()
        records = build_traffic_records(usable, stats_dt, fetched_at)

        if records:
            upsert(session, RoadLinkTrafficCache, records, "link_id")
            session.commit()

        print(
            f"road_link_traffic_cache: {len(records)}건 갱신 (statsDt={stats_dt}) "
            f"(원본 {total_count} → 좌표매칭 {len(usable)} → 이상치제외 후 {len(records)}, "
            f"좌표없음 {len(unmatched)}건 제외)"
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
