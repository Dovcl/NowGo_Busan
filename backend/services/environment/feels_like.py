"""기상청 공식 체감온도 계산식.

단기예보(getVilageFcst)엔 체감온도 필드가 없고, 전용 오픈API(getSenTaIdxV5 등)는
"폐기됨"으로 응답해 더 이상 못 씀(harness/DECISIONS.md 2026-08-12 확인) — 대신
기상청이 공개한 계산식을 그대로 구현한다. 이미 캐싱된 기온/습도/풍속만으로 계산되므로
API 호출이 추가로 필요 없다.

여름철 공식은 습구온도(Tw, Stull 2011 근사식)를 먼저 구해야 하는데, 이 근사식의
atan 항은 도(degree)가 아니라 라디안 그대로 써야 알려진 기준값(20℃·습도50%->습구 13.7℃)과
맞아떨어진다 — 참고 자료들이 종종 이 부분을 안 밝혀서 실제 계산해서 검증함.
"""

import math
from datetime import datetime


def _wet_bulb_c(temp_c: float, humidity_pct: float) -> float:
    return (
        temp_c * math.atan(0.151977 * (humidity_pct + 8.313659) ** 0.5)
        + math.atan(temp_c + humidity_pct)
        - math.atan(humidity_pct - 1.676331)
        + 0.00391838 * humidity_pct**1.5 * math.atan(0.023101 * humidity_pct)
        - 4.686035
    )


def feels_like_temperature(
    temp_c: float, humidity_pct: float, wind_ms: float, month: int | None = None
) -> float:
    month = month or datetime.now().month

    if 5 <= month <= 9:  # 여름철 체감온도: 기온+습도 기반
        tw = _wet_bulb_c(temp_c, humidity_pct)
        return round(-0.2442 + 0.55399 * tw + 0.45535 * temp_c - 0.0022 * tw**2 + 0.00278 * tw * temp_c + 3.0, 1)

    if temp_c <= 10 and wind_ms >= 1.3:  # 겨울철 체감온도: 이 조건 밖이면 산출 안 함(기온 그대로)
        return round(13.12 + 0.6215 * temp_c - 11.37 * wind_ms**0.16 + 0.3965 * wind_ms**0.16 * temp_c, 1)

    return temp_c
