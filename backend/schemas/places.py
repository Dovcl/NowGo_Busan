from pydantic import BaseModel, ConfigDict


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

    # tour_spot_env_classification 조인 결과
    env_group4: str  # 해변 / 산 / 도심 / 실내
    env_type_code: str  # BEACH / MOUNTAIN / WATER / URBAN / INDOOR
    is_env_target: bool  # 환경 신호등 점수 대상 여부 (실내는 항상 false)


class PlaceDetailOut(PlaceOut):
    """/places/{contentid} 전용. tour_spot_intro 조인 결과가 추가된다.
    목록(/places)은 지도 핀용이라 이 필드들까지 실어보내면 페이로드만 커지므로 싣지 않음."""

    overview: str | None  # 소개글
    homepage: str | None
    usetime: str | None  # 이용시간
    restdate: str | None  # 휴무일
    parking: str | None
    infocenter: str | None  # 문의처
    usefee: str | None  # 이용요금 (문화시설/레포츠만 채워짐)
