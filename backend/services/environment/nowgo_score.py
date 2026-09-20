"""NowGo Score 최종 합성 — 팀 제공 노트북(점수 전처리 (2).ipynb 2026-09-20 보강본,
`make_nowscore_dataframe`) 그대로 이식.

원본은 `tour_final` 전체를 pandas로 한 번에 처리하는 배치 함수였다. 여기서는 이미
좌표 하나짜리 조회 함수로 통일된 나머지 environment 모듈들(air_score/weather_score/
uv_score/marine_score)에 맞춰, 관광지 하나의 부분 점수를 받아 계산하는 함수로 옮겼다
— 배치로 전체를 돌리고 싶으면 이 함수를 관광지 수만큼 반복 호출하면 원본과 같은
결과가 나온다.

핵심 로직(원본 그대로):
- 지원되는 해양활동(swim/surf/marine_trip)이 하나라도 있으면 "해안"(coastal), 없으면
  "도심"(urban) — 지원 여부는 점수가 아니라 대상인지(marine_scores의 키 존재)로 판정하므로
  현재 점수가 None이어도 그 활동 행은 유지된다
- 도심: 대기·기온·강수·자외선 동일 가중치(각 0.25) — 항목별 중요도 근거가 없어 균등
- 해안: 위 4개(각 0.20) + 지원되는 해양활동 "각각"을 0.20으로 따로 가중합 —
  해수욕·서핑을 모두 제공하는 해변이면 활동별로 서로 다른 nowscore가 여러 개 나온다
  (원본의 wide->long melt와 동일한 개념 — activities 리스트로 표현)
- 위험 상한(2026-09-20 노트북 D안): 원자료가 위험 기준이면 nowscore = min(가중합, 상한).
  공통(CAI>100/체감온도 ≥34·≤0/60분강수 ≥15/UV ≥8): 위험 1개 69, 2개 이상 59,
  심한 위험(CAI>250/체감 ≥36·≤-6/강수 ≥30/UV ≥11) 39. 해양: 등급 나쁨·이안류 경계 69,
  매우나쁨·이안류 위험 39. 위험 기준은 공식 특보가 아닌 프로젝트 자체 기준.
- 결측 정책: 하나라도 결측이면 재정규화 없이 nowscore None(위험 여부를 확인할 수 없으므로).
  단 UV만 결측(주소가 없어 지역 UV를 못 찾는 관광지)이면 남은 축으로 재정규화해 점수를 낸다.
  결측 축 이름은 각 활동의 nan_score 리스트로 알려준다
  ("OO 점수가 반영되지 않은 점수입니다" 문구용, 원본과 동일하게 활동은 activity_type 이름)

**주의**: `harness/skills/score-algorithm.md`에 적혀 있던 기존 4유형(해변/산/도심/실내)
가중치·s_crowd 포함 방식과 이 코드는 다르다. 이 노트북이 팀원이 실제로 완성해서
전달한 최신 버전이라 이 코드를 기준으로 이식했다.

혼잡도(s_crowd)는 이 합성에 의도적으로 안 들어간다 — "부산 붐빔" 탭(`s_traffic`,
PlaceDetail "주변 혼잡도")에서 이미 별도로 다루고 있어서 중복 노출하지 않기로
사용자 확인(2026-09-18).

신호등(safe/caution/danger) 경계값은 팀원 코드에 없어 사용자 확인으로 정함
(2026-09-18: 70점 이상 safe / 2026-09-19: 실제 점수가 68~88점대에 몰려있어
70점 기준으로는 거의 다 safe로 떠서 변별력이 없다는 사용자 피드백으로 80점
상향): 80점 이상 safe, 40~79 caution, 40 미만 danger.

각 activity에 딸린 best_axis/worst_axis는 "왜 이 점수가 나왔는지" 설명용
(2026-09-19 추가) — LLM 없이, 그 activity의 가중합에 실제로 들어간 축들 중
가장 높은/낮은 것을 그대로 찾아서 알려준다. 문장으로 조립하는 건 프론트
담당(활동 이름은 프론트가 activity_type enum으로 다국어 처리하는 기존 방식과
통일하기 위해 여기서는 "air"/"temp"/"rain"/"uv"/"activity" 축 이름만 반환).

`generate_tips()`는 "그래서 뭘 챙겨야 하는지" 행동 지침용(2026-09-19 추가,
사용자 요청 — "자외선 높으면 선크림, 물놀이면 이안류 조심" 같은 구체적인 문구).
이것도 LLM이 아니라 원본 관측값(uv_index/기온/강수량/이안류 위험도)을 그대로
임계값 비교만 해서 코드 배열로 반환 — 점수(0~100)만으로는 기온처럼 "더워서
나쁜지 추워서 나쁜지" 방향을 알 수 없는 축이 있어서, 점수가 아니라 원본 관측값을
받는다. 문장 자체는 프론트 i18n이 담당(tip.* 키).
"""

