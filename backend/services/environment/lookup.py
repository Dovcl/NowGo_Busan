"""좌표(lat, lon) 하나로 날씨·대기질·자외선을 한 번에 조회.

관광지 상세페이지든 GPS 기반 "내 주변" 기능이든 입력이 좌표라는 점은 같아서 함수 하나를
그대로 재사용한다(harness/DECISIONS.md 2026-08-12 참고). 전부 배치 ETL로 미리 캐싱된
값만 읽어 조합하므로 요청마다 외부 API를 호출하지 않는다 — 에어코리아 500회/일 제한
(harness/checks/api-quota-check.md) 등 quota를 건드리지 않기 위함.
"""

from datetime import datetime

from sqlalchemy.orm import Session

from db.environment_queries import nearest_air_quality_station, nearest_rip_current_station, nearby_active_event
from db.models import AirQualityCache, RipCurrentCache, UvIndexCache, WeatherCache, RoadLinkBaseline
from services.environment.feels_like import feels_like_temperature
from services.environment.grid import latlon_to_grid
from services.traffic.calculate import calculate_traffic_congestion
from services.traffic.calendar import effective_dow

_BUSAN_AREA_NO = "2600000000"  # 생활기상지수 MVP는 부산 전체 1개 값만 사용


def get_environment(session: Session, lat: float, lon: float) -> dict:
    nx, ny = latlon_to_grid(lat, lon)
    weather = _nearest_weather(session, nx, ny)
    uv = session.get(UvIndexCache, _BUSAN_AREA_NO)
    air = nearest_air_quality_station(session, lat, lon)
    rip_current = nearest_rip_current_station(session, lat, lon)
    traffic, traffic_source, current_speed, baseline_speed, congested_road_name = calculate_traffic_congestion(
        session, lat, lon
    )

    # 5개 캐시 중 가장 오래된 fetched_at을 "기준 시각"으로
    fetched_ats = [row.fetched_at for row in (weather, uv, air, rip_current) if row is not None]

    # traffic은 fetched_at이 아니라 baseline 생성 여부로 상태 판정
    traffic_congestion = (
        _traffic_congestion_out(
            session, lat, lon, traffic, traffic_source, current_speed, baseline_speed, congested_road_name
        )
        if traffic is not None
        else None
    )

    return {
        "weather": _weather_out(weather),
        "air_quality": _air_out(air),
        "uv_index": uv.uv_index if uv else None,
        "rip_current": _rip_current_out(rip_current),
        "traffic_congestion": traffic_congestion,
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
        "forecast": w.forecast or [],
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


def _traffic_congestion_out(
    session: Session,
    lat: float,
    lon: float,
    s_traffic: float | None,
    source: str | None,
    current_speed: float | None,
    baseline_speed: float | None,
    congested_road_name: str | None,
) -> dict | None:
    """traffic congestion 상태를 판정. s_traffic 값 없으면 데이터 부족.

    status:
      - 'district_fallback': 도로 baseline 없이 구·군 방문객수로 대체(cold-start)
      - 'data_collecting': 1주 미만 (sample_count < 7일 보수적 기준 미달)
      - 'provisional': 1~3주 (데이터 있지만 신뢰도 제한)
      - 'normal': 3주 이상 (정식 표시)
    """
    if s_traffic is None:
        return None

    # "왜 평소보다 혼잡한지" 설명용 — 오늘 이 근처에서 열리는 축제·행사가 있으면 같이 노출
    event = nearby_active_event(session, lat, lon, datetime.now().date())
    nearby_event = event.title if event else None

    if source == "district_fallback":
        return {
            "s_traffic": s_traffic,
            "status": "district_fallback",
            "nearby_event": nearby_event,
            "current_speed": None,
            "baseline_speed": None,
            "congested_road_name": None,
        }

    # 가장 최신 baseline의 sample_count로 수집 기간 판정 (공휴일이면 일요일 패턴으로 대체)
    now = datetime.now()
    current_dow = effective_dow(session, now.date())
    current_hour = now.hour

    # 반경 내 링크 중 baseline이 있는 것들의 sample_count 확인
    from db.environment_queries import nearest_road_links

    nearby_links = nearest_road_links(session, lat, lon, limit=10, radius_m=500)
    baseline_samples = []

    for link in nearby_links:
        baseline = (
            session.query(RoadLinkBaseline)
            .filter_by(link_id=link.link_id, dow=current_dow, hour=current_hour)
            .first()
        )
        if baseline and baseline.sample_count:
            baseline_samples.append(baseline.sample_count)

    if not baseline_samples:
        status = "data_collecting"  # baseline 데이터 없음
    else:
        avg_sample_count = sum(baseline_samples) / len(baseline_samples)
        if avg_sample_count < 7:
            status = "data_collecting"  # 1주 미만
        elif avg_sample_count < 21:
            status = "provisional"  # 1~3주
        else:
            status = "normal"  # 3주 이상

    return {
        "s_traffic": s_traffic,
        "status": status,
        "nearby_event": nearby_event,
        "current_speed": current_speed,
        "baseline_speed": baseline_speed,
        "congested_road_name": congested_road_name,
    }
