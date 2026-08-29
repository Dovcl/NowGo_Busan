from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    Date,
    DateTime,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import relationship

from db.base import Base


class SigunguCode(Base):
    __tablename__ = "sigungu_code"

    # TourAPI areaCode2 sigunguCode (부산 16개 구·군)
    code = Column(Integer, primary_key=True)
    name = Column(String, nullable=False)


class CategoryCode(Base):
    __tablename__ = "category_code"

    code = Column(String, primary_key=True)  # 예: 'A01011200' (레벨에 따라 3/5/9자리)
    level = Column(SmallInteger, nullable=False)  # 1=대분류, 2=중분류, 3=소분류
    name = Column(String, nullable=False)
    cat1 = Column(String)
    cat1_name = Column(String)
    cat2 = Column(String)
    cat2_name = Column(String)
    cat3 = Column(String)
    cat3_name = Column(String)


class ContentType(Base):
    __tablename__ = "content_type"

    contenttypeid = Column(Integer, primary_key=True)  # 12,14,15,25,28,32,38,39
    name = Column(String, nullable=False)
    name_en = Column(String)
    is_env_target = Column(Boolean, nullable=False)  # NowGo Score 평가 대상 여부
    note = Column(String)


class TourSpot(Base):
    __tablename__ = "tour_spot"

    # areaBasedList2.contentid — TourAPI가 이미 채번한 값이라 여기서 자동증가시키면 안 됨
    contentid = Column(BigInteger, primary_key=True, autoincrement=False)
    contenttypeid = Column(Integer, ForeignKey("content_type.contenttypeid"), nullable=False)
    title = Column(String, nullable=False)
    addr1 = Column(String)
    addr2 = Column(String)
    areacode = Column(Integer)
    sigungucode = Column(Integer, ForeignKey("sigungu_code.code"))
    cat1 = Column(String)
    cat2 = Column(String)
    cat3 = Column(String, ForeignKey("category_code.code"))
    tel = Column(String)
    zipcode = Column(String)
    mlevel = Column(SmallInteger)
    firstimage = Column(String)
    firstimage2 = Column(String)
    cpyrhtdivcd = Column(String)
    createdtime = Column(DateTime)
    modifiedtime = Column(DateTime)
    ldongregncd = Column(String)
    ldongsignugucd = Column(String)
    lclssystm1 = Column(String)
    lclssystm2 = Column(String)
    lclssystm3 = Column(String)

    # mapx/mapy 대신 PostGIS Point 하나로 (WGS84 = srid 4326)
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)

    env_classification = relationship(
        "TourSpotEnvClassification", back_populates="tour_spot", uselist=False
    )


class TourSpotEnvClassification(Base):
    """classify_tour_type.ipynb의 규칙 기반 분류 결과. tour_spot과 1:1이지만
    재분류 로직이 바뀔 수 있어 별도 테이블로 분리 (tour_spot 자체는 안 건드림)."""

    __tablename__ = "tour_spot_env_classification"

    contentid = Column(BigInteger, ForeignKey("tour_spot.contentid"), primary_key=True)

    # BEACH / MOUNTAIN / WATER / URBAN / INDOOR (5분류 원본값)
    env_type_code = Column(String, nullable=False)
    # 해변 / 산 / 도심 / 실내 (score-algorithm.md 가중치가 갈라지는 4분류)
    env_group4 = Column(String, nullable=False)

    is_outdoor = Column(Boolean, nullable=False)
    is_env_target = Column(Boolean, nullable=False)
    direct_water_contact = Column(Boolean, nullable=False)
    water_quality_zone = Column(Boolean, nullable=False)

    tour_spot = relationship("TourSpot", back_populates="env_classification")


