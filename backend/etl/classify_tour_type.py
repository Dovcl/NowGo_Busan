from pathlib import Path

import pandas as pd

# notebooks/는 gitignore 대상이라 다른 사람이 clone하면 존재하지 않음.
# 백엔드가 실제로 의존하는 시드 데이터는 backend/etl/seed_data/에 따로 커밋해둠.
SEED_DATA_DIR = Path(__file__).resolve().parent / "seed_data"

# -------------------------------------------------------------------
# 0) contenttypeid(콘텐츠 유형) 코드 사전
#    TourAPI에는 categoryCode2 같은 조회용 엔드포인트가 없어서, API 문서에
#    고정으로 명시된 8개 값을 tour_contentTypeId.csv로 직접 옮겨 적었다.
#    (cat1/cat2/cat3와 달리 "API로 검증"이 아니라 "문서 기준 고정값"이라는 점에 주의)
# -------------------------------------------------------------------
CONTENT_TYPE_PATH = SEED_DATA_DIR / "tour_contentTypeId.csv"
CONTENT_TYPE_DF = pd.read_csv(CONTENT_TYPE_PATH)
CONTENT_TYPE_NAME = dict(zip(CONTENT_TYPE_DF["contenttypeid"], CONTENT_TYPE_DF["name"]))

# 환경 신호등 평가 대상 contenttypeid (관광지/문화시설/축제/코스/레포츠만;
# 음식점·숙박·쇼핑은 tour_contentTypeId.csv의 is_env_target=False로 제외)
TARGET_CONTENTTYPES = set(CONTENT_TYPE_DF.loc[CONTENT_TYPE_DF["is_env_target"], "contenttypeid"])

