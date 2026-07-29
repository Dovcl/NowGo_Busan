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
