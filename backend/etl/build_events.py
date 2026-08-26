"""정규화 + dedup 후보 탐지 — event_raw -> event_normalized -> event_dedup_candidates.

harness/DECISIONS.md Phase 2 참고. canonical `events` 테이블을 실제로 채우는 것(중복
확정된 걸 하나로 합치는 것)은 여기서 안 한다 — 그건 Phase 3. 지금은 "정규화하고,
겹칠 만한 후보를 찾아서 점수 매겨 큐에 쌓아두는 것"까지만 한다.

AUTO_MERGE 도입(2026-08-26, 다봄 연동 후): 다봄+KOPIS를 합쳤더니 후보 1,329건 중
1,117건이 명백한 노이즈(0.2~0.4점, 그냥 날짜만 우연히 겹친 무관한 것들)였고, 184건은
title/date/venue가 전부 1.0인 완벽 일치(실측으로 10건 직접 대조 확인 — 전부 진짜
같은 행사)였음. 이 정도로 점수대가 뚜렷하게 갈리면("0.5~0.7 애매한 28건" 정도만 진짜
애매함) 검토 없는 자동 확정이 안전하다고 판단 — 처음에 "실제 데이터 없이 임계값 추측
안 함" 원칙을 세웠던 게 바로 이 순간을 위해서였음. `_AUTO_MERGE_SCORE` 이상은
decision=SAME으로 바로 확정, 그 아래(`_MIN_QUEUE_SCORE` 이상)는 여전히 PENDING으로
사람 검토 대기(다만 검토용 관리자 화면은 아직 없음 — DB 직접 확인만 가능).
이미 검토된(SAME/DIFFERENT로 바뀐) 쌍은 재실행해도 절대 덮어쓰지 않는다(ON CONFLICT DO NOTHING).

실행: backend/ 디렉토리에서 `python -m etl.build_events`
(event_raw가 먼저 채워져 있어야 함 — fetch_festivals.py / fetch_kopis.py 실행 후)
"""

import re
from datetime import date, datetime, timedelta

from geoalchemy2 import WKTElement
from rapidfuzz import fuzz
from sqlalchemy.dialects.postgresql import insert as pg_insert

from db.base import Base
from db.models import Event, EventDedupCandidate, EventNormalized, EventRaw, EventSourceMap
from db.session import SessionLocal, engine
from etl.seed_tour_spots import upsert

_CANDIDATE_WINDOW_DAYS = 3  # 이 안에서 날짜가 겹치는 것만 후보로 좁힌다(전수비교 방지)
# 오픈런 공연(예: KOPIS "택시안에서" 2019~2026)은 날짜 범위가 몇 년씩 걸쳐 있어서
# 날짜 블로킹이 사실상 무력화됨 — 실제로 첫 실행에서 이 공연 하나가 TourAPI 축제
# 22건 전부와 "후보"로 잡혔는데, 점수는 전부 0.09 이하였음(실측 확인). 날짜 신호가
# 무의미해진 케이스라 title/venue조차 안 맞으면 사람이 볼 필요가 없다고 판단 —
# 이 점수 미만은 애초에 큐에 안 넣는다(자동판정이 아니라 "명백히 무관"만 거름).
# 2026-08-26 다봄 연동 후 실측 재조정: 0.2는 TourAPI+KOPIS 2개 소스일 때 기준이었는데,
# 다봄까지 3개가 되니 노이즈 덩어리가 0.2~0.4 전체를 차지하는 게 확인돼(1,117건) 0.45로 올림.
_MIN_QUEUE_SCORE = 0.45
# 실측(다봄+KOPIS 184건)으로 확인된 "완벽 일치" 구간 — title/date/venue가 전부 1.0이면
# total=0.85가 나옴. 이 이상은 사람 검토 없이 바로 SAME 확정(AUTO_MERGE).
_AUTO_MERGE_SCORE = 0.8
_TITLE_WEIGHT = 0.45
_DATE_WEIGHT = 0.25
_VENUE_WEIGHT = 0.15
# location_weight(좌표 기반, 0.10)와 organizer_weight(0.05)는 지금 자리만 남겨둔다 —
# KOPIS가 좌표를 안 줘서(실측 확인) 대부분의 쌍에서 못 쓰고, organizer는 두 소스 다
# 구조화된 필드가 없다. 나중에 다봄처럼 좌표·주최기관을 주는 소스가 들어오면 채운다.