class TourSpotIntro(Base):
    """tour_detailCommon2(공통) + tour_detailIntro2(유형별 상세) 조인 결과.

    TourAPI는 contenttypeid별로 "이용시간/휴무일/주차/문의처" 원본 컬럼명이 갈라진다
    (관광지=usetime, 문화시설=usetimeculture, 레포츠=usetimeleports, 축제=usetimefestival 등).
    이 테이블은 그 차이를 흡수해서 하나의 정규화된 컬럼셋으로 저장한다
    (매핑 로직은 etl/seed_tour_spot_intro.py의 FIELD_MAP 참고).
    """

    __tablename__ = "tour_spot_intro"

    contentid = Column(BigInteger, ForeignKey("tour_spot.contentid"), primary_key=True)

    overview = Column(Text)  # detailCommon2.overview (소개글)
    homepage = Column(String)  # detailCommon2.homepage에서 <a href> URL만 추출
    usetime = Column(String)  # 이용시간
    restdate = Column(String)  # 휴무일
    parking = Column(String)  # 주차정보
    infocenter = Column(String)  # 문의처
    usefee = Column(String)  # 이용요금 (문화시설/레포츠만 채워짐)

    tour_spot = relationship("TourSpot", backref="intro")


class EventRaw(Base):
    """축제·행사 다중 소스(TourAPI/다봄/KOPIS/...) 원본을 그대로 보존하는 테이블.

    harness/DECISIONS.md Phase 0 참고 — contenttypeid=15(축제)는 이제 tour_spot에
    안 들어가고 여기로 온다(지도에 상시 관광지처럼 뜨던 문제 해결). dedup·정규화는
    이후 event_normalized/events 단계에서 처리하고, 이 테이블은 수집이 실패해도
    절대 지우지 않는다 — 원본을 보존해야 나중에 정규화 로직을 바꿔도 재현 가능함.
    """

    __tablename__ = "event_raw"

    source = Column(String, primary_key=True)  # 'tourapi' / 'dabom' / 'kopis' / ...
    source_event_id = Column(String, primary_key=True)  # 소스별 원본 id (문자열로 통일)

    raw_payload = Column(JSONB, nullable=False)  # API 응답 그대로
    fetched_at = Column(DateTime, nullable=False)
    source_url = Column(String)  # 상세/공식 페이지 URL — 못 구한 항목은 null


class EventNormalized(Base):
    """event_raw 1건을 소스별 정규화 함수(etl/build_events.py)로 공통 필드로 옮긴 것.
    dedup(candidate blocking·유사도 스코어링)은 전부 이 테이블 기준으로 돈다.

    geom은 nullable — KOPIS는 공연장 좌표를 안 주고 시설명(fcltynm) 텍스트만 준다
    (실측 확인). 좌표 없는 소스는 venue 유사도를 텍스트 비교로 대체한다."""

    __tablename__ = "event_normalized"

    source = Column(String, primary_key=True)
    source_event_id = Column(String, primary_key=True)

    title = Column(String, nullable=False)
    normalized_title = Column(String, nullable=False)  # 연도·"제N회"·괄호·공백 제거
    start_date = Column(Date)
    end_date = Column(Date)
    venue = Column(String)
    address = Column(String)
    geom = Column(Geometry(geometry_type="POINT", srid=4326))  # 없는 소스는 null
    category = Column(String)  # festival / performance 등 — 소스별 원 카테고리 최대한 보존
    image_url = Column(String)  # TourAPI firstimage / KOPIS poster — 둘 다 원본에 이미 있어서 그대로 씀

    __table_args__ = (
        ForeignKeyConstraint(["source", "source_event_id"], ["event_raw.source", "event_raw.source_event_id"]),
    )


class Event(Base):
    """정규화·dedup을 거쳐 확정된 canonical 행사. 프론트 Recommend/캘린더가 보는 건 이 테이블뿐이고,
    event_raw/event_normalized는 절대 직접 노출하지 않는다(원본 보존용)."""

    __tablename__ = "events"

    id = Column(Integer, primary_key=True, autoincrement=True)

    title = Column(String, nullable=False)
    start_date = Column(Date)
    end_date = Column(Date)
    venue = Column(String)
    address = Column(String)
    geom = Column(Geometry(geometry_type="POINT", srid=4326))
    category = Column(String)
    image_url = Column(String)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=func.now())


class EventSourceMap(Base):
    """canonical event 1건 <-> 원본(event_raw) N건 매핑. 병합해도 원본 연결은 남겨서
    "왜 이 행사가 이렇게 됐는지"(provenance)를 항상 추적할 수 있게 한다."""

    __tablename__ = "event_source_map"

    event_id = Column(Integer, ForeignKey("events.id"), primary_key=True)
    source = Column(String, primary_key=True)
    source_event_id = Column(String, primary_key=True)

    __table_args__ = (
        ForeignKeyConstraint(["source", "source_event_id"], ["event_raw.source", "event_raw.source_event_id"]),
    )


