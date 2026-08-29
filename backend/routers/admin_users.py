"""회원 관리 — 관리자 전용. require_admin이 실제 보안 경계(프론트 role 체크는 UX일 뿐).

일반 유저(tourist)는 원래 카카오/구글 전용이라 이메일/비번 계정이 없는데, 카카오/구글
로그인이 안 되는 예외 상황에 대비해 관리자가 여기서 NowGo ID(이메일/비번) 계정을
대신 만들어줄 수 있다 — /auth/admin/login(NowGo ID 로그인)이 role 상관없이
이메일/비번만 맞으면 로그인시켜주도록 이미 바뀌어 있어서(routers/auth.py 참고)
tourist 계정도 그 경로로 로그인 가능하다.
"""

from datetime import date, datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from core.security import hash_password
from core.timezone import KST, now_kst
from db.models import User
from db.session import get_db
from routers.auth import require_admin
from schemas.admin import (
    AdminUserCreateRequest,
    AdminUserIdsRequest,
    AdminUserListOut,
    AdminUserOut,
    AdminUserRoleUpdateRequest,
    AdminUserStatsOut,
)

router = APIRouter(prefix="/admin/users", tags=["Admin"])


def _kst_midnight_to_utc_naive(d: date) -> datetime:
    """KST 기준 그 날짜 00:00을 created_at(Postgres UTC, tz-naive 컬럼) 비교용으로 변환.

    created_at은 DB 서버(UTC)의 func.now()로 채워지는데, 이 코드가 도는 머신의
    로컬 시간대(맥=KST, Render=UTC)로 그냥 datetime.now()를 쓰면 자정 근처 가입자가
    하루 밀려 잘못 집계된다 — 반드시 KST로 명시 변환 후 비교해야 함."""
    return datetime(d.year, d.month, d.day, tzinfo=KST).astimezone(timezone.utc).replace(tzinfo=None)


def _base_query(db: Session):
    # social_accounts는 가입경로 표시에 필요 — 유저마다 따로 쿼리하면 N+1이라 미리 조인
    return db.query(User).options(joinedload(User.social_accounts))


def _signup_source(user: User) -> str:
    if user.password_hash is not None:
        return "email"
    if user.social_accounts:
        return user.social_accounts[0].provider
    return "email"  # 방어적 기본값 — 데이터상 이 분기는 안 나옴


def _to_out(user: User) -> dict:
    return {
        "id": user.id,
        "nickname": user.nickname,
        "email": user.email,
        "role": user.role,
        "signup_source": _signup_source(user),
        "created_at": user.created_at,
        "is_withdrawn": user.deleted_at is not None,
    }


@router.get("", response_model=AdminUserListOut)
def list_users(
    search: str | None = None,
    status: str | None = Query(None, pattern="^(active|withdrawn)$"),
    date_from: date | None = None,
    date_to: date | None = None,
    page: int = Query(1, ge=1),
    page_size: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    query = _base_query(db)
    if search:
        like = f"%{search}%"
        query = query.filter(or_(User.nickname.ilike(like), User.email.ilike(like)))
    if status == "active":
        query = query.filter(User.deleted_at.is_(None))
    elif status == "withdrawn":
        query = query.filter(User.deleted_at.isnot(None))
    if date_from:
        query = query.filter(User.created_at >= _kst_midnight_to_utc_naive(date_from))
    if date_to:
        # date_to는 "그 날짜까지 포함"이라 다음날 00시(KST) 미만으로 비교
        query = query.filter(User.created_at < _kst_midnight_to_utc_naive(date_to + timedelta(days=1)))

    total = query.count()
    users = query.order_by(User.created_at.desc()).offset((page - 1) * page_size).limit(page_size).all()
    return {"items": [_to_out(u) for u in users], "total": total}


@router.get("/stats", response_model=AdminUserStatsOut)
def user_stats(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    today_start = _kst_midnight_to_utc_naive(now_kst().date())
    total = db.query(func.count(User.id)).filter(User.deleted_at.is_(None)).scalar()
    new_today = db.query(func.count(User.id)).filter(User.created_at >= today_start).scalar()
    return {"total_users": total, "new_today": new_today}


@router.get("/export")
def export_users_csv(db: Session = Depends(get_db), _: User = Depends(require_admin)):
    import csv
    import io

    users = _base_query(db).order_by(User.created_at.desc()).all()
    buf = io.StringIO()
    writer = csv.writer(buf)
    writer.writerow(["id", "nickname", "email", "role", "signup_source", "created_at", "is_withdrawn"])
    for u in users:
        row = _to_out(u)
        writer.writerow(
            [row["id"], row["nickname"], row["email"] or "", row["role"], row["signup_source"], row["created_at"], row["is_withdrawn"]]
        )
    return Response(
        content=buf.getvalue(),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=nowgo_users.csv"},
    )


@router.post("", response_model=AdminUserOut, status_code=201)
def create_user(body: AdminUserCreateRequest, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    """카카오/구글이 안 되는 예외 상황 대비용 NowGo ID 계정 생성. role로 관리자/일반을 구분."""
    if db.query(User).filter(User.email == body.email).first() is not None:
        raise HTTPException(status_code=409, detail="이미 존재하는 이메일입니다")

    user = User(
        nickname=body.nickname,
        email=body.email,
        password_hash=hash_password(body.password),
        role=body.role,
        terms_agreed_at=datetime.now(),
        privacy_agreed_at=datetime.now(),
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    return _to_out(user)


@router.patch("/role")
def update_role(body: AdminUserRoleUpdateRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if admin.id in body.ids and body.role != "admin":
        raise HTTPException(status_code=400, detail="본인 권한은 여기서 낮출 수 없습니다")
    updated = db.query(User).filter(User.id.in_(body.ids)).update({"role": body.role}, synchronize_session=False)
    db.commit()
    return {"updated": updated}


@router.post("/withdraw")
def withdraw_users(body: AdminUserIdsRequest, db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    if admin.id in body.ids:
        raise HTTPException(status_code=400, detail="본인 계정은 여기서 탈퇴 처리할 수 없습니다")
    db.query(User).filter(User.id.in_(body.ids)).update({"deleted_at": datetime.now()}, synchronize_session=False)
    db.commit()
    return {"ok": True}


@router.post("/restore")
def restore_users(body: AdminUserIdsRequest, db: Session = Depends(get_db), _: User = Depends(require_admin)):
    db.query(User).filter(User.id.in_(body.ids)).update({"deleted_at": None}, synchronize_session=False)
    db.commit()
    return {"ok": True}
