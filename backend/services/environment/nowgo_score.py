"""NowGo Score 최종 합성 — 팀 제공 노트북(notebooks/점수산정.ipynb,
`make_nowscore_dataframe`) 그대로 이식.

원본은 `tour_final` 전체를 pandas로 한 번에 처리하는 배치 함수였다. 여기서는 이미
좌표 하나짜리 조회 함수로 통일된 나머지 environment 모듈들(air_score/weather_score/
uv_score/marine_score)에 맞춰, 관광지 하나의 부분 점수를 받아 계산하는 함수로 옮겼다
— 배치로 전체를 돌리고 싶으면 이 함수를 관광지 수만큼 반복 호출하면 원본과 같은
결과가 나온다.

핵심 로직(원본 그대로):
- 해양활동 점수(swim/surf/marine_trip) 중 하나라도 있으면 "해안"(coastal), 전부
  없으면 "도심"(urban)으로 분류 — env_group4가 아니라 실측 데이터 유무로 판정한다
- 도심: 대기·기온·강수·자외선 4개를 동일 가중치(0.25)로 가중합
- 해안: 위 4개(각 0.20) + 보유한 해양활동 점수 "각각"을 0.20으로 따로 가중합 —
  해수욕·서핑을 모두 제공하는 해변이면 활동별로 서로 다른 nowscore가 여러 개 나온다
  (원본의 wide->long melt와 동일한 개념 — activities 리스트로 표현)
- 필요한 점수 중 하나라도 없으면 그 nowscore는 None — 부분 가중치 재분배 안 함
  (다른 environment 데이터의 "결측이면 숨김" 원칙과 동일)

**주의**: `harness/skills/score-algorithm.md`에 적혀 있던 기존 4유형(해변/산/도심/실내)
가중치·s_crowd 포함 방식과 이 코드는 다르다. 이 노트북이 팀원이 실제로 완성해서
전달한 최신 버전이라 이 코드를 기준으로 이식했다.

혼잡도(s_crowd)는 이 합성에 의도적으로 안 들어간다 — "부산 붐빔" 탭(`s_traffic`,
PlaceDetail "주변 혼잡도")에서 이미 별도로 다루고 있어서 중복 노출하지 않기로
사용자 확인(2026-09-18).

신호등(safe/caution/danger) 경계값은 팀원 코드에 없어 사용자 확인으로 정함
(2026-09-18): 70점 이상 safe, 40~69 caution, 40 미만 danger.
"""

_URBAN_WEIGHTS = {"air_score": 0.25, "temp_score": 0.25, "rain_score": 0.25, "uv_score": 0.25}
_COASTAL_BASE_WEIGHTS = {"air_score": 0.20, "temp_score": 0.20, "rain_score": 0.20, "uv_score": 0.20}
_COASTAL_ACTIVITY_WEIGHT = 0.20

_ACTIVITY_NAME = {"swim_score": "해수욕", "surf_score": "서핑", "marine_trip_score": "바다여행"}
_ACTIVITY_TYPE = {"swim_score": "swim", "surf_score": "surf", "marine_trip_score": "marine_trip"}

_STATUS_SAFE_MIN = 70
_STATUS_CAUTION_MIN = 40


def _status(nowscore: float | None) -> str | None:
    if nowscore is None:
        return None
    if nowscore >= _STATUS_SAFE_MIN:
        return "safe"
    if nowscore >= _STATUS_CAUTION_MIN:
        return "caution"
    return "danger"


def _weighted_sum(scores: dict, weights: dict) -> float | None:
    """가중합. weights의 키 중 하나라도 scores에 없으면(None 포함) 전체가 None —
    부분 점수만으로 가중치를 재분배하지 않는다(원본과 동일)."""
    total = 0.0
    for key, weight in weights.items():
        value = scores.get(key)
        if value is None:
            return None
        total += value * weight
    return round(total, 2)


def compute_nowgo_score(
    air_score: float | None,
    temp_score: float | None,
    rain_score: float | None,
    uv_score: float | None,
    marine_scores: dict,
) -> dict:
    """관광지 하나의 NowGo Score.

    marine_scores: {"swim_score": .., "surf_score": .., "marine_trip_score": ..} —
        관광지가 실제로 보유한 축만 넣는다(코드가 아예 없는 축은 키를 빼거나 None).

    반환: {"tour_type": "urban"|"coastal", "activities": [{"activity_type",
    "activity_name", "activity_score", "nowscore", "status"}, ...]}
    urban은 activities가 activity_type="general" 1개짜리 리스트.
    """
    base_scores = {"air_score": air_score, "temp_score": temp_score, "rain_score": rain_score, "uv_score": uv_score}
    present_marine = {k: v for k, v in marine_scores.items() if v is not None}

    if not present_marine:
        nowscore = _weighted_sum(base_scores, _URBAN_WEIGHTS)
        return {
            "tour_type": "urban",
            "activities": [{
                "activity_type": "general",
                "activity_name": "일반 관광",
                "activity_score": None,
                "nowscore": nowscore,
                "status": _status(nowscore),
            }],
        }

    activities = []
    for key, score in present_marine.items():
        weights = {**_COASTAL_BASE_WEIGHTS, key: _COASTAL_ACTIVITY_WEIGHT}
        scores = {**base_scores, key: score}
        nowscore = _weighted_sum(scores, weights)
        activities.append({
            "activity_type": _ACTIVITY_TYPE[key],
            "activity_name": _ACTIVITY_NAME[key],
            "activity_score": score,
            "nowscore": nowscore,
            "status": _status(nowscore),
        })

    return {"tour_type": "coastal", "activities": activities}
