# NowGo Busan (지금갈래? 부산)

부산 16개 구·군 관광지를 **실시간 환경·안전 신호등(NowGo Score)** 으로 보여주는 PWA입니다.  
대기·수질·기상·UV·혼잡도를 합쳐 `green / yellow / red`로 한눈에 판단할 수 있게 합니다.

> 현재 상태: 저장소·환경설정·API 탐색 단계. 앱 스캐폴딩(프론트/백엔드 코드)은 이제부터 진행합니다.

---

## 목차

1. [서비스 한눈에 보기](#1-서비스-한눈에-보기)
2. [기술 스택](#2-기술-스택)
3. [디렉터리 구조](#3-디렉터리-구조)
4. [NowGo Score 개요](#4-nowgo-score-개요)
5. [외부 API](#5-외부-api)
6. [개발 로드맵](#6-개발-로드맵)
7. [로컬 개발 환경](#7-로컬-개발-환경)
8. [개발 규칙](#8-개발-규칙)
9. [체크리스트](#9-체크리스트)

---

## 1. 서비스 한눈에 보기

| 항목 | 내용 |
|---|---|
| 형태 | Progressive Web App (모바일 우선) |
| 핵심 UX | 카카오맵 위 관광지 클러스터 + 신호등 색상 |
| 핵심 지표 | NowGo Score (0~1) → green / yellow / red |
| 데이터 범위 | 부산광역시 (`TourAPI areaCode=6`) |
| 백엔드 역할 | 공공 API ETL, 공간 조인, 점수 계산, `/api/score` 제공 |
| 프론트 역할 | 지도·신호등 UI, PWA. **점수 계산은 프론트에서 하지 않음** |

---

## 2. 기술 스택

### Frontend
- React + Vite
- 카카오맵 JavaScript SDK
- Vite PWA Plugin (`vite-plugin-pwa`)
- (예정) i18next — 한·영·중·일

### Backend
- Python **3.11.x** (권장 3.11.4)
- FastAPI
- PostGIS (관광지·측정소 공간 쿼리)
- Redis (API 응답 캐시·쿼터 관리)

### 인프라 / 운영 개념
- `MOCK_MODE=true` → 실제 외부 API 호출 없이 `backend/mock/` 데이터로 UI·로직 개발
- ETL cron → TourAPI·환경 API를 주기적으로 적재·캐시
- 서버 사이드에만 REST API 키 보관 (프론트에는 `KAKAO_JS_API_KEY`만)

---

## 3. 디렉터리 구조

목표 구조입니다. 아직 비어 있는 폴더는 로드맵 진행에 따라 채워집니다.

```
NowGo_Busan/
├── frontend/                 # React + Vite PWA
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   ├── hooks/            # useKakaoMap 등
│   │   ├── i18n/             # 다국어 (P1)
│   │   └── utils/
│   └── public/
├── backend/                  # Python FastAPI
│   ├── api/                  # 라우터 (/api/score 등)
│   ├── core/                 # NowGo Score 알고리즘
│   ├── db/                   # PostGIS 쿼리 (공간 조인은 여기만)
│   ├── etl/                  # 공공 API ETL
│   ├── ml/                   # 예측 모델 (P1~)
│   ├── mock/                 # MOCK_MODE용 더미 JSON
│   ├── cache/                # Redis TTL·쿼터 로직
│   ├── .env                  # 실제 키 (커밋 금지)
│   └── .env.example          # 키 이름만 커밋
├── notebooks/                # API 탐색용 (gitignore)
├── README.md
└── .gitignore
```

---

## 4. NowGo Score 개요

### 5축

| 축 | 변수 | 주요 소스 |
|---|---|---|
| 대기 | `s_air` | 에어코리아 PM10·PM2.5·O₃ |
| 수질·이안류 | `s_water` | 이안류 API + 환경부 수질 DB |
| 기상 | `s_weather` | 기상청 단기예보 |
| UV | `s_uv` | 기상청 생활기상지수 |
| 혼잡 | `s_crowd` | 관광빅데이터 (KT/SKT 펄스) |

관광지 유형(해변·산·도심·실내)마다 가중치가 달라지고, 합산 점수로 신호등을 판정합니다.

| 점수 | 신호 |
|---|---|
| `score ≥ 0.7` | green |
| `0.4 ≤ score < 0.7` | yellow |
| `score < 0.4` | red |

### `/api/score` 응답 스키마 (고정)

프론트·백엔드 계약입니다. **필드를 임의로 바꾸지 않습니다.**

```json
{
  "spot_id": "string",
  "name": "string",
  "signal": "green | yellow | red",
  "score": 0.0,
  "breakdown": {
    "s_air": 0.0,
    "s_water": 0.0,
    "s_weather": 0.0,
    "s_uv": 0.0,
    "s_crowd": 0.0
  },
  "updated_at": "ISO8601"
}
```

### 처리 파이프라인 (요약)

1. **ETL** — TourAPI로 부산 관광지 동기화 → PostGIS 적재  
2. **공간 조인** — 관광지 좌표 기준 최근접 측정소 등으로 환경값 추정  
3. **부분 점수** — 5축 각각 0~1 정규화  
4. **유형별 가중 합산** → 신호등 판정  
5. **캐시** — Redis TTL로 외부 API 호출 최소화  

점수 계산 구현 위치: `backend/core/`  
공간 쿼리: `backend/db/` 만  

---

## 5. 외부 API

키 값은 커밋하지 않습니다. 이름은 루트/백엔드 `.env.example`을 기준으로 합니다.

| 용도 | 환경변수 | 비고 |
|---|---|---|
| 한국관광공사 국문 관광정보 | `TOUR_API_KEY` | `areaCode=6` (부산) |
| 관광빅데이터 (외국인·내국인 펄스) | `TOURDATA_API_KEY` | 구 단위까지 |
| 에어코리아 대기오염 | `AIR_KOREA_API_KEY` | 부산 측정소 |
| 기상청 단기예보 / 생활기상지수 | `WEATHER_API_KEY` | 기상·UV |
| 이안류 | `OCEAN_API_KEY` | 1~4단계 |
| 수질 DB | `WATER_QUALITY_API_KEY` | 조류경보 등 |
| 카카오 REST (로컬·Directions) | `KAKAO_REST_API_KEY` | **서버만** |
| 카카오맵 JS | `KAKAO_JS_API_KEY` | 프론트, **도메인 제한 필수** |
| 카카오 OAuth | `KAKAO_CLIENT_ID` / `SECRET` | 로그인 (필요 시) |

### 캐시 TTL (목표)

| 소스 | Redis TTL |
|---|---|
| 에어코리아 | 3시간 |
| TourAPI | 24시간 |
| 이안류 | 1시간 |
| 관광빅데이터 | 1시간 |

### 쿼터 유의

- 에어코리아는 일일 호출 한도가 있으므로 ETL·캐시로 압축합니다.
- TourAPI는 `areaBasedSyncList2` 등으로 일 1회 일괄 동기화를 우선합니다.
- 카카오 Directions는 P1(대체 동선)에서, 적색 등 필요할 때만 호출합니다.

---

## 6. 개발 로드맵

### Phase 0 — 기반 잡기 (현재)

목표: API·스키마를 이해하고, 키·환경을 안전하게 고정한 뒤 스캐폴딩을 시작한다.

| 순서 | 작업 | 산출물 |
|---|---|---|
| 0-1 | 공공 API 응답 구조 탐색 (노트북) | 필드 목록·샘플 요약 (키/원본 JSON은 커밋하지 않음) |
| 0-2 | `backend` FastAPI 스캐폴딩 | `main.py`, `/health`, 설정 로더 |
| 0-3 | `frontend` Vite+React+PWA 스캐폴딩 | 빈 셸 + 라우팅 |
| 0-4 | `.env.example` 정리·동기화 | 루트/백엔드/프론트 키 이름 일치 |
| 0-5 | `MOCK_MODE` + `backend/mock/` 최소 샘플 | `/api/score` mock 응답 |

**완료 기준:** mock으로 `/api/score`를 호출하면 스키마에 맞는 JSON이 나오고, 프론트에서 표시할 수 있다.

---

### Phase 1 — P0 (MVP)

목표: “지금 갈래?”를 지도 + 신호등으로 보여줄 수 있는 최소 제품.

| 우선순위 | 기능 | 영역 |
|---|---|---|
| P0-1 | TourAPI 부산 관광지 ETL → PostGIS | `backend/etl/`, `backend/db/` |
| P0-2 | NowGo Score 코어 + `/api/score` | `backend/core/`, `backend/api/` |
| P0-3 | 에어코리아·기상·UV·이안류·펄스 ETL (또는 mock 병행) | `backend/etl/`, `backend/cache/` |
| P0-4 | 신호등 TOP 10 / 목록 UI | `frontend/` |
| P0-5 | 카카오맵 + 마커 클러스터링 | `frontend/` hooks·components |
| P0-6 | 외국인·내국인 펄스 반영 (`s_crowd`) | backend → score breakdown |

**완료 기준:** 부산 주요 관광지 N곳이 지도에 신호등 색으로 보이고, 상세에서 5축 breakdown을 볼 수 있다.  
실연 전에도 `MOCK_MODE=true`로 데모 가능해야 한다.

---

### Phase 2 — P1

| 기능 | 설명 |
|---|---|
| 대체 동선 재라우팅 | 적색 시 카카오 Directions로 대체지 ETA |
| 24h 예측 ML | `backend/ml/` — 단기 점수 예측 |
| 다국어 UI | 한·영·중·일 (`frontend/src/i18n/`) |

---

### Phase 3 — P2

| 기능 | 설명 |
|---|---|
| 코스 플래너 | 신호등 기반 당일 코스 추천 |
| 푸시 알림 | 관심 관광지 신호 변화 |
| 오프라인 퍼스트 | PWA 캐시 강화 |
| 앙상블 ML | 예측 모델 고도화 |

---

### 권장 진행 순서 (실무 단위)

```text
API 탐색 (notebooks)
    → mock /api/score
        → FastAPI + PostGIS 스키마
            → TourAPI ETL
                → 환경 API ETL + Redis
                    → Score 코어
                        → React 지도·신호등 UI
                            → P0 통합 데모
                                → P1 / P2
```

한 번에 실API·점수·지도를 다 붙이지 말고, **mock으로 UI 계약을 먼저 고정**하는 것을 권장합니다.

---

## 7. 로컬 개발 환경

### 사전 요구

- Python **3.11.x** (Anaconda `base`의 3.12와 섞이지 않게 주의)
- Node.js (LTS 권장)
- (선택) PostgreSQL + PostGIS, Redis — Phase 1부터 본격 사용

### Backend

```bash
cd backend

# conda base가 켜져 있으면
# conda deactivate

python3.11 -m venv venv
source venv/bin/activate          # Windows: venv\Scripts\activate

python --version                  # Python 3.11.x 확인
which python                      # .../NowGo_Busan/backend/venv/bin/python

cp .env.example .env              # 키 입력
# MOCK_MODE=true 로 시작 권장

# (스캐폴딩 이후)
# pip install -r requirements.txt
# uvicorn ...
```

### Frontend

```bash
cd frontend
cp .env.example .env              # VITE_KAKAO_JS_API_KEY 등
# npm install
# npm run dev
```

### 환경변수 주의

- `.env`는 git에 올리지 않습니다.
- 프론트엔드에는 **카카오 JS 키만**. 그 외 공공 API 키는 백엔드만.
- 카카오 JS 키는 개발자 콘솔에서 **도메인 제한**을 겁니다.

### API 탐색용 노트북

```text
notebooks/          # gitignore 대상
```

연습·응답 확인은 여기서 하고, 서비스에 넣을 코드는 `backend/etl/`·`backend/api/`로 옮깁니다.

---

## 8. 개발 규칙

1. **UI 작업**은 `frontend/`만 수정. 점수 로직을 프론트에 넣지 않는다.  
2. **NowGo Score**는 `backend/core/`에서만 계산. `/api/score` 스키마를 임의 변경하지 않는다.  
3. **PostGIS SQL**은 `backend/db/`에서만 작성. 사용자 입력은 파라미터 바인딩.  
4. **외부 API 호출**은 `backend/etl/` 또는 `backend/api/`에서만.  
5. **`MOCK_MODE=true`일 때** 실제 외부 API를 호출하지 않는다.  
6. **시크릿** — `.env`, 노트북 출력, 커밋 메시지에 키를 남기지 않는다.  
7. **한 작업 = 한 목적** — 가능하면 파일·PR 범위를 작게 유지한다.

---

## 9. 체크리스트

### 시작 전
- [ ] `backend/venv`가 Python 3.11.x인가? (`python --version`)
- [ ] Anaconda `(base)`와 venv가 섞여 `3.12`가 잡히지 않는가?
- [ ] `.env`가 있고 `.gitignore`에 `.env`가 있는가?

### Phase 0
- [ ] TourAPI 등 주요 응답 필드 파악
- [ ] FastAPI / Vite 스캐폴딩
- [ ] mock `/api/score` 스키마 일치

### P0
- [ ] TourAPI → DB 적재
- [ ] Score + 신호등 API
- [ ] 지도 클러스터 + TOP/목록 UI
- [ ] Redis TTL·쿼터 로깅 (실연 전)

### 보안 / 쿼터
- [ ] 프론트에 서버용 API 키 없음
- [ ] 카카오 JS 키 도메인 제한
- [ ] `MOCK_MODE`에서 실API 미호출

---

## 라이선스 / 데이터 고지

사용하는 공공·민간 API는 각 제공 기관의 이용약관·호출 한도를 따릅니다.  
개인 식별이 가능한 형태가 아닌 **집계 데이터(관광 펄스 등)** 만 사용합니다.
