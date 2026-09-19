from pydantic import BaseModel, ConfigDict


class NowgoActivityOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    activity_type: str  # general / swim / surf / marine_trip
    activity_name: str  # 일반 관광 / 해수욕 / 서핑 / 바다여행
    activity_score: float | None  # 해당 활동 자체의 원점수 (general은 없음)
    nowscore: float | None  # 최종 합성 점수 (0~100)
    status: str | None  # safe / caution / danger

    # "왜 이 점수인지" 설명용 — 이 활동의 가중합에 실제로 들어간 축(air/temp/rain/uv/
    # activity) 중 가장 높은/낮은 것 하나씩. 문장 조립은 프론트가 담당(activity_type과
    # 같은 방식으로 축 이름을 다국어 번역).
    best_axis: str | None
    best_score: float | None
    worst_axis: str | None
    worst_score: float | None


class NowgoScoreOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    tour_type: str  # urban / coastal
    # 공통 4축 원점수 — "항목별로 몇 점 받았는지" 배점 표시용 (활동마다 안 바뀜)
    air_score: float | None
    temp_score: float | None
    rain_score: float | None
    uv_score: float | None
    activities: list[NowgoActivityOut]  # coastal이고 활동이 여럿이면 2개 이상
    # 행동 지침 코드 목록(예: ["uv_high", "rip_current"]) — 문장은 프론트 tip.* i18n 담당
    tips: list[str]


class PlaceOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    contentid: int
    title: str
    addr1: str | None
    sigungucode: int | None
    lat: float
    lng: float
    firstimage: str | None  # tour_spot.firstimage (대표 이미지, TourAPI 원본)
    category_name: str | None  # category_code.cat3_name (소분류명, 예: "박물관")
    cat1: str | None  # tour_spot.cat1 대분류 코드 (예: "A05"=음식) — 지도에서 음식점만 구분할 때 사용

    # tour_spot_env_classification 조인 결과
    env_group4: str  # 해변 / 산 / 도심 / 실내
    env_type_code: str  # BEACH / MOUNTAIN / WATER / URBAN / INDOOR
    is_env_target: bool  # 환경 신호등 점수 대상 여부 (실내는 항상 false)

    # tour_spot_intro 조인 결과 — 검색결과 카드에 이용시간을 보여주기 위해 목록에도 포함
    usetime: str | None  # 이용시간
    restdate: str | None  # 휴무일

    # nowgo_score_cache 조인 결과. is_env_target=false이거나 아직 배치가 안 돌았으면 None
    # (services/environment/nowgo_score.py — compose 로직/가중치는 그쪽 docstring 참고)
    nowgo: NowgoScoreOut | None


class NearbyFoodOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    contentid: int
    title: str
    firstimage: str | None
    distance_m: float


class PlaceDetailOut(PlaceOut):
    """/places/{contentid} 전용. tour_spot_intro의 나머지 필드 + 주변 음식점이 추가된다."""

    overview: str | None  # 소개글
    homepage: str | None
    parking: str | None
    infocenter: str | None  # 문의처
    usefee: str | None  # 이용요금 (문화시설/레포츠만 채워짐)
    nearby_food: list[NearbyFoodOut]  # 가까운 순 최대 3곳 (db/places_queries.py::nearby_food_places)
