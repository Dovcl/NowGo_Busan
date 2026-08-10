from geoalchemy2 import Geometry
from sqlalchemy import (
    BigInteger,
    Boolean,
    Column,
    DateTime,
    ForeignKey,
    Integer,
    SmallInteger,
    String,
    Text,
    UniqueConstraint,
    func,
)
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


class UserSession(Base):
    """로그인 세션. id 자체가 쿠키 값(토큰)이라 별도 조회용 id 컬럼을 안 둔다.
    SQLAlchemy의 Session과 이름이 겹치지 않도록 UserSession으로 명명."""

    __tablename__ = "sessions"

    id = Column(String, primary_key=True)  # secrets.token_urlsafe로 생성한 랜덤 문자열
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())

    user = relationship("User")
