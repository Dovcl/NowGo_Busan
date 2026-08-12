"""좌표(lat, lon) 하나로 날씨·대기질·자외선을 한 번에 조회.

관광지 상세페이지든 GPS 기반 "내 주변" 기능이든 입력이 좌표라는 점은 같아서 함수 하나를
그대로 재사용한다(harness/DECISIONS.md 2026-08-12 참고). 전부 배치 ETL로 미리 캐싱된
값만 읽어 조합하므로 요청마다 외부 API를 호출하지 않는다 — 에어코리아 500회/일 제한
(harness/checks/api-quota-check.md) 등 quota를 건드리지 않기 위함.
"""

from sqlalchemy.orm import Session

from db.environment_queries import nearest_air_quality_station, nearest_rip_current_station
from db.models import AirQualityCache, RipCurrentCache, UvIndexCache, WeatherCache
from services.environment.feels_like import feels_like_temperature
from services.environment.grid import latlon_to_grid

_BUSAN_AREA_NO = "2600000000"  # 생활기상지수 MVP는 부산 전체 1개 값만 사용


def get_environment(session: Session, lat: float, lon: float) -> dict:
    nx, ny = latlon_to_grid(lat, lon)
    weather = _nearest_weather(session, nx, ny)
    uv = session.get(UvIndexCache, _BUSAN_AREA_NO)
    air = nearest_air_quality_station(session, lat, lon)
    rip_current = nearest_rip_current_station(session, lat, lon)

    # 넷 다 배치 주기가 달라 fetched_at이 서로 다를 수 있음 — 실제보다 신선해 보이지
    # 않도록 그중 가장 오래된 시각을 "기준 시각"으로 보여준다.
    fetched_ats = [row.fetched_at for row in (weather, uv, air, rip_current) if row is not None]

    return {
        "weather": _weather_out(weather),
        "air_quality": _air_out(air),
        "uv_index": uv.uv_index if uv else None,
        "rip_current": _rip_current_out(rip_current),
        "updated_at": min(fetched_ats) if fetched_ats else None,
    }


def _nearest_weather(session: Session, nx: int, ny: int) -> WeatherCache | None:
    """격자 셀은 tour_spot 분포만큼만 캐싱돼 있어서, 정확히 일치하는 셀이 없으면
    격자 인덱스 기준 가장 가까운 셀을 쓴다(개수가 적어 파이썬에서 바로 비교해도 충분)."""
    cells = session.query(WeatherCache).all()
    if not cells:
        return None
    return min(cells, key=lambda c: (c.nx - nx) ** 2 + (c.ny - ny) ** 2)


def _weather_out(w: WeatherCache | None) -> dict | None:
    if w is None:
        return None
    return {
        "temperature": w.temperature,
        "feels_like": feels_like_temperature(w.temperature, w.humidity, w.wind_speed),
        "humidity": w.humidity,
        "wind_speed": w.wind_speed,
        "precipitation_prob": w.precipitation_prob,
        "sky": w.sky,
        "precipitation_type": w.precipitation_type,
    }


def _air_out(a: AirQualityCache | None) -> dict | None:
    if a is None:
        return None
    return {
        "station_name": a.station_name,
        "pm10": a.pm10,
        "pm25": a.pm25,
        "o3": a.o3,
        "pm10_grade": a.pm10_grade,
        "pm25_grade": a.pm25_grade,
    }


def _rip_current_out(r: RipCurrentCache | None) -> dict | None:
    if r is None:
        return None
    return {
        "station_name": r.station_name,
        "index_value": r.index_value,
        "risk_level": r.risk_level,
        "wave_height": r.wave_height,
        "water_temp": r.water_temp,
    }
