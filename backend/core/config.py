from pathlib import Path

from pydantic import computed_field
from pydantic_settings import BaseSettings, SettingsConfigDict

# 절대경로로 고정: uvicorn을 backend/가 아닌 다른 cwd(--app-dir 등)에서
# 띄워도 항상 backend/.env를 찾도록.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, env_file_encoding="utf-8")

    APP_NAME: str = "Nowgo Busan"
    APP_VERSION: str = "0.1.0"
    APP_DESCRIPTION: str = "환경 기반 관광 추천 서비스"

    # "production"으로 배포 시 세션 쿠키를 SameSite=None; Secure로 내림(프론트/백엔드가
    # 다른 서브도메인이라 cross-site 쿠키 취급됨). 로컬은 기본값(development) 그대로 Lax.
    ENV: str = "development"

    MOCK_MODE: bool = False
    # Render 같은 배포 환경에서는 환경변수를 보통 콤마 구분 문자열로 넣는다.
    # list[str]로 직접 받으면 pydantic-settings가 JSON 배열로 먼저 해석해 배포가 실패할 수
    # 있어서 문자열로 받은 뒤 FRONTEND_ORIGINS_LIST에서 앱이 쓸 리스트로 변환한다.
    FRONTEND_ORIGINS: str = "http://localhost:5173,http://127.0.0.1:5173"

    TOUR_API_KEY: str | None = None
    TOUR_API_KEY_BEACH: str | None = None
    TOUR_API_KEY_IAN: str | None = None
    KAKAO_REST_API_KEY: str | None = None
    KAKAO_CLIENT_SECRET: str | None = None
    KAKAO_REDIRECT_URI: str = "http://localhost:8080/auth/kakao/callback"
    GOOGLE_CLIENT_ID: str | None = None
    GOOGLE_CLIENT_SECRET: str | None = None
    GOOGLE_REDIRECT_URI: str = "http://localhost:8080/auth/google/callback"
    WEATHER_API_KEY: str | None = None
    KMA_API_KEY: str | None = None
    AIR_KOREA_API_KEY: str | None = None
    KOPIS_API_KEY: str | None = None

    DATABASE_NAME: str
    DATABASE_USER: str
    DATABASE_PASSWORD: str
    DATABASE_HOST: str
    DATABASE_PORT: int
    DATABASE_SCHEMA: str | None = None
    DATABASE_SCHEMA_TEST: str | None = None

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        url = (
            f"postgresql://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}"
            f"@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
        )
        # Render 외부 접속은 SSL 필수. 로컬 docker PostGIS는 SSL이 없어서 제외.
        if self.DATABASE_HOST not in ("localhost", "127.0.0.1"):
            url += "?sslmode=require"
        return url

    @property
    def FRONTEND_ORIGINS_LIST(self) -> list[str]:
        value = self.FRONTEND_ORIGINS.strip()
        if value.startswith("["):
            import json

            parsed = json.loads(value)
            return [origin.strip() for origin in parsed if origin.strip()]
        return [origin.strip() for origin in value.split(",") if origin.strip()]


settings = Settings()