# -------------------------------------------------------------------
# 1) cat3(소분류) 코드 -> 환경 리스크 유형 매핑 테이블
#    (tour_categoryCode2_all.csv 전체 184개 코드를 기준으로 작성)
#
#    레포츠(A03, C0116)는 "장소"가 아니라 "활동"이라 별도의 SPORTS
#    유형을 두지 않는다. 대신 각 레포츠 코드를 실제로 가장 많이 벌어지는
#    장소(산/해변/수변/도심/실내) 중 하나로 기본 배정하고, 특정 시설명이
#    그 기본값과 다르면 LOCATION_OVERRIDE_BY_TITLE 로 덮어쓴다.
# -------------------------------------------------------------------
CAT3_TO_TYPE = {
    # --- A01 자연 : 해변형 ---
    "A01011200": "BEACH",      # 해수욕장
    "A01011100": "BEACH",      # 해안절경
    "A01011400": "BEACH",      # 항구/포구
    "A01011600": "BEACH",      # 등대
    "A01011300": "BEACH",      # 섬

    # --- A01 자연 : 산자연형 ---
    "A01010100": "MOUNTAIN",   # 국립공원
    "A01010200": "MOUNTAIN",   # 도립공원
    "A01010300": "MOUNTAIN",   # 군립공원
    "A01010400": "MOUNTAIN",   # 산
    "A01010500": "MOUNTAIN",   # 자연생태관광지
    "A01010600": "MOUNTAIN",   # 자연휴양림
    "A01010700": "MOUNTAIN",   # 수목원
    "A01010800": "MOUNTAIN",   # 폭포
    "A01011000": "MOUNTAIN",   # 약수터
    "A01011900": "MOUNTAIN",   # 동굴
    "A01020100": "MOUNTAIN",   # 희귀동.식물
    "A01020200": "MOUNTAIN",   # 기암괴석

    # --- A01 자연 : 내륙수변형 ---
    "A01011700": "WATER",      # 호수
    "A01011800": "WATER",      # 강
    "A01010900": "WATER",      # 계곡 (도섭 가능한 하천형 계류라 수질 리스크가 지배적; 산 대기질보다 우선)

    # --- A02 역사관광지(야외) : 도심야외문화형 ---
    "A02010100": "URBAN",      # 고궁
    "A02010200": "URBAN",      # 성
    "A02010300": "URBAN",      # 문
    "A02010400": "URBAN",      # 고택
    "A02010500": "URBAN",      # 생가
    "A02010600": "URBAN",      # 민속마을
    "A02010700": "URBAN",      # 유적지/사적지
    "A02010800": "URBAN",      # 사찰
    "A02010900": "URBAN",      # 종교성지
    "A02011000": "URBAN",      # 안보관광

    # --- A02 휴양관광지 ---
    "A02020200": "URBAN",      # 관광단지
    "A02020300": "INDOOR",     # 온천/욕장/스파
    "A02020400": "INDOOR",     # 이색찜질방
    "A02020500": "INDOOR",     # 헬스투어
    "A02020600": "URBAN",      # 테마공원 (야외형 전제)
    "A02020700": "URBAN",      # 공원
    "A02020800": "WATER",      # 유람선/잠수함관광 (해상이면 BEACH가 맞지만 강/내항도 있어 기본 WATER, 필요시 좌표로 재보정)

    # --- A02 체험관광지 ---
    "A02030100": "URBAN",      # 농.산.어촌 체험 (야외)
    "A02030200": "URBAN",      # 전통체험
    "A02030300": "MOUNTAIN",   # 산사체험
    "A02030400": "URBAN",      # 이색체험
    "A02030600": "URBAN",      # 이색거리

    # --- A02 산업관광지 : 실내형 ---
    "A02040400": "INDOOR",     # 발전소
    "A02040600": "INDOOR",     # 식음료
    "A02040800": "INDOOR",     # 기타
    "A02040900": "INDOOR",     # 전자-반도체
    "A02041000": "INDOOR",     # 자동차

    # --- A02 건축/조형물 : 도심야외문화형 (실외 랜드마크) ---
    "A02050100": "URBAN",      # 다리/대교
    "A02050200": "URBAN",      # 기념탑/기념비/전망대
    "A02050300": "URBAN",      # 분수
    "A02050400": "URBAN",      # 동상
    "A02050500": "URBAN",      # 터널
    "A02050600": "URBAN",      # 유명건물

    # --- A02 문화시설 : 실내형 ---
    "A02060100": "INDOOR",     # 박물관
    "A02060200": "INDOOR",     # 기념관
    "A02060300": "INDOOR",     # 전시관
    "A02060400": "INDOOR",     # 컨벤션센터
    "A02060500": "INDOOR",     # 미술관/화랑
    "A02060600": "INDOOR",     # 공연장
    "A02060700": "INDOOR",     # 문화원
    "A02060800": "INDOOR",     # 외국문화원
    "A02060900": "INDOOR",     # 도서관
    "A02061000": "INDOOR",     # 대형서점
    "A02061100": "INDOOR",     # 문화전수시설
    "A02061200": "INDOOR",     # 영화관
    "A02061300": "INDOOR",     # 어학당
    "A02061400": "INDOOR",     # 학교

    # --- A02 축제 : 도심야외문화형 (야외 개최 전제, 우천/대기 영향 큼) ---
    "A02070100": "URBAN",      # 문화관광축제
    "A02070200": "URBAN",      # 일반축제

    # --- A02 공연/행사 : 실내형 (대부분 실내 개최) ---
    "A02080100": "URBAN",      # 전통공연 (야외 마당극 등 많아 URBAN)
    "A02080200": "INDOOR",     # 연극
    "A02080300": "INDOOR",     # 뮤지컬
    "A02080400": "INDOOR",     # 오페라
    "A02080500": "INDOOR",     # 전시회
    "A02080600": "INDOOR",     # 박람회
    "A02080800": "INDOOR",     # 무용
    "A02080900": "INDOOR",     # 클래식음악회
    "A02081000": "URBAN",      # 대중콘서트 (야외 개최 많음)
    "A02081100": "INDOOR",     # 영화
    "A02081200": "URBAN",      # 스포츠경기 (야외 경기장 다수)
    "A02081300": "URBAN",      # 기타행사
    "A02081400": "INDOOR",     # 넌버벌

    # --- A03 레포츠소개 ---
    "A03010200": "WATER",      # 수상레포츠
    "A03010300": "MOUNTAIN",   # 항공레포츠 (활공 시작 지점 기준)

    # --- A03 육상 레포츠 ---
    "A03020200": "MOUNTAIN",   # 수련시설 (청소년수련원 등 자연 인접 다수)
    "A03020300": "URBAN",      # 경기장
    "A03020400": "INDOOR",     # 인라인(실내 인라인 포함)
    "A03020500": "URBAN",      # 자전거하이킹 (도심/강변 자전거길 다수)
    "A03020600": "URBAN",      # 카트
    "A03020700": "MOUNTAIN",   # 골프 (교외 구릉지 대형 실외부지)
    "A03020800": "URBAN",      # 경마
    "A03020900": "URBAN",      # 경륜
    "A03021000": "INDOOR",     # 카지노
    "A03021100": "MOUNTAIN",   # 승마
    "A03021200": "MOUNTAIN",   # 스키/스노보드
    "A03021300": "INDOOR",     # 스케이트(대부분 실내 링크)
    "A03021400": "MOUNTAIN",   # 썰매장
    "A03021500": "MOUNTAIN",   # 수렵장
    "A03021600": "MOUNTAIN",   # 사격장 (도심 외곽 실외 사격장 기준, 실내형은 개별 override)
    "A03021700": "MOUNTAIN",   # 야영장,오토캠핑장
    "A03021800": "MOUNTAIN",   # 암벽등반
    "A03022000": "MOUNTAIN",   # 서바이벌게임 (수풀지형 다수)
    "A03022100": "MOUNTAIN",   # ATV
    "A03022200": "MOUNTAIN",   # MTB
    "A03022300": "MOUNTAIN",   # 오프로드
    "A03022400": "URBAN",      # 번지점프 (교량/타워 등 도심 랜드마크 다수)
    "A03022700": "MOUNTAIN",   # 트래킹

    # --- A03 수상 레포츠 : 해변형/내륙수변형 (해양 vs 하천 구분) ---
    "A03030100": "BEACH",      # 윈드서핑/제트스키
    "A03030200": "WATER",      # 카약/카누 (하천계 많음)
    "A03030300": "BEACH",      # 요트
    "A03030400": "BEACH",      # 스노쿨링/스킨스쿠버다이빙
    "A03030500": "WATER",      # 민물낚시
    "A03030600": "BEACH",      # 바다낚시
    "A03030700": "BEACH",      # 수영 (해수욕 전제)
    "A03030800": "WATER",      # 래프팅

    # --- A03 항공 레포츠 : 이륙지점 기준 산자연형 ---
    "A03040100": "MOUNTAIN",   # 스카이다이빙
    "A03040200": "MOUNTAIN",   # 초경량비행
    "A03040300": "MOUNTAIN",   # 헹글라이딩/패러글라이딩
    "A03040400": "MOUNTAIN",   # 열기구

    # --- A03 복합 레포츠 ---
    "A03050100": "URBAN",      # 복합 레포츠 (도심 근교 대형 복합시설 다수)

    # --- A04 쇼핑 : 도심(5일장/상설시장=야외) vs 실내(백화점 등) ---
    "A04010100": "URBAN",      # 5일장
    "A04010200": "URBAN",      # 상설시장
    "A04010300": "INDOOR",     # 백화점
    "A04010400": "INDOOR",     # 면세점
    "A04010500": "INDOOR",     # 대형마트
    "A04010600": "URBAN",      # 전문매장/상가 (거리형 다수)
    "A04010700": "URBAN",      # 공예/공방
    "A04010900": "URBAN",      # 특산물판매점
    "A04011000": "INDOOR",     # 사후면세점
    "A04011200": "INDOOR",     # 스키(보드) 렌탈샵

    # --- A05 음식점 : 전부 실내형(기본값) ---
    "A05020100": "INDOOR",
    "A05020200": "INDOOR",
    "A05020300": "INDOOR",
    "A05020400": "INDOOR",
    "A05020700": "INDOOR",
    "A05020900": "INDOOR",
    "A05021000": "INDOOR",

    # --- B02 숙박시설 : 전부 실내형 ---
    "B02010100": "INDOOR",
    "B02010500": "INDOOR",
    "B02010600": "INDOOR",
    "B02010700": "INDOOR",
    "B02010900": "INDOOR",
    "B02011000": "INDOOR",
    "B02011100": "INDOOR",
    "B02011200": "INDOOR",
    "B02011300": "INDOOR",
    "B02011600": "INDOOR",

    # --- C01 추천코스 : 코스 성격에 따라 별도 처리(도보/힐링=URBAN, 캠핑=MOUNTAIN) ---
    "C01120001": "URBAN",      # 가족코스
    "C01130001": "URBAN",      # 나홀로코스
    "C01140001": "URBAN",      # 힐링코스
    "C01150001": "URBAN",      # 도보코스
    "C01160001": "MOUNTAIN",   # 캠핑코스
    "C01170001": "INDOOR",     # 맛코스 (식당 중심)
}