class EventDedupCandidate(Base):
    """candidate blocking(날짜 겹침)을 통과한 서로 다른 소스 두 건의 중복 여부 판단 큐.
    AUTO_MERGE는 초기엔 항상 꺼둔다(harness/DECISIONS.md Phase 2) — score가 아무리 높아도
    decision은 사람이 검토해서 SAME/DIFFERENT로 바꾸기 전까진 PENDING으로 남고, 두 원본은
    각자 별도 canonical event로 존재한다. 잘못 자동병합된 이벤트가 조용히 쌓이는 것보다
    "중복인데 따로 보이는" 게 훨씬 덜 나쁨."""

    __tablename__ = "event_dedup_candidates"

    id = Column(Integer, primary_key=True, autoincrement=True)

    a_source = Column(String, nullable=False)
    a_source_event_id = Column(String, nullable=False)
    b_source = Column(String, nullable=False)
    b_source_event_id = Column(String, nullable=False)

    title_score = Column(Float, nullable=False)
    date_score = Column(Float, nullable=False)
    venue_score = Column(Float, nullable=False)
    total_score = Column(Float, nullable=False)

    decision = Column(String, nullable=False, default="PENDING")  # PENDING / SAME / DIFFERENT
    created_at = Column(DateTime, nullable=False, server_default=func.now())
    reviewed_at = Column(DateTime)

    __table_args__ = (
        ForeignKeyConstraint(["a_source", "a_source_event_id"], ["event_raw.source", "event_raw.source_event_id"]),
        ForeignKeyConstraint(["b_source", "b_source_event_id"], ["event_raw.source", "event_raw.source_event_id"]),
        UniqueConstraint("a_source", "a_source_event_id", "b_source", "b_source_event_id"),
    )


class WeatherCache(Base):
    """기상청 초단기예보(getUltraSrtFcst) 배치 캐시. 관광지별이 아니라 격자(nx,ny) 단위로
    저장 — 좌표 하나가 들어오면 이 중 가장 가까운 셀을 찾아 쓴다(services/environment)."""

    __tablename__ = "weather_cache"

    nx = Column(Integer, primary_key=True)
    ny = Column(Integer, primary_key=True)

    temperature = Column(Float)  # T1H, ℃
    humidity = Column(Float)  # REH, %
    wind_speed = Column(Float)  # WSD, m/s
    precipitation_prob = Column(Float)  # 초단기예보는 POP 미제공이라 null
    sky = Column(SmallInteger)  # SKY: 1=맑음 3=구름많음 4=흐림
    precipitation_type = Column(SmallInteger)  # PTY: 0=없음 1=비 2=비/눈 3=눈 4=소나기

    # 같은 API 응답 안에 이후 시간대 예보도 같이 오길래 버리지 않고 다음 6시간치를
    # 시간별로 뽑아 통째로 저장 — [{fcst_date, fcst_time, temperature, sky,
    # precipitation_type, precipitation_prob}, ...] (etl/fetch_weather.py 참고)
    forecast = Column(JSONB)

    fetched_at = Column(DateTime, nullable=False)


class UvIndexCache(Base):
    """기상청 생활기상지수(getUVIdxV5) 배치 캐시. 구·군 단위(areaNo)로도 나올 수 있지만
    MVP는 부산 전체 1행(area_no='2600000000')만 사용."""

    __tablename__ = "uv_index_cache"

    area_no = Column(String, primary_key=True)
    uv_index = Column(Integer)
    fetched_at = Column(DateTime, nullable=False)


class AirQualityCache(Base):
    """에어코리아 측정소별 실시간 측정정보 배치 캐시. 좌표는 측정소정보 API로 채워야 하며,
    그 전까지는 이 테이블이 비어 있어도 나머지 환경 데이터 조회에는 지장 없다."""

    __tablename__ = "air_quality_cache"

    station_name = Column(String, primary_key=True)
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)

    pm10 = Column(Float)
    pm25 = Column(Float)
    o3 = Column(Float)
    # 환경부 공식 4단계 등급(1=좋음 2=보통 3=나쁨 4=매우나쁨) — 우리가 기준값을
    # 새로 정하지 않고 에어코리아 응답의 등급을 그대로 저장해 신뢰도를 유지한다.
    pm10_grade = Column(SmallInteger)
    pm25_grade = Column(SmallInteger)

    fetched_at = Column(DateTime, nullable=False)


