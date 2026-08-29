import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from core.config import settings
from core.security import verify_password
from db.models import User, UserSession, UserSocialAccount
from db.session import get_db
from schemas.auth import AdminLoginRequest, UserOut

router = APIRouter(prefix="/auth", tags=["Auth"])

SESSION_COOKIE = "session_id"
SESSION_TTL = timedelta(days=30)


@router.get("/kakao/login")
def kakao_login():
    """카카오 로그인 동의 화면으로 리다이렉트."""
    params = {
        "client_id": settings.KAKAO_REST_API_KEY,
        "redirect_uri": settings.KAKAO_REDIRECT_URI,
        "response_type": "code",
    }
    return RedirectResponse(f"https://kauth.kakao.com/oauth/authorize?{urlencode(params)}")


@router.get("/kakao/callback")
def kakao_callback(code: str, db: Session = Depends(get_db)):
    """카카오가 넘겨준 code -> 토큰 교환 -> 프로필 조회 -> 유저 조회/생성 -> 세션 발급."""
    token_res = requests.post(
        "https://kauth.kakao.com/oauth/token",
        data={
            "grant_type": "authorization_code",
            "client_id": settings.KAKAO_REST_API_KEY,
            "client_secret": settings.KAKAO_CLIENT_SECRET,
            "redirect_uri": settings.KAKAO_REDIRECT_URI,
            "code": code,
        },
    )
    token_res.raise_for_status()
    access_token = token_res.json()["access_token"]

    profile_res = requests.get(
        "https://kapi.kakao.com/v2/user/me",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    profile_res.raise_for_status()
    profile = profile_res.json()
    provider_user_id = str(profile["id"])
    nickname = profile.get("kakao_account", {}).get("profile", {}).get("nickname", "부산여행자")

    user = _find_or_create_user(db, "kakao", provider_user_id, nickname)
    return _issue_session(db, user)


@router.get("/google/login")
def google_login():
    """구글 로그인 동의 화면으로 리다이렉트."""
    params = {
        "client_id": settings.GOOGLE_CLIENT_ID,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "response_type": "code",
        "scope": "openid email profile",
    }
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}")


@router.get("/google/callback")
def google_callback(code: str, db: Session = Depends(get_db)):
    """구글이 넘겨준 code -> 토큰 교환 -> 프로필 조회 -> 유저 조회/생성 -> 세션 발급."""
    token_res = requests.post(
        "https://oauth2.googleapis.com/token",
        data={
            "grant_type": "authorization_code",
            "client_id": settings.GOOGLE_CLIENT_ID,
            "client_secret": settings.GOOGLE_CLIENT_SECRET,
            "redirect_uri": settings.GOOGLE_REDIRECT_URI,
            "code": code,
        },
    )
    token_res.raise_for_status()
    access_token = token_res.json()["access_token"]

    profile_res = requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {access_token}"},
    )
    profile_res.raise_for_status()
    profile = profile_res.json()
    provider_user_id = profile["sub"]  # 구글의 회원 고유번호 필드명은 sub
    nickname = profile.get("name", "부산여행자")

    user = _find_or_create_user(db, "google", provider_user_id, nickname)
    return _issue_session(db, user)


@router.post("/admin/login", response_model=UserOut)
def admin_login(body: AdminLoginRequest, response: Response, db: Session = Depends(get_db)):
    """NowGo ID(이메일/비밀번호) 로그인. 공개 가입 경로는 없고 계정은 관리자가 수동
    생성한다(scripts/create_admin.py 또는 회원관리 화면) — admin뿐 아니라 카카오/구글이
    안 되는 예외 상황 대비용 일반(tourist) 계정도 이 경로로 로그인한다."""
    user = db.query(User).filter(User.email == body.email).first()
    # 이메일이 없는 경우와 비밀번호가 틀린 경우를 구분해서 알려주지 않는다 (계정 존재 여부 노출 방지)
    if user is None or user.password_hash is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status_code=401, detail="이메일 또는 비밀번호가 올바르지 않습니다")
    if user.deleted_at is not None:
        raise HTTPException(status_code=401, detail="탈퇴한 계정입니다")

    _set_session_cookie(response, _create_session(db, user.id))
    return user