# 상위 4분류(FR-004 호환) 매핑
TYPE_TO_GROUP4 = {
    "BEACH":    "해변",
    "MOUNTAIN": "산",
    "WATER":    "산",       # 내륙수변은 '산' 그룹으로 합산 (부산은 내륙 하천/호수형 관광지가
                            # 8건뿐이라 실용적 영향이 적음. 비중이 커지면 score-algorithm.md에
                            # WATER 전용 가중치 프로필 추가를 논의할 것)
    "URBAN":    "도심",
    "INDOOR":   "실내",
}

TYPE_NAME_KR = {
    "BEACH": "해변형", "MOUNTAIN": "산자연형", "WATER": "내륙수변형",
    "URBAN": "도심야외문화형", "INDOOR": "실내형",
}

VALID_ENV_TYPES = set(TYPE_NAME_KR.keys())

# -------------------------------------------------------------------
# 2) 레포츠(contenttypeid=28) 수동 override
#    cat3 코드의 기본 배정만으로는 "위치 특성"을 알 수 없는 경우(트래킹/
#    캠핑 등은 해변·산·강 어디에도 있을 수 있음) 주소(addr1)를 보고
#    개별 확인한 결과. 여기서 나온 값도 반드시 위 5개 유형 중 하나다.
#    ※ 팀 내 최종 검토 필요 (로컬 지리 확인 권장)
# -------------------------------------------------------------------
LOCATION_OVERRIDE_BY_TITLE = {
    "광안리 SUP Zone": "BEACH",
    "광안리 해양레포츠센터": "BEACH",
    "구덕야영장": "MOUNTAIN",
    "구포무장애숲길": "MOUNTAIN",
    "남파랑길(부산)": "BEACH",
    "늘푸른숲": "MOUNTAIN",
    "대저캠핑장": "WATER",          # 낙동강 삼각주 인근
    "더무빙 카라반": "BEACH",        # 기장 해맞이로(해안도로)
    "레이저태그스포츠 광안점": "INDOOR",
    "문탠로드": "BEACH",            # 해운대 해안 산책로
    "미포정거장": "BEACH",          # 해운대 해안열차
    "부산광역시교육청학생인성교육원": "INDOOR",
    "부산항힐링야영장": "URBAN",     # 부산항 도심 인근
    "삼락수상레포츠타운": "WATER",   # 낙동강 삼락생태공원
    "송도 구름산책로": "BEACH",
    "송도해안볼레길": "BEACH",
    "아시아드 컨트리클럽": "MOUNTAIN",
    "영도관광실탄사격장": "INDOOR",
    "임랑카라반파크": "BEACH",       # 임랑해수욕장 인근
    "장안캠프": "MOUNTAIN",
    "제이스글램핑": "MOUNTAIN",
    "지오클럽": "BEACH",            # 기장해안로
    "초원숲속캠핑장": "MOUNTAIN",
    "함지골청소년수련관": "MOUNTAIN",  # 봉래산 자락
    "해안누리길 몰운대길": "BEACH",   # 몰운대
    "화명오토캠핑장": "WATER",       # 낙동강변
    "회동수원지 둘레길": "WATER",     # 회동수원지
    "[부산 갈맷길] 2코스 2구간": "BEACH",
    "[해파랑길] 2코스": "BEACH",
}


