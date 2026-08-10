from pathlib import Path

from pydantic import computed_field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict

# 절대경로로 고정: uvicorn을 backend/가 아닌 다른 cwd(--app-dir 등)에서
# 띄워도 항상 backend/.env를 찾도록.
_ENV_FILE = Path(__file__).resolve().parent.parent / ".env"


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=_ENV_FILE, env_file_encoding="utf-8")

    APP_NAME: str = "Nowgo Busan"
    APP_VERSION: str = "0.1.0"
    APP_DESCRIPTION: str = "환경 기반 관광 추천 서비스"

    MOCK_MODE: bool = False
    FRONTEND_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

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

    DATABASE_NAME: str
    DATABASE_USER: str
    DATABASE_PASSWORD: str
    DATABASE_HOST: str
    DATABASE_PORT: int
    DATABASE_SCHEMA: str | None = None
    DATABASE_SCHEMA_TEST: str | None = None

    @field_validator("FRONTEND_ORIGINS", mode="before")
    @classmethod
    def split_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v

    @computed_field
    @property
    def DATABASE_URL(self) -> str:
        return (
            f"postgresql://{self.DATABASE_USER}:{self.DATABASE_PASSWORD}"
            f"@{self.DATABASE_HOST}:{self.DATABASE_PORT}/{self.DATABASE_NAME}"
        )


settings = Settings()


