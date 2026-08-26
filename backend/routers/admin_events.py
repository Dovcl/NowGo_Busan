"""축제·행사 dedup 검토 큐 — 관리자 전용.

harness/DECISIONS.md 2026-08-26 참고. AUTO_MERGE(>=0.8)로 안 걸러지는 애매한
후보(0.45~0.79)는 여기서 사람이 SAME/DIFFERENT를 확정한다. `require_admin`이 실제
보안 경계 — 프론트에서 버튼을 숨기는 건 UX일 뿐이고, 이 라우터가 없으면 role만 봐도
막힌다."""

from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from db.models import EventDedupCandidate, EventNormalized, User
from db.session import get_db
from etl.build_events import promote_events
from routers.auth import require_admin
from schemas.admin import DedupCandidateOut, DedupResolveRequest

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dedup-candidates", response_model=list[DedupCandidateOut])
def list_dedup_candidates(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    normalized = {(n.source, n.source_event_id): n for n in db.query(EventNormalized).all()}
    candidates = (
        db.query(EventDedupCandidate)
        .filter(EventDedupCandidate.decision == "PENDING")
        .order_by(EventDedupCandidate.total_score.desc())
        .all()
    )

    result = []
    for c in candidates:
        a = normalized.get((c.a_source, c.a_source_event_id))
        b = normalized.get((c.b_source, c.b_source_event_id))
        if a is None or b is None:
            continue  # FK로 보장되지만 방어적으로만 skip
        result.append(
            {
                "id": c.id,
                "total_score": c.total_score,
                "title_score": c.title_score,
                "date_score": c.date_score,
                "venue_score": c.venue_score,
                "a": a,
                "b": b,
            }
        )
    return result


@router.post("/dedup-candidates/{candidate_id}/resolve")
def resolve_dedup_candidate(
    candidate_id: int,
    body: DedupResolveRequest,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    candidate = db.query(EventDedupCandidate).filter(EventDedupCandidate.id == candidate_id).first()
    if candidate is None:
        raise HTTPException(status_code=404, detail="후보를 찾을 수 없습니다")
    if candidate.decision != "PENDING":
        raise HTTPException(status_code=409, detail="이미 처리된 후보입니다")

    candidate.decision = body.decision
    candidate.reviewed_at = datetime.now()
    db.commit()

    # 이 결정으로 새로 승격 가능해진 이벤트들(SAME이면 병합, DIFFERENT면 각자 독립
    # 승격)을 바로 반영 — build_events.py의 검증된 로직을 그대로 재사용한다.
    promote_events(db)
    db.commit()

    return {"ok": True}
