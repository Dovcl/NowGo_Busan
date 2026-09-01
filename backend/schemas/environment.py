from datetime import datetime

from pydantic import BaseModel


class WeatherForecastSlotOut(BaseModel):
    fcst_date: str  # YYYYMMDD
    fcst_time: str  # HHMM
    temperature: float
    sky: int
    precipitation_type: int
    precipitation_prob: float | None


class WeatherOut(BaseModel):
    temperature: float | None
    feels_like: float | None  # 기상청 공식 계산식으로 백엔드에서 산출 (API 미제공)
    humidity: float | None
    wind_speed: float | None
    precipitation_prob: float | None
    sky: int | None  # 1=맑음 3=구름많음 4=흐림 (프론트에서 아이콘으로 매핑)
    precipitation_type: int | None  # 0=없음 1=비 2=비/눈 3=눈 4=소나기
    forecast: list[WeatherForecastSlotOut]  # 다음 24시간, 3시간 간격


class AirQualityOut(BaseModel):
    station_name: str
    pm10: float | None
    pm25: float | None
    o3: float | None
    pm10_grade: int | None  # 환경부 공식 4단계(1=좋음~4=매우나쁨), 프론트에서 색상으로 매핑
    pm25_grade: int | None


class RipCurrentOut(BaseModel):
    station_name: str
    index_value: float | None
    risk_level: str | None  # 관심/주의/경계/위험 4단계 (원본 그대로)
    wave_height: float | None
    water_temp: float | None


class TrafficCongestionOut(BaseModel):
    s_traffic: float | None  # 0~1, 높을수록 원활. None이면 데이터 부족(1주 미만 또는 링크 없음)
    status: str  # 'district_fallback'(구·군 대체), 'data_collecting'(1주 미만), 'provisional'(1~3주), 'normal'(3주+)
    nearby_event: str | None  # 오늘 반경 1.5km 내 진행 중인 축제·행사명 (혼잡 원인 설명용, 없으면 null)
    current_speed: float | None  # 반경 내 링크 평균 현재 속도(km/h). district_fallback이면 null
    baseline_speed: float | None  # 같은 요일·시간대 평균 속도(km/h). district_fallback이면 null
    congested_road_name: str | None  # 집계에 쓰인 링크 중 현재 속도가 가장 낮은 도로명("정체 구간" 표시용)


class EnvironmentOut(BaseModel):
    weather: WeatherOut | None
    air_quality: AirQualityOut | None
    uv_index: int | None
    rip_current: RipCurrentOut | None  # 반경 5km 밖이거나 비시즌(10~5월)이면 null
    traffic_congestion: TrafficCongestionOut | None  # 도로 교통 혼잡도
    updated_at: datetime | None  # 캐시 5개 중 가장 오래된 fetched_at
