"""대기 점수(s_air 원형) 계산 — Modified IDW + CAI(통합대기환경지수).

원본 알고리즘: 팀 제공 노트북(대기점수_함수.ipynb) 그대로 이식. 최근접 측정소 하나가
아니라 부산 전체 측정소를 거리 역가중(IDW)으로 보간하고, 측정소별 LOOCV 오차로 가중치를
보정(Modified IDW)한 뒤, 오염물질별 CAI를 구해 관광지 위치의 통합 CAI → 0~100점으로
환산한다. 노트북은 매 호출마다 에어코리아 API를 실시간으로 불렀지만, 여기서는 이미
시간당 1회 캐싱되는 air_quality_cache(etl/fetch_air_quality.py)만 읽는다 — 쿼터
관리 원칙은 다른 환경 데이터와 동일(harness/checks/api-quota-check.md).

compose(유형별 가중합·신호등 판정)는 아직 미정이라 이 모듈은 손대지 않는다
(harness/DECISIONS.md 참고).
"""

import math

from sqlalchemy.orm import Session

from db.environment_queries import all_air_quality_stations

# 측정소 데이터 노이즈가 큰 산단/항만 지점 — 노트북과 동일하게 보간 대상에서 제외.
_EXCLUDE_STATIONS = {"부산북항", "부산신항"}

# 오염물질별 최적 IDW p값 + CAI 구간표(BP_LO, BP_HI, I_LO, I_HI). pm10/pm25는 CAI 공식
# 기준이 24시간 이동평균이라 그 필드를 쓰고, 나머지는 1시간 값을 그대로 쓴다.
POLLUTANTS = {
    "pm10_24": {
        "label": "PM10",
        "p": 2.0,
        "hard_limit": 2000,
        "breakpoints": [(0, 30, 0, 50), (30, 80, 50, 100), (80, 150, 100, 250), (150, 600, 250, 500)],
    },
    "pm25_24": {
        "label": "PM2.5",
        "p": 2.4,
        "hard_limit": 2000,
        "breakpoints": [(0, 15, 0, 50), (15, 35, 50, 100), (35, 75, 100, 250), (75, 500, 250, 500)],
    },
    "so2": {
        "label": "SO2",
        "p": 1.3,
        "hard_limit": 5.0,
        "breakpoints": [(0, 0.02, 0, 50), (0.02, 0.05, 50, 100), (0.05, 0.15, 100, 250), (0.15, 1.0, 250, 500)],
    },
    "no2": {
        "label": "NO2",
        "p": 2.4,
        "hard_limit": 5.0,
        "breakpoints": [(0, 0.03, 0, 50), (0.03, 0.06, 50, 100), (0.06, 0.20, 100, 250), (0.20, 2.0, 250, 500)],
    },
    "o3": {
        "label": "O3",
        "p": 1.5,
        "hard_limit": 2.0,
        "breakpoints": [(0, 0.03, 0, 50), (0.03, 0.09, 50, 100), (0.09, 0.15, 100, 250), (0.15, 0.6, 250, 500)],
    },
    "co": {
        "label": "CO",
        "p": 1.7,
        "hard_limit": 100.0,
        "breakpoints": [(0, 2, 0, 50), (2, 9, 50, 100), (9, 15, 100, 250), (15, 50, 250, 500)],
    },
}

# CAI -> 관광 대기점수 기준점 (CAI 0->100점 ... 500->0점, 구간별 선형감점)
_CAI_POINTS = [0, 50, 100, 250, 500]
_SCORE_POINTS = [100, 90, 70, 30, 0]


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """두 위경도 사이 거리(km)."""
    r = 6371.0
    lat1, lon1, lat2, lon2 = map(math.radians, (lat1, lon1, lat2, lon2))
    dlat = lat2 - lat1
    dlon = lon2 - lon1
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon / 2) ** 2
    return r * 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))


def _basic_idw_predict(lat: float, lon: float, stations: list[dict], pollutant: str, p: float) -> float | None:
    """LOOCV용 기본 IDW (보정계수 없음)."""
    valid = [s for s in stations if s.get(pollutant) is not None]
    if len(valid) < 3:
        return None

    distances = [haversine_distance(lat, lon, s["lat"], s["lon"]) for s in valid]

    # 관광지와 측정소가 정확히 같은 위치면 그 값을 그대로 사용
    min_idx = min(range(len(distances)), key=distances.__getitem__)
    if distances[min_idx] < 0.001:
        return valid[min_idx][pollutant]

    weights = [1 / (d**p) for d in distances]
    weighted_sum = sum(w * s[pollutant] for w, s in zip(weights, valid))
    return weighted_sum / sum(weights)