# -------------------------------------------------------------------
# 2.5) direct_water_contact : 사람이 물에 "직접" 닿을 수 있는 곳인지 여부
#      (회의에서 나온 수질 변수 검토용 플래그. env_type_code(WATER/BEACH)는
#      수질/자외선 등 리스크 가중치 "그룹" 기준이라 전망대·등대·둘레길처럼
#      물가이지만 접촉이 없는 곳까지 섞여 있고, 반대로 계곡(A01010900)은
#      산자연형으로 묶여 있어 WATER 필터만으로는 걸러지지 않는다.)
# -------------------------------------------------------------------
DIRECT_WATER_CONTACT_CAT3 = {
    "A01011200": True,   # 해수욕장
    "A01010900": True,   # 계곡 (하천형 계류, 도섭 가능)
    "A03010200": True,   # 수상레포츠
    "A03030100": True,   # 윈드서핑/제트스키
    "A03030200": True,   # 카약/카누
    "A03030400": True,   # 스노클링/스킨스쿠버다이빙
    "A03030500": True,   # 민물낚시
    "A03030700": True,   # 수영
    "A03030800": True,   # 래프팅
    "A01011700": True,   # 호수 (부산 데이터엔 현재 0건이지만 향후 ETL 갱신 대비 명시)
    "A01011800": True,   # 강
    "A01010800": True,   # 폭포 (낙수 웅덩이 등 도섭 가능, 현재 0건)
    "A01011000": True,   # 약수터 (음용/접촉 직접, 현재 0건)
    # A02050300(분수)는 의도적으로 미포함: 상수도(수돗물) 기반이라 조류경보/자연수질
    # 리스크(s_water)와 무관 -> URBAN 유지, direct_water_contact 미적용
}