_URBAN_WEIGHTS = {"air_score": 0.25, "temp_score": 0.25, "rain_score": 0.25, "uv_score": 0.25}
_COASTAL_BASE_WEIGHTS = {"air_score": 0.20, "temp_score": 0.20, "rain_score": 0.20, "uv_score": 0.20}
_COASTAL_ACTIVITY_WEIGHT = 0.20

_ACTIVITY_NAME = {"swim_score": "해수욕", "surf_score": "서핑", "marine_trip_score": "바다여행"}
_ACTIVITY_TYPE = {"swim_score": "swim", "surf_score": "surf", "marine_trip_score": "marine_trip"}

# 가중합에 쓰인 원본 키(air_score 등) -> 프론트에 노출할 축 이름. 해양활동 키
# (swim_score 등)는 activity_type이 이미 있으니 뭉뚱그려 "activity"로 표시.
_AXIS_LABEL = {"air_score": "air", "temp_score": "temp", "rain_score": "rain", "uv_score": "uv"}

_STATUS_SAFE_MIN = 80
_STATUS_CAUTION_MIN = 40


def _status(nowscore: float | None) -> str | None:
    if nowscore is None:
        return None
    if nowscore >= _STATUS_SAFE_MIN:
        return "safe"
    if nowscore >= _STATUS_CAUTION_MIN:
        return "caution"
    return "danger"


def _weighted_sum(scores: dict, weights: dict) -> tuple[float | None, list[str]]:
    """가중합과 결측 축 키 목록. UV만 결측이면 남은 가중치로 재정규화하고, 그 외 결측은
    점수를 내지 않는다(위험 여부를 확인할 수 없으므로)."""
    missing = [key for key in weights if scores.get(key) is None]
    if set(missing) - {"uv_score"}:
        return None, missing
    used = {key: weight for key, weight in weights.items() if key not in missing}
    return round(sum(scores[key] * weight for key, weight in used.items()) / sum(used.values()), 2), missing


# 해양 등급/이안류 문구 -> 상한. 더 위험한 단어를 먼저 검사한다("매우나쁨"이 "나쁨"을 포함).
_LEVEL_CAPS = {"매우나쁨": 39.0, "나쁨": 69.0}
_RIP_CAPS = {"위험": 39.0, "경계": 69.0}


def _common_cap(cai, temperature, rainfall_60m, uv_index) -> float | None:
    """공통 4개 원자료의 위험 상한. UV 외에 하나라도 없으면 위험 여부를 알 수 없어 None
    (UV가 없으면 UV 위험은 없는 것으로 보고 나머지로 판정)."""
    if None in (cai, temperature, rainfall_60m):
        return None
    uv_index = uv_index or 0
    if cai > 250 or temperature >= 36 or temperature <= -6 or rainfall_60m >= 30 or uv_index >= 11:
        return 39.0
    risks = sum([cai > 100, temperature >= 34 or temperature <= 0, rainfall_60m >= 15, uv_index >= 8])
    return {0: 100.0, 1: 69.0}.get(risks, 59.0)


def _text_cap(text: str | None, caps: dict) -> float:
    return next((cap for word, cap in caps.items() if text and word in text), 100.0)


def _marine_cap(level: str | None, rip_level: str | None) -> float | None:
    """해양활동 위험 상한. 해양 등급이 없으면 None(평가 불가). rip_level은 이안류 관측
    대상(해수욕·서핑)만 넘기고, 바다여행은 None."""
    if not level:
        return None
    return min(_text_cap(level.replace(" ", ""), _LEVEL_CAPS), _text_cap(rip_level, _RIP_CAPS))


def _best_worst_axes(scores: dict) -> dict:
    """scores(가중합에 실제로 들어간 축들, 결측 제외)에서 가장 높은/낮은 축 하나씩."""
    ranked = sorted(((_AXIS_LABEL.get(k, "activity"), v) for k, v in scores.items()), key=lambda kv: kv[1])
    worst_axis, worst_score = ranked[0]
    best_axis, best_score = ranked[-1]
    return {"best_axis": best_axis, "best_score": best_score, "worst_axis": worst_axis, "worst_score": worst_score}


_NO_AXES = {"best_axis": None, "best_score": None, "worst_axis": None, "worst_score": None}


