from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8")

    APP_NAME: str = "Nowgo Busan"
    APP_VERSION: str = "0.1.0"
    APP_DESCRIPTION: str = "환경 기반 관광 추천 서비스"

    MOCK_MODE: bool = False
    FRONTEND_ORIGINS: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    TOUR_API_KEY: str | None = None
    TOUR_API_KEY_BEACH: str | None = None
    TOUR_API_KEY_IAN: str | None = None

    # DB 세팅 전까지는 Optional. PostGIS 붙일 때 required로 전환
    DATABASE_URL: str | None = None
    DATABASE_NAME: str | None = None
    DATABASE_USER: str | None = None
    DATABASE_PASSWORD: str | None = None
    DATABASE_HOST: str | None = None
    DATABASE_PORT: int | None = None
    DATABASE_SCHEMA: str | None = None
    DATABASE_SCHEMA_TEST: str | None = None

    @field_validator("FRONTEND_ORIGINS", mode="before")
    @classmethod
    def split_origins(cls, v):
        if isinstance(v, str):
            return [origin.strip() for origin in v.split(",") if origin.strip()]
        return v


settings = Settings()