# cat3 기본값만으로 못 거르는 경우(호수/강 코드가 실제로는 접근 제한
# 저수지이거나, 반대로 캠핑장/낚시처럼 접촉 여부가 시설명 확인이 필요한
# 경우)를 주소/현장 정보 기준으로 개별 보정.
DIRECT_WATER_CONTACT_OVERRIDE_BY_TITLE = {
    "회동수원지": True,          # 상수원보호구역이라 수영·낚시는 법적 금지지만 물가 접근 구간 있음
    "회동수원지 둘레길": False,   # 저수지 둘레길, 접촉 없음
    "낙동강하구 (부산 국가지질공원)": True,  # 하구 갯벌/물가 접촉 가능
    "대저캠핑장": True,          # 낙동강변 인접
    "화명오토캠핑장": True,       # 낙동강변 인접
    "해운대리버크루즈": False,    # 유람선, 배 위라 간접
    "자갈치 크루즈": False,       # 유람선, 배 위라 간접
    "용호동일대 바다낚시": True,  # 방파제/갯바위 낚시, 직접 접촉
}


def classify(df: pd.DataFrame) -> pd.DataFrame:
    """cat3 -> 환경유형(5) -> 그룹(4) 매핑을 df에 추가.
    레포츠(contenttypeid=28)는 title 기준 수동 override 우선 적용."""
    df = df.copy()
    df["cat3"] = df["cat3"].astype(str)

    df["env_type_code"] = df["cat3"].map(CAT3_TO_TYPE)
    unmatched = df["env_type_code"].isna()
    if unmatched.any():
        print(f"[경고] cat3 매핑 실패 {unmatched.sum()}건 -> URBAN으로 fallback")
        print(df.loc[unmatched, ["cat1", "cat2", "cat3"]].drop_duplicates())
        df.loc[unmatched, "env_type_code"] = "URBAN"

    # 레포츠 수동 override (주소 확인 기반, title 매칭)
    override_mask = df["title"].isin(LOCATION_OVERRIDE_BY_TITLE.keys())
    df.loc[override_mask, "env_type_code"] = df.loc[override_mask, "title"].map(LOCATION_OVERRIDE_BY_TITLE)

    # 안전장치: 매핑 테이블이나 override가 5개 유형 밖의 값을 만들어내면
    # (예: 실수로 되돌아온 SPORTS 같은 값) 조용히 넘어가지 않고 경고 후 URBAN으로 처리한다.
    invalid_mask = ~df["env_type_code"].isin(VALID_ENV_TYPES)
    if invalid_mask.any():
        print(f"[경고] 알 수 없는 env_type_code {invalid_mask.sum()}건 -> URBAN으로 fallback")
        print(df.loc[invalid_mask, ["cat3", "env_type_code"]].drop_duplicates())
        df.loc[invalid_mask, "env_type_code"] = "URBAN"

    df["env_type_name"] = df["env_type_code"].map(TYPE_NAME_KR)
    df["env_group4"] = df["env_type_code"].map(TYPE_TO_GROUP4)

    # water_quality_zone: 수질 관리가 필요한 범위(접촉 여부와 무관).
    # WATER/BEACH 유형 자체가 "수질(조류경보/이안류) 가중치가 지배적인 곳"이라는
    # 정의로 이미 만들어져 있으므로, 새로 수작업 리스트를 만들지 않고 여기서
    # 그대로 파생시킨다. direct_water_contact(물리적 직접 접촉, 더 좁은 범위)는
    # 이 집합의 부분집합이다.
    df["water_quality_zone"] = df["env_type_code"].isin(["WATER", "BEACH"])

    # 실내/실외 1차 분리 플래그
    df["is_outdoor"] = df["env_type_code"] != "INDOOR"

    # 환경 신호등 평가 대상 여부 (TARGET_CONTENTTYPES는 위에서 tour_contentTypeId.csv로부터 계산됨)
    df["is_env_target"] = df["contenttypeid"].isin(TARGET_CONTENTTYPES) & df["is_outdoor"]

    # direct_water_contact: cat3 기본값 -> title override 순으로 적용.
    # DIRECT_WATER_CONTACT_CAT3에 없는 cat3는 조용히 False로 깔지 않고,
    # 검토가 필요하다는 것을 알 수 있도록 경고를 찍는다(리스트에 없다는 것이
    # "접촉 없음 확정"이 아니라 "아직 검토 안 함"일 수 있기 때문).
    dwc_unreviewed = ~df["cat3"].isin(DIRECT_WATER_CONTACT_CAT3.keys())
    dwc_unreviewed &= ~df["title"].isin(DIRECT_WATER_CONTACT_OVERRIDE_BY_TITLE.keys())
    if dwc_unreviewed.any():
        print(f"[검토 필요] direct_water_contact 미검토 cat3 {df.loc[dwc_unreviewed, 'cat3'].nunique()}종 "
              f"({dwc_unreviewed.sum()}건) -> 기본값 False로 처리")
        print(df.loc[dwc_unreviewed, ["cat3", "title"]].drop_duplicates(subset=["cat3"]))

    df["direct_water_contact"] = df["cat3"].map(DIRECT_WATER_CONTACT_CAT3).fillna(False).astype(bool)
    dwc_override_mask = df["title"].isin(DIRECT_WATER_CONTACT_OVERRIDE_BY_TITLE.keys())
    df.loc[dwc_override_mask, "direct_water_contact"] = df.loc[dwc_override_mask, "title"].map(
        DIRECT_WATER_CONTACT_OVERRIDE_BY_TITLE
    )

    return df
