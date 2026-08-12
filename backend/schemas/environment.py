from datetime import datetime

from pydantic import BaseModel


class WeatherOut(BaseModel):
    temperature: float | None
    feels_like: float | None  # 기상청 공식 계산식으로 백엔드에서 산출 (API 미제공)
    humidity: float | None
    wind_speed: float | None
    precipitation_prob: float | None
    sky: int | None  # 1=맑음 3=구름많음 4=흐림 (프론트에서 아이콘으로 매핑)
    precipitation_type: int | None  # 0=없음 1=비 2=비/눈 3=눈 4=소나기


class AirQualityOut(BaseModel):
    station_name: str
    pm10: float | None
    pm25: float | None
    o3: float | None
    pm10_grade: int | None  # 환경부 공식 4단계(1=좋음~4=매우나쁨), 프론트에서 색상으로 매핑
    pm25_grade: int | None


class EnvironmentOut(BaseModel):
    weather: WeatherOut | None
    air_quality: AirQualityOut | None
    uv_index: int | None
    updated_at: datetime | None  # 캐시 3개 중 가장 오래된 fetched_at