# ---------- 제목 정규화 ----------
# "제18회", "[부산]"(KOPIS가 붙이는 지역 접미사), 연도, 공백/특수문자를 지운 뒤 비교해야
# "2026 부산락페스티벌" vs "제18회 부산락페스티벌"가 실제보다 낮게 나오는 걸 막는다.
_BRACKET_RE = re.compile(r"[\[(].*?[\])]")
_ROUND_RE = re.compile(r"제\s*\d+\s*회")
_YEAR_RE = re.compile(r"(19|20)\d{2}")
_NON_WORD_RE = re.compile(r"[^\w가-힣]")


def normalize_title(title: str) -> str:
    t = _BRACKET_RE.sub("", title)
    t = _ROUND_RE.sub("", t)
    t = _YEAR_RE.sub("", t)
    t = _NON_WORD_RE.sub("", t)
    return t.strip().lower()


def _parse_tourapi_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y%m%d").date()
    except ValueError:
        return None


def _parse_kopis_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y.%m.%d").date()
    except ValueError:
        return None


def _parse_dabom_date(raw: str | None) -> date | None:
    if not raw:
        return None
    try:
        return datetime.strptime(raw, "%Y-%m-%d").date()
    except ValueError:
        return None  # "0000-00-00" 같은 결측 더미값


def normalize_tourapi(raw: dict) -> dict | None:
    title = raw.get("title")
    if not title:
        return None
    lat, lng = raw.get("mapy"), raw.get("mapx")
    return {
        "title": title,
        "start_date": _parse_tourapi_date(raw.get("eventstartdate")),
        "end_date": _parse_tourapi_date(raw.get("eventenddate")),
        "venue": raw.get("addr2") or raw.get("addr1"),
        "address": raw.get("addr1"),
        "lat": float(lat) if lat else None,
        "lng": float(lng) if lng else None,
        "category": "festival",
        "image_url": raw.get("firstimage") or raw.get("firstimage2"),
    }


def normalize_kopis(raw: dict) -> dict | None:
    title = raw.get("prfnm")
    if not title:
        return None
    return {
        "title": title,
        "start_date": _parse_kopis_date(raw.get("prfpdfrom")),
        "end_date": _parse_kopis_date(raw.get("prfpdto")),
        "venue": raw.get("fcltynm"),
        "address": None,
        "lat": None,  # KOPIS는 공연장 좌표를 안 줌(실측 확인) — venue는 텍스트로만 비교
        "lng": None,
        "category": "festival" if raw.get("festival") == "Y" else "performance",
        "image_url": raw.get("poster"),
    }


def normalize_dabom(raw: dict) -> dict | None:
    title = raw.get("title")
    if not title:
        return None
    return {
        "title": title,
        "start_date": _parse_dabom_date(raw.get("op_st_dt")),
        "end_date": _parse_dabom_date(raw.get("op_ed_dt")),
        "venue": raw.get("place_nm"),
        "address": None,
        "lat": None,  # 다봄도 좌표를 안 줌(실측 확인) — venue는 텍스트로만 비교
        "lng": None,
        # prg_nm이 "전시"면 그대로 전시로 — 5개 카테고리 중 실데이터가 없던 exhibition을
        # 처음으로 채워줌. 그 외(클래식/연극/뮤지컬/무용/전통예술/대중음악 등)는 performance.
        "category": "exhibition" if raw.get("prg_nm") == "전시" else "performance",
        "image_url": None,  # 다봄 응답엔 이미지 필드 자체가 없음(실측 확인) — 정상
    }


_NORMALIZERS = {"tourapi": normalize_tourapi, "kopis": normalize_kopis, "dabom": normalize_dabom}


