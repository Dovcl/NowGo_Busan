"""기온/강수 점수(s_weather 원형) 계산 — 팀 제공 노트북(Data_Preprocess.ipynb,
WeatherScoreCalculator) 그대로 이식. 노트북은 관측 API를 직접 부르고 pandas
DataFrame 전체를 순회하는 클래스였지만, 여기서는 이미 배치로 캐싱된
weather_obs_cache(etl/fetch_weather_observation.py) 한 셀만 읽는 무상태 함수로 바꿨다
— 다른 환경 데이터와 동일한 캐시 우선 원칙(harness/checks/api-quota-check.md).

기존 feels_like.py의 "체감온도"(실제 섭씨 온도, 표시용)와 이름이 겹치지만 다른
개념이다 — 여기서 계산하는 temp_score/rain_score는 0~100 점수(관광 적합도)이지
온도값이 아니다.

compose(유형별 가중합·신호등 판정)는 아직 미정이라 이 모듈은 손대지 않는다
(harness/DECISIONS.md 참고).
"""

from sqlalchemy.orm import Session

from db.environment_queries import nearest_weather_obs_grid_cell
from db.models import WeatherObsCache

# 기온 점수 기준점(℃ -> 0~100). 최종 기준표가 바뀌면 이 두 배열만 수정.
_TEMP_POINTS = [-15, -6, 0, 7, 11, 15, 16, 25, 26, 28, 30, 32, 34, 36, 38, 39]
_TEMP_SCORES = [0, 10, 30, 55, 75, 92, 100, 100, 92, 88, 75, 65, 50, 30, 10, 0]

# 강수량 기본점수 기준(mm/h -> 0~100).
_RAIN_POINTS = [0, 3, 15, 30]
_RAIN_SCORES = [100, 85, 70, 40]
# 30mm/h 이상은 위 표를 계속 연장하지 않고 이 값으로 뚝 떨어뜨린다(원본 노트북의
# 의도된 "extreme cliff" — 40점에서 선형 이어지는 게 아니라 폭우는 별도 취급).
_RAIN_EXTREME_SCORE = 10.0
# 강수-바람 상호작용 페널티 계수: 비바람이 같이 있으면 기본점수에서 최대 이만큼 더 뺀다.
_RAIN_WIND_LAMBDA = 20.0


def _interp(x: float, xp: list[float], fp: list[float]) -> float:
    """np.interp와 동일한 구간별 선형보간 (xp는 오름차순). 범위 밖은 끝점 값."""
    if x <= xp[0]:
        return fp[0]
    if x >= xp[-1]:
        return fp[-1]
    for i in range(len(xp) - 1):
        if xp[i] <= x <= xp[i + 1]:
            t = (x - xp[i]) / (xp[i + 1] - xp[i])
            return fp[i] + t * (fp[i + 1] - fp[i])
    return fp[-1]


def temperature_score(temp_c: float) -> float:
    """기온 -> 0~100 관광 적합도 점수. 구간 밖(-15℃ 미만, 39℃ 초과)은 끝점 점수(0)."""
    return round(float(_interp(temp_c, _TEMP_POINTS, _TEMP_SCORES)), 2)


def rainfall_score(rainfall_mm: float, wind_ms: float) -> float:
    """1시간 강수량+10분 풍속 -> 0~100 점수. 강수량만으로 기본점수를 정한 뒤,
    바람이 같이 강할수록(비바람) 추가 감점 — 둘 다 있어야 페널티가 커진다."""
    rainfall_mm = max(rainfall_mm, 0.0)

    if rainfall_mm >= _RAIN_POINTS[-1]:
        base_score = _RAIN_EXTREME_SCORE
    else:
        base_score = float(_interp(rainfall_mm, _RAIN_POINTS, _RAIN_SCORES))

    rain_ratio = min(max(rainfall_mm / 30.0, 0.0), 1.0)
    wind_ratio = min(max((wind_ms - 4.0) / 5.0, 0.0), 1.0)  # 4m/s 이하 0, 9m/s 이상 1

    score = base_score - _RAIN_WIND_LAMBDA * rain_ratio * wind_ratio
    return round(min(max(score, 0.0), 100.0), 2)


def weather_score(session: Session, lat: float, lon: float) -> dict:
    """관광지 좌표의 기온/강수 점수. weather_obs_cache가 비어 있거나 해당 셀이 아직
    수집 안 됐으면 각 필드가 None으로 채워진 채 반환된다 — 호출부에서 데이터 부족을
    구분해서 처리(다른 환경 데이터의 None 처리 방식과 동일, services/environment/lookup.py 참고)."""
    cell = nearest_weather_obs_grid_cell(session, lat, lon)
    obs = session.get(WeatherObsCache, (cell.grid_x, cell.grid_y)) if cell else None

    temp_score = temperature_score(obs.temperature) if obs and obs.temperature is not None else None
    rain_score = (
        rainfall_score(obs.rainfall_60m, obs.wind_speed)
        if obs and obs.rainfall_60m is not None and obs.wind_speed is not None
        else None
    )

    return {
        "fetched_at": obs.fetched_at if obs else None,
        "temperature": obs.temperature if obs else None,
        "rainfall_60m": obs.rainfall_60m if obs else None,
        "wind_speed": obs.wind_speed if obs else None,
        "temp_score": temp_score,
        "rain_score": rain_score,
    }