def _activity(
    activity_type: str, activity_name: str, activity_score: float | None, scores: dict, weights: dict, cap: float | None
) -> dict:
    """활동 하나의 nowscore(가중합과 위험 상한 중 낮은 값)/신호등/설명용 축/결측 축(nan_score)."""
    nowscore, missing = _weighted_sum(scores, weights)
    nowscore = None if nowscore is None or cap is None else round(min(nowscore, cap), 2)
    used = {k: v for k, v in scores.items() if v is not None}
    axes = _best_worst_axes(used) if nowscore is not None else _NO_AXES
    return {
        "activity_type": activity_type,
        "activity_name": activity_name,
        "activity_score": activity_score,
        "nowscore": nowscore,
        "status": _status(nowscore),
        **axes,
        "nan_score": [_AXIS_LABEL.get(k, activity_type) for k in missing],
    }


def compute_nowgo_score(
    air_score: float | None,
    temp_score: float | None,
    rain_score: float | None,
    uv_score: float | None,
    marine_scores: dict,
    *,
    cai: float | None,
    temperature: float | None,
    rainfall_60m: float | None,
    uv_index: float | None,
    marine_risk: dict,
) -> dict:
    """관광지 하나의 NowGo Score.

    cai/temperature(체감)/rainfall_60m/uv_index: 위험 상한 판정용 원자료.
    marine_risk: {"swim_score": (해양 등급, 이안류 등급), ...} — 이안류는 관측 대상
        (해수욕·서핑)만 값을 넣고 바다여행은 None. 해양 등급이 없으면 그 활동은 평가 불가.

    marine_scores: {"swim_score": .., "surf_score": .., "marine_trip_score": ..} —
        관광지가 "지원하는" 활동만 키로 넣는다(값이 None이면 지원은 하지만 현재 점수가
        없다는 뜻이라 그 활동 행은 남기고 결측으로 처리, 아예 지원 안 하면 키를 뺀다).

    반환: {"tour_type", "air_score"/"temp_score"/"rain_score"/"uv_score"(공통 4축
    원점수 — 항목별 배점 표시용), "activities": [{"activity_type", "activity_name",
    "activity_score", "nowscore", "status", "best_axis", "best_score", "worst_axis",
    "worst_score", "nan_score"}, ...]}. urban은 activities가 activity_type="general"
    1개짜리 리스트.
    """
    base_scores = {"air_score": air_score, "temp_score": temp_score, "rain_score": rain_score, "uv_score": uv_score}

    common_cap = _common_cap(cai, temperature, rainfall_60m, uv_index)

    if not marine_scores:
        activities = [_activity("general", "일반 관광", None, base_scores, _URBAN_WEIGHTS, common_cap)]
    else:
        activities = []
        for key, score in marine_scores.items():
            marine_cap = _marine_cap(*marine_risk.get(key, (None, None)))
            if marine_cap is None:
                score = None  # 해양 등급이 없으면 위험 여부를 알 수 없어 결측 처리
            cap = None if common_cap is None or marine_cap is None else min(common_cap, marine_cap)
            activities.append(_activity(
                _ACTIVITY_TYPE[key],
                _ACTIVITY_NAME[key],
                score,
                {**base_scores, key: score},
                {**_COASTAL_BASE_WEIGHTS, key: _COASTAL_ACTIVITY_WEIGHT},
                cap,
            ))

    return {
        "tour_type": "coastal" if marine_scores else "urban",
        "air_score": air_score,
        "temp_score": temp_score,
        "rain_score": rain_score,
        "uv_score": uv_score,
        "activities": activities,
    }


def generate_tips(
    *,
    uv_index: float | None,
    temperature: float | None,
    rainfall_60m: float | None,
    air_score: float | None,
    rip_level: str | None,
) -> list[str]:
    """원본 관측값 임계값 비교로 행동 지침 코드 목록 생성. 각 코드는 프론트 i18n의
    `tip.<code>` 키로 번역된다. 신호가 없으면(값 없음/정상 범위) 그 축은 그냥 빠진다."""
    tips: list[str] = []

    if uv_index is not None:
        if uv_index > 10:
            tips.append("uv_extreme")
        elif uv_index > 7:
            tips.append("uv_high")
        elif uv_index > 5:
            tips.append("uv_moderate")

    if air_score is not None:
        if air_score < 30:
            tips.append("air_very_bad")
        elif air_score < 70:
            tips.append("air_bad")

    if rainfall_60m is not None:
        if rainfall_60m >= 30:
            tips.append("rain_heavy")
        elif rainfall_60m > 0:
            tips.append("rain_light")

    if temperature is not None:
        if temperature >= 33:
            tips.append("heat_extreme")
        elif temperature >= 30:
            tips.append("heat")
        elif temperature <= 0:
            tips.append("cold_extreme")
        elif temperature <= 5:
            tips.append("cold")

    if rip_level in ("경계", "위험"):
        tips.append("rip_current")

    return tips