def build_normalized(session) -> list[dict]:
    raw_rows = session.query(EventRaw).order_by(EventRaw.source, EventRaw.source_event_id).all()

    records = []
    for row in raw_rows:
        normalizer = _NORMALIZERS.get(row.source)
        if normalizer is None:
            continue  # 아직 정규화 함수가 없는 소스(다봄 등) — 나중에 여기 추가
        n = normalizer(row.raw_payload)
        if n is None:
            continue

        geom = WKTElement(f"POINT({n['lng']} {n['lat']})", srid=4326) if n["lat"] and n["lng"] else None
        records.append(
            {
                "source": row.source,
                "source_event_id": row.source_event_id,
                "title": n["title"],
                "normalized_title": normalize_title(n["title"]),
                "start_date": n["start_date"],
                "end_date": n["end_date"],
                "venue": n["venue"],
                "address": n["address"],
                "geom": geom,
                "category": n["category"],
                "image_url": n["image_url"],
            }
        )

    upsert(session, EventNormalized, records, ["source", "source_event_id"])
    return records


# ---------- candidate blocking + scoring ----------


def _date_overlap_score(a_start, a_end, b_start, b_end) -> float:
    """IoU(교집합/합집합) 방식 — 다일 축제(3일~열흘)에서 "시작일이 같은지"보다 안정적."""
    if not a_start or not a_end or not b_start or not b_end:
        return 0.0
    overlap = (min(a_end, b_end) - max(a_start, b_start)).days + 1
    if overlap <= 0:
        return 0.0
    union = (max(a_end, b_end) - min(a_start, b_start)).days + 1
    return overlap / union


def _venue_score(a_venue, b_venue) -> float:
    if not a_venue or not b_venue:
        return 0.0
    return fuzz.token_sort_ratio(a_venue, b_venue) / 100


def _within_window(a_start, a_end, b_start, b_end, window_days: int) -> bool:
    if not a_start or not b_start:
        return True  # 날짜가 없으면 걸러내지 말고 후보로 남겨 사람이 보게 함(놓치는 것보다 나음)
    lo = a_start - timedelta(days=window_days)
    hi = (a_end or a_start) + timedelta(days=window_days)
    return lo <= b_start <= hi or lo <= (b_end or b_start) <= hi


def find_candidates(records: list[dict]) -> list[dict]:
    """서로 다른 소스 쌍만 본다(같은 소스 안은 이미 고유 id라 dedup 불필요) + 날짜가
    근접한 것만 후보로 좁힌다. 쌍 순서는 (source, source_event_id) 사전순으로 고정해서
    재실행해도 같은 쌍이 항상 같은 a/b로 들어가게 한다(안 그러면 유니크 제약이 A-B/B-A를
    다른 쌍으로 착각해 중복 행이 생김)."""
    candidates = []
    for i, x in enumerate(records):
        for y in records[i + 1 :]:
            if x["source"] == y["source"]:
                continue
            if not _within_window(x["start_date"], x["end_date"], y["start_date"], y["end_date"], _CANDIDATE_WINDOW_DAYS):
                continue

            a, b = sorted([x, y], key=lambda r: (r["source"], r["source_event_id"]))

            title_score = fuzz.token_sort_ratio(normalize_title(a["title"]), normalize_title(b["title"])) / 100
            date_score = _date_overlap_score(a["start_date"], a["end_date"], b["start_date"], b["end_date"])
            venue_score = _venue_score(a["venue"], b["venue"])
            total = title_score * _TITLE_WEIGHT + date_score * _DATE_WEIGHT + venue_score * _VENUE_WEIGHT
            if total < _MIN_QUEUE_SCORE:
                continue

            candidates.append(
                {
                    "a_source": a["source"],
                    "a_source_event_id": a["source_event_id"],
                    "b_source": b["source"],
                    "b_source_event_id": b["source_event_id"],
                    "title_score": round(title_score, 4),
                    "date_score": round(date_score, 4),
                    "venue_score": round(venue_score, 4),
                    "total_score": round(total, 4),
                    "decision": "SAME" if total >= _AUTO_MERGE_SCORE else "PENDING",
                }
            )
    return candidates


def save_candidates(session, candidates: list[dict]) -> int:
    """이미 있는 쌍은 절대 안 건드린다 — 사람이 이미 SAME/DIFFERENT로 검토했거나
    이전 실행에서 AUTO_MERGE로 이미 SAME 확정됐을 수 있어서 ON CONFLICT DO NOTHING으로
    새 쌍만 추가한다(기존 쌍의 decision은 절대 재계산·덮어쓰기 안 함)."""
    if not candidates:
        return 0
    stmt = pg_insert(EventDedupCandidate).values(candidates)
    stmt = stmt.on_conflict_do_nothing(
        index_elements=["a_source", "a_source_event_id", "b_source", "b_source_event_id"]
    )
    return session.execute(stmt).rowcount