def _find_or_create_user(db: Session, provider: str, provider_user_id: str, nickname: str) -> User:
    """provider(kakao/google) + provider_user_id로 기존 유저를 찾고, 없으면 새로 만든다."""
    social_account = db.query(UserSocialAccount).filter(
        UserSocialAccount.provider == provider,
        UserSocialAccount.provider_user_id == provider_user_id,
    ).first()

    if social_account is not None:
        return social_account.user

    # TODO: 지금은 소셜 로그인 동의 화면 통과 = 우리 서비스 약관 동의로 간주하고 있음.
    # 실서비스 전엔 최초 로그인 시 별도 약관 동의 화면을 거치도록 바꿔야 함.
    user = User(
        nickname=nickname,
        role="tourist",
        terms_agreed_at=datetime.utcnow(),
        privacy_agreed_at=datetime.utcnow(),
    )
    db.add(user)
    db.flush()  # user.id 확보
    db.add(UserSocialAccount(user_id=user.id, provider=provider, provider_user_id=provider_user_id))
    db.commit()
    return user


def _create_session(db: Session, user_id: int) -> str:
    """sessions 테이블에 세션 행을 만들고 토큰(=행의 id)을 반환."""
    session_id = secrets.token_urlsafe(32)
    db.add(UserSession(id=session_id, user_id=user_id, expires_at=datetime.utcnow() + SESSION_TTL))
    db.commit()
    return session_id


def _set_session_cookie(response: Response, session_id: str) -> None:
    # 배포 환경은 프론트/백엔드가 서로 다른 서브도메인이라 cross-site 쿠키 취급됨 ->
    # SameSite=None + Secure 필수. 로컬은 둘 다 localhost(same-site)라 Lax로 충분.
    is_prod = settings.ENV == "production"
    response.set_cookie(
        SESSION_COOKIE,
        session_id,
        httponly=True,
        secure=is_prod,
        samesite="none" if is_prod else "lax",
        max_age=int(SESSION_TTL.total_seconds()),
    )


def _issue_session(db: Session, user: User) -> RedirectResponse:
    """소셜 로그인 콜백 전용: 세션 발급 + 쿠키 설정 + 프론트로 리다이렉트."""
    response = RedirectResponse(settings.FRONTEND_ORIGINS_LIST[0])
    _set_session_cookie(response, _create_session(db, user.id))
    return response


def get_current_user(request: Request, db: Session = Depends(get_db)) -> User:
    session_id = request.cookies.get(SESSION_COOKIE)
    session = (
        db.query(UserSession).filter(UserSession.id == session_id).first()
        if session_id else None
    )
    if session is None or session.expires_at < datetime.utcnow():
        raise HTTPException(status_code=401, detail="로그인이 필요합니다")
    return session.user


def require_admin(user: User = Depends(get_current_user)) -> User:
    """관리자 전용 라우트용 의존성. 프론트에서 버튼을 숨기는 것과 별개로, 이게 실제
    보안 경계다 — 프론트를 안 거치고 API를 직접 호출해도 여기서 막힌다."""
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="관리자만 접근할 수 있습니다")
    return user


@router.get("/me", response_model=UserOut)
def get_me(user: User = Depends(get_current_user)):
    return user


@router.post("/logout")
def logout(request: Request, response: Response, db: Session = Depends(get_db)):
    session_id = request.cookies.get(SESSION_COOKIE)
    if session_id:
        db.query(UserSession).filter(UserSession.id == session_id).delete()
        db.commit()
    response.delete_cookie(SESSION_COOKIE)
    return {"ok": True}