class RipCurrentCache(Base):
    """국립해양조사원 이안류 지수(GetRipCurrentApiService) 배치 캐시. 매년 6~9월에만
    운영되는 계절 서비스라(그 외 기간엔 API가 데이터를 안 줌) 비시즌엔 테이블이
    비어 있는 게 정상 — 그 경우 나머지 환경 데이터 조회에는 지장 없다."""

    __tablename__ = "rip_current_cache"

    station_code = Column(String, primary_key=True)  # obsvtrId, 예: HAE(해운대)
    station_name = Column(String, nullable=False)
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)

    index_value = Column(Float)  # lastScr
    risk_level = Column(String)  # lastScrCn: 관심/주의/경계/위험 4단계
    wave_height = Column(Float)  # wvhgt, m
    water_temp = Column(Float)  # wtem, ℃
    observed_at = Column(DateTime)  # obsrvnDt

    fetched_at = Column(DateTime, nullable=False)


class RoadLinkCache(Base):
    """국토교통부 표준노드링크 좌표 마스터. 월 1회 정도만 갱신되는 정적 데이터라
    실시간 속도(RoadLinkTrafficCache)와 테이블을 분리 — 갱신 주기가 완전히 달라서
    한 테이블에 합치면 서로 다른 스크립트가 upsert할 때 NULL로 덮어쓰는 문제가 생김
    (harness/DECISIONS.md 2026-08-20, AirQualityCache 때 겪었던 것과 같은 문제).

    link_id는 LINKTrafficList의 lkId와 동일 체계(국가 표준 LINK_ID, 앞 3자리가
    시군구 권역코드). 좌표는 부산 prefix로 먼저 필터링하지 않고 실시간 링크 9,207개를
    전국 데이터에서 exact match로 뽑아야 정확함(prefix 필터 시 157개 누락 확인됨)."""

    __tablename__ = "road_link_cache"

    link_id = Column(String, primary_key=True)
    road_name = Column(String)
    geom = Column(Geometry(geometry_type="LINESTRING", srid=4326), nullable=False)
    length_m = Column(Float)


class RoadLinkTrafficCache(Base):
    """부산광역시_링크소통정보(LINKTrafficList) 실시간 스냅샷. 10~15분 주기 ETL이
    매 사이클 갱신 — 한 사이클(93페이지)이 부분 실패하면 이 테이블을 건드리지 않고
    스킵해야 함(cycle integrity, harness/DECISIONS.md 참고)."""

    __tablename__ = "road_link_traffic_cache"

    link_id = Column(String, ForeignKey("road_link_cache.link_id"), primary_key=True)
    current_speed = Column(Float)
    current_volume = Column(Float)
    observed_at = Column(DateTime, nullable=False)  # API statsDt — dow/hour 계산 기준
    fetched_at = Column(DateTime, nullable=False)  # 우리가 실제 호출한 시각


class RoadLinkHourlyBuffer(Base):
    """RoadLinkBaseline에 반영하기 전 시간당 누적 staging 테이블. 15분 주기로 들어오는
    관측치를 그대로 baseline에 반영하면 같은 날의 4개 샘플이 서로 다른 4번의 관측처럼
    카운트돼서 sample_count(=관측한 날짜 수) 정의가 깨짐(harness/DECISIONS.md 2026-08-20).

    ETL 사이클마다 speed_sum/volume_sum/observation_count를 누적하다가, 그 시간대가
    끝나면(observed_at.hour가 바뀌면) 평균을 계산해 RoadLinkBaseline에 딱 한 번 반영하고
    이 행은 지운다 — 그래서 하루 이상 오래 남아있는 행이 있으면 그 자체가 이상 신호."""

    __tablename__ = "road_link_hourly_buffer"

    link_id = Column(String, ForeignKey("road_link_cache.link_id"), primary_key=True)
    observed_date = Column(String, primary_key=True)  # YYYY-MM-DD (Asia/Seoul 기준)
    hour = Column(SmallInteger, primary_key=True)  # 0~23

    speed_sum = Column(Float, nullable=False, default=0)
    volume_sum = Column(Float, nullable=False, default=0)
    volume_count = Column(Integer, nullable=False, default=0)  # speed와 별도 카운트 (volume만 결측일 수 있어서)
    observation_count = Column(Integer, nullable=False, default=0)