def promote_events(session) -> int:
    """후보가 없거나(DIFFERENT로 이미 확정됐거나) PENDING 검토 중이 아닌 event_normalized
    행을 canonical events로 승격한다. SAME으로 확정된 쌍은 union-find로 그룹핑해서
    하나의 event로 합친다(다자간 병합, 즉 A-B가 SAME이고 B-C도 SAME이면 A/B/C가 전부
    한 이벤트로 묶이는 경우까지 대비 — 지금 당장은 안 쓰이지만 다봄이 들어오면
    3-way 겹침이 생길 수 있음). 이미 승격된 그룹은 새 이벤트를 또 안 만들고 기존
    event_id에 이어붙인다."""
    normalized = {(r.source, r.source_event_id): r for r in session.query(EventNormalized).all()}
    mapped = {(m.source, m.source_event_id): m.event_id for m in session.query(EventSourceMap).all()}

    parent = {key: key for key in normalized}

    def find(k):
        while parent[k] != k:
            parent[k] = parent[parent[k]]
            k = parent[k]
        return k

    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[rb] = ra

    for c in session.query(EventDedupCandidate).filter(EventDedupCandidate.decision == "SAME").all():
        a_key, b_key = (c.a_source, c.a_source_event_id), (c.b_source, c.b_source_event_id)
        if a_key in normalized and b_key in normalized:
            union(a_key, b_key)

    pending_keys = set()
    for c in session.query(EventDedupCandidate).filter(EventDedupCandidate.decision == "PENDING").all():
        pending_keys.add((c.a_source, c.a_source_event_id))
        pending_keys.add((c.b_source, c.b_source_event_id))

    existing_event_for_root = {find(key): event_id for key, event_id in mapped.items()}

    groups: dict = {}
    for key in normalized:
        if key in mapped or key in pending_keys:
            continue
        groups.setdefault(find(key), []).append(key)

    promoted = 0
    for root, members in groups.items():
        event_id = existing_event_for_root.get(root)
        if event_id is None:
            # 그룹 안에서 정보(장소·주소·좌표·이미지)가 가장 풍부한 항목을 대표값으로 쓴다.
            # image_url을 빼먹으면 다봄(이미지 없음)이 KOPIS(포스터 있음)를 대표값으로
            # 이겨버려서 멀쩡한 이미지가 있는데도 카드가 빈 이미지로 뜨는 문제가 있었음
            # (실측 확인 — "살로메" 병합 후 image_url이 null로 나옴).
            rep_key = max(
                members,
                key=lambda k: sum(
                    v is not None for v in (normalized[k].venue, normalized[k].address, normalized[k].geom, normalized[k].image_url)
                ),
            )
            n = normalized[rep_key]
            event = Event(
                title=n.title,
                start_date=n.start_date,
                end_date=n.end_date,
                venue=n.venue,
                address=n.address,
                geom=n.geom,
                category=n.category,
                image_url=n.image_url,
            )
            session.add(event)
            session.flush()  # event.id 채번
            event_id = event.id

        for key in members:
            session.add(EventSourceMap(event_id=event_id, source=key[0], source_event_id=key[1]))
        promoted += len(members)

    return promoted


def main() -> None:
    Base.metadata.create_all(engine)  # event_normalized/events/event_source_map/event_dedup_candidates 신규 생성

    session = SessionLocal()
    try:
        records = build_normalized(session)
        session.commit()
        print(f"event_normalized: {len(records)}건")

        candidates = find_candidates(records)
        inserted = save_candidates(session, candidates)
        session.commit()
        auto_merged = sum(1 for c in candidates if c["decision"] == "SAME")
        print(
            f"event_dedup_candidates: 후보 {len(candidates)}건 중 신규 {inserted}건 추가 "
            f"(자동 병합 {auto_merged}건, 검토 대기 {len(candidates) - auto_merged}건)"
        )

        promoted = promote_events(session)
        session.commit()
        print(f"events: {promoted}건 승격(신규 생성 또는 기존 이벤트에 연결)")
    finally:
        session.close()


if __name__ == "__main__":
    main()
