"""관리자 계정 생성 스크립트. 공개 가입 경로가 없어 admin 계정은 이 스크립트로만 만든다.
실행: backend/ 디렉토리에서 `python -m scripts.create_admin`
"""

from datetime import datetime
from getpass import getpass

from core.security import hash_password
from db.models import User
from db.session import SessionLocal


def main() -> None:
    email = input("이메일: ").strip()
    nickname = input("닉네임: ").strip()
    password = getpass("비밀번호: ")  # 터미널에 입력값이 그대로 안 보이게 처리
    password_confirm = getpass("비밀번호 확인: ")

    if password != password_confirm:
        print("비밀번호가 일치하지 않습니다.")
        return

    session = SessionLocal()
    try:
        if session.query(User).filter(User.email == email).first() is not None:
            print(f"이미 존재하는 이메일입니다: {email}")
            return

        user = User(
            email=email,
            nickname=nickname,
            password_hash=hash_password(password),
            role="admin",
            terms_agreed_at=datetime.utcnow(),
            privacy_agreed_at=datetime.utcnow(),
        )
        session.add(user)
        session.commit()
        print(f"관리자 계정 생성 완료: {email} (id={user.id})")
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()


if __name__ == "__main__":
    main()
