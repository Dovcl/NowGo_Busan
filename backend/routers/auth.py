import secrets
from datetime import datetime, timedelta
from urllib.parse import urlencode

import requests
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import RedirectResponse
from sqlalchemy.orm import Session

from core.config import settings
from db.models import User, UserSession, UserSocialAccount
from db.session import get_db
from schemas.auth import UserOut

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


def _issue_session(db: Session, user: User) -> RedirectResponse:
    """세션 발급 + 쿠키 설정 + 프론트로 리다이렉트."""
    session_id = secrets.token_urlsafe(32)
    db.add(UserSession(id=session_id, user_id=user.id, expires_at=datetime.utcnow() + SESSION_TTL))
    db.commit()

    response = RedirectResponse(settings.FRONTEND_ORIGINS[0])
    response.set_cookie(
        SESSION_COOKIE,
        session_id,
        httponly=True,
        secure=False,  # 로컬 http 환경. 배포(https) 시 True로 변경
        samesite="lax",
        max_age=int(SESSION_TTL.total_seconds()),
    )
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