class RoadLinkBaseline(Base):
    """링크별 요일×시간대 자체 누적 baseline. 외부 API가 아니라 우리가 직접 쌓음
    (harness/DECISIONS.md 2026-08-20 — 관광빅데이터/지하철은 단위가 달라 결합에
    별도 정규화가 필요해서 채택 안 함).

    sample_count는 관측 "횟수"가 아니라 관측한 날짜 수를 의미해야 함 — 같은 날
    15분 간격으로 들어온 여러 샘플은 서로 독립된 관측이 아니라 그날 하루의 스냅샷일
    뿐이라, ETL에서 시간당 대표값 1개로 집계한 뒤에만 이 테이블에 반영한다."""

    __tablename__ = "road_link_baseline"

    link_id = Column(String, ForeignKey("road_link_cache.link_id"), primary_key=True)
    dow = Column(SmallInteger, primary_key=True)  # 0=월 ~ 6=일
    hour = Column(SmallInteger, primary_key=True)  # 0~23

    avg_speed = Column(Float, nullable=False)
    avg_volume = Column(Float)
    sample_count = Column(Integer, nullable=False, default=0)  # 관측한 날짜 수


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    nickname = Column(String, nullable=False)

    # admin 로그인 전용. 소셜 로그인 유저는 둘 다 null
    email = Column(String, unique=True)
    password_hash = Column(String)

    role = Column(String, nullable=False, default="tourist")  # 'tourist' | 'admin'

    terms_agreed_at = Column(DateTime, nullable=False)
    privacy_agreed_at = Column(DateTime, nullable=False)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    deleted_at = Column(DateTime)  # soft delete

    social_accounts = relationship("UserSocialAccount", back_populates="user")


class UserSocialAccount(Base):
    __tablename__ = "user_social_accounts"
    __table_args__ = (UniqueConstraint("provider", "provider_user_id"),)

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)

    provider = Column(String, nullable=False)  # 'kakao' | 'google'
    provider_user_id = Column(String, nullable=False)  # 카카오 id / 구글 sub
    email = Column(String)  # 공급자 프로필 이메일, 병합용으로 안 씀 (참고용)

    created_at = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User", back_populates="social_accounts")


class PlaceList(Base):
    """구글 지도 "목록에 저장"과 같은 개념 — 유저가 관광지를 담아두는 리스트.
    is_default=True인 "즐겨찾기" 리스트는 유저별로 하나, 첫 조회 시 자동 생성된다
    (routers/lists.py)."""

    __tablename__ = "place_lists"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    name = Column(String, nullable=False)
    is_default = Column(Boolean, nullable=False, default=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    items = relationship("PlaceListItem", back_populates="place_list", cascade="all, delete-orphan")


class PlaceListItem(Base):
    __tablename__ = "place_list_items"

    list_id = Column(Integer, ForeignKey("place_lists.id"), primary_key=True)
    contentid = Column(BigInteger, ForeignKey("tour_spot.contentid"), primary_key=True)
    added_at = Column(DateTime, nullable=False, server_default=func.now())
    # 리스트 안에서의 순서 — 사용자가 드래그로 재배열한 결과(routers/lists.py reorder_items).
    # 추후 지도에 이 순서대로 경로 표시할 때 씀. 새로 추가되는 항목은 맨 뒤로 붙는다.
    position = Column(Integer, nullable=False, default=0)

    place_list = relationship("PlaceList", back_populates="items")


class UserSession(Base):
    """로그인 세션. id 자체가 쿠키 값(토큰)이라 별도 조회용 id 컬럼을 안 둔다.
    SQLAlchemy의 Session과 이름이 겹치지 않도록 UserSession으로 명명."""

    __tablename__ = "sessions"

    id = Column(String, primary_key=True)  # secrets.token_urlsafe로 생성한 랜덤 문자열
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User")
