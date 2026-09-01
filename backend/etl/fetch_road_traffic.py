"""부산광역시_링크소통정보(LINKTrafficList) 1시간 주기 스냅샷 수집.

harness/DECISIONS.md 2026-08-26 확정: 원본 데이터는 정시(00:00) 기준으로 1시간에 1회만
갱신되며, 그 안에서는 93페이지 전체가 완전히 동일한 payload를 반복함(statsDt 고정,
payload_hash 불변). 지연은 약 1시간(정시 후 ~65분 ~ 크롤링 시간차).

**재설계 (1시간 주기로 최종 확정)**:
  1. 매시 :10에 실행(정각 직후 게시 지연 대비)
  2. 93페이지 전체 폴링
  3. 무결성 검증 후 RoadLinkTrafficCache 갱신
  4. 같은 요일·시간대 baseline 업데이트

하루 API 호출량: 93×24 = 2,232회(개발계정 500회/일 불가능)
→ 운영계정 3,000회/일 이상 신청 필요

cycle integrity: 새 snapshot을 다 모은 뒤 (1) unique link 수 == totalCount
(2) 모든 페이지의 statsDt가 서로 동일 — 이 둘을 만족할 때만 DB에 쓴다. 수집 도중
원본이 갱신돼서 한 사이클에 두 시간대가 섞이면 그 사이클은 통째로 버리고 다음 주기에
다시 시도한다(부분 반영 금지).

실행: backend/ 디렉토리에서 `python -m etl.fetch_road_traffic`
(.env에 TOUR_API_KEY 필요 — 부산광역시 링크소통정보 활용신청 승인된 계정 키)
"""

from datetime import datetime, timedelta
from urllib.parse import unquote

import requests
from sqlalchemy import case, func
from sqlalchemy.dialects.postgresql import insert as pg_insert

from core.config import settings
from db.base import Base
from db.models import RoadLinkBaseline, RoadLinkCache, RoadLinkTrafficCache
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert
from services.traffic.calendar import effective_dow

_BASELINE_UPSERT_CHUNK = 2000  # 원격 DB(Render) 왕복을 줄이기 위한 벌크 upsert 배치 크기

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


def update_baseline(session, records: list[dict], observed_date: str) -> int:
    """한 시간치 속도 기록을 요일×시간대 baseline에 적재.

    관측치가 들어오는 시점의 observed_at.hour 기준으로 1시간 전 데이터를 baseline에 반영
    (예: 15:10 폴링 데이터의 observed_at=14:00 → 14:00의 요일·시간 baseline 갱신).

    링크당 조회 1번씩(레코드당 최대 2회 왕복) 하던 방식은 로컬 DB에선 문제없었지만
    원격 DB(Render)에서는 8,900여 건 × 네트워크 왕복이 누적돼 실행 시간이 급격히
    늘어남(harness/DECISIONS.md 참고) — INSERT ... ON CONFLICT DO UPDATE 벌크 upsert로
    교체해 왕복 횟수를 배치 수만큼으로 줄인다. 가중평균 계산식 자체는 그대로 유지.
    """
    if not records:
        return 0

    # 모든 records의 observed_at이 동일해야 함 (validate_snapshot에서 검증함)
    observed_dt = records[0].get("observed_at")
    if not observed_dt:
        return 0

    # observed_dt 기준으로 요일(0=월~6=일, 공휴일은 일요일로 대체)과 시간대 계산
    dow = effective_dow(session, observed_dt.date())
    hour = observed_dt.hour

    rows = [
        {
            "link_id": r["link_id"],
            "dow": dow,
            "hour": hour,
            "avg_speed": r["current_speed"],
            "avg_volume": r["current_volume"],
            "sample_count": 1,
        }
        for r in records
    ]

    for i in range(0, len(rows), _BASELINE_UPSERT_CHUNK):
        chunk = rows[i : i + _BASELINE_UPSERT_CHUNK]
        stmt = pg_insert(RoadLinkBaseline).values(chunk)
        stmt = stmt.on_conflict_do_update(
            index_elements=["link_id", "dow", "hour"],
            set_={
                # 기존 값과 새 값의 가중 평균 (이전 표본 count × 이전 평균 + 새 값) / (count+1)
                "avg_speed": (
                    RoadLinkBaseline.avg_speed * RoadLinkBaseline.sample_count + stmt.excluded.avg_speed
                )
                / (RoadLinkBaseline.sample_count + 1),
                # volume은 결측일 수 있어 speed와 독립적으로 처리 (기존 Python 분기와 동일한 규칙)
                "avg_volume": case(
                    (stmt.excluded.avg_volume.is_(None), None),
                    (
                        RoadLinkBaseline.avg_volume.isnot(None),
                        (RoadLinkBaseline.avg_volume * RoadLinkBaseline.sample_count + stmt.excluded.avg_volume)
                        / (RoadLinkBaseline.sample_count + 1),
                    ),
                    else_=stmt.excluded.avg_volume,
                ),
                "sample_count": RoadLinkBaseline.sample_count + 1,
            },
        )
        session.execute(stmt)

    return len(rows)


def main() -> None:
    Base.metadata.create_all(engine)

    session = SessionLocal()
    try:
        items, total_count = fetch_full_snapshot()
        stats_dt = validate_snapshot(items, total_count)

        usable, unmatched = filter_usable_links(items, session)
        fetched_at = datetime.now()
        records = build_traffic_records(usable, stats_dt, fetched_at)

        if records:
            upsert(session, RoadLinkTrafficCache, records, "link_id")
            baseline_updated = update_baseline(session, records, stats_dt.strftime("%Y-%m-%d"))
            session.commit()
        else:
            baseline_updated = 0

        print(
            f"road_link_traffic_cache: {len(records)}건 갱신 (statsDt={stats_dt}) "
            f"(원본 {total_count} → 좌표매칭 {len(usable)} → 이상치제외 후 {len(records)}, "
            f"좌표없음 {len(unmatched)}건 제외) | baseline: {baseline_updated}건 적재"
        )
    finally:
        session.close()


if __name__ == "__main__":
    main()