def _calculate_loocv_error(stations: list[dict], pollutant: str, p: float) -> dict[str, float]:
    """station_name -> e_i(|실제 - LOOCV 예측|). 측정소를 하나씩 빼고 나머지로 그 측정소를
    예측해, "이 측정소 주변은 IDW가 얼마나 잘 맞는지"를 추정한다."""
    valid = [s for s in stations if s.get(pollutant) is not None]
    if len(valid) < 4:  # 하나를 빼도 3개는 남아야 IDW가 성립
        return {}

    errors: dict[str, float] = {}
    for i, target in enumerate(valid):
        train = valid[:i] + valid[i + 1 :]
        predicted = _basic_idw_predict(target["lat"], target["lon"], train, pollutant, p)
        if predicted is None:
            continue
        errors[target["station_name"]] = abs(target[pollutant] - predicted)
    return errors


def _modified_idw(tour_lat: float, tour_lon: float, stations: list[dict], pollutant: str, p: float) -> float | None:
    """Wi = (1/di)^p * (1 + ei/e_max) — 거리 역가중에 LOOCV 오차 기반 보정을 곱한 가중치."""
    valid = [s for s in stations if s.get(pollutant) is not None]
    if len(valid) < 4:
        return None

    e_i_by_station = _calculate_loocv_error(valid, pollutant, p)
    if not e_i_by_station:
        return None

    valid = [s for s in valid if s["station_name"] in e_i_by_station]
    e_max = max(e_i_by_station.values())

    raw_weights = []
    for s in valid:
        distance_km = max(haversine_distance(tour_lat, tour_lon, s["lat"], s["lon"]), 0.001)
        correction = 1.0 if e_max == 0 else 1 + e_i_by_station[s["station_name"]] / e_max
        raw_weights.append((1 / distance_km) ** p * correction)

    total_weight = sum(raw_weights)
    return sum(w * s[pollutant] for w, s in zip(raw_weights, valid)) / total_weight


def _concentration_to_cai(concentration: float | None, breakpoints: list[tuple]) -> float | None:
    if concentration is None:
        return None
    concentration = max(0, concentration)
    for bp_lo, bp_hi, i_lo, i_hi in breakpoints:
        if concentration <= bp_hi:
            return (i_hi - i_lo) / (bp_hi - bp_lo) * (concentration - bp_lo) + i_lo
    return 500.0  # 표의 최고 농도 초과


def _calculate_total_cai(pollutant_cai: dict[str, float]) -> float | None:
    """가장 높은 개별 오염물질 지수를 기본으로, 나쁨(CAI>100)이 동시에 여럿이면 가산."""
    valid = {k: v for k, v in pollutant_cai.items() if v is not None}
    if not valid:
        return None

    max_cai = max(valid.values())
    bad_count = sum(1 for v in valid.values() if v > 100)

    if bad_count >= 3:
        final_cai = max_cai + 75
    elif bad_count == 2:
        final_cai = max_cai + 50
    else:
        final_cai = max_cai

    return min(final_cai, 500)


def _interp(x: float, xp: list[float], fp: list[float]) -> float:
    """np.interp와 동일한 구간별 선형보간 (xp는 오름차순)."""
    if x <= xp[0]:
        return fp[0]
    if x >= xp[-1]:
        return fp[-1]
    for i in range(len(xp) - 1):
        if xp[i] <= x <= xp[i + 1]:
            t = (x - xp[i]) / (xp[i + 1] - xp[i])
            return fp[i] + t * (fp[i + 1] - fp[i])
    return fp[-1]


def _cai_to_tour_score(cai: float | None) -> float | None:
    """CAI 0->100점, 50->90점, 100->70점, 250->30점, 500->0점 기준 선형감점."""
    if cai is None:
        return None
    cai = min(max(cai, 0), 500)
    return round(_interp(cai, _CAI_POINTS, _SCORE_POINTS), 2)


def air_score(session: Session, lat: float, lon: float) -> dict:
    """관광지 좌표의 대기 점수. air_quality_cache가 비어 있거나 유효 측정소가 4곳
    미만이면 각 필드가 None으로 채워진 채 반환된다 — 호출부에서 데이터 부족을 구분해서
    처리(다른 환경 데이터의 None 처리 방식과 동일, services/environment/lookup.py 참고)."""
    stations = [s for s in all_air_quality_stations(session) if s["station_name"] not in _EXCLUDE_STATIONS]

    concentrations: dict[str, float | None] = {}
    pollutant_cai: dict[str, float | None] = {}

    for key, meta in POLLUTANTS.items():
        # 하드 리밋 초과(비정상 값)는 이 오염물질만 제외 — 한 측정소의 한 항목 오류가
        # 다른 항목·다른 측정소까지 끌고 내려가지 않도록.
        clean_stations = [
            s for s in stations if s.get(key) is None or 0 <= s[key] <= meta["hard_limit"]
        ]

        concentration = _modified_idw(lat, lon, clean_stations, key, meta["p"])
        concentrations[meta["label"]] = concentration
        pollutant_cai[meta["label"]] = _concentration_to_cai(concentration, meta["breakpoints"])

    cai = _calculate_total_cai(pollutant_cai)
    fetched_ats = [s["fetched_at"] for s in stations if s.get("fetched_at")]

    return {
        "fetched_at": max(fetched_ats) if fetched_ats else None,
        "concentrations": concentrations,
        "pollutant_cai": pollutant_cai,
        "cai": cai,
        "air_score": _cai_to_tour_score(cai),
    }
