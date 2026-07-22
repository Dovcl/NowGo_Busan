# NowGo Busan — Frontend

Vite + React 19 + Tailwind CSS 3 + react-router-dom.

## 실행

```bash
npm install
npm run dev
```

## 지금 상태

백엔드(`/api/score`)는 아직 없고, 화면에 보이는 데이터는 전부 mock입니다.

| 경로 | 페이지 |
| --- | --- |
| `/` | [Home](src/pages/Home.jsx) — 히어로 검색 + 날씨/대기질/자외선/이안류 카드 + TOP10 |
| `/map` | [MapView](src/pages/MapView.jsx) — 필터 사이드바 + 지도 마커 |
| `/dashboard` | [PulseDashboard](src/pages/PulseDashboard.jsx) — 지역별 방문자 현황 |
| `/place/:placeId` | [PlaceDetail](src/pages/PlaceDetail.jsx) — NowGo Score 상세 + AI 예측 + 대체 관광지 |
| `/recommend`, `/profile` | [ComingSoon](src/pages/ComingSoon.jsx) / [Profile](src/pages/Profile.jsx) — 탭 플레이스홀더·프로필 |

공통 상단바(`TopNavBar`)/하단 탭바(`BottomNavBar`)는 [AppLayout](src/layouts/AppLayout.jsx) 하나로 묶여 있고, 탭은 Home / Map / Recommend / Dashboard / Profile 5개입니다. Tailwind 색상·폰트·spacing 토큰은 [tailwind.config.js](tailwind.config.js)에 정의되어 있습니다.

## Mock 모드 → 실제 API 전환 방법

데이터는 컴포넌트에 하드코딩하지 않고 두 레이어로 분리해 두었습니다.

- [src/mock/places.js](src/mock/places.js) — 목업 데이터 (TOP10 리스트, 날씨/대기질 요약, 지도 마커, 구별 Pulse 대시보드 등)
- [src/services/scoreService.js](src/services/scoreService.js) — 페이지들이 실제로 호출하는 함수. 내부에서 `MOCK_MODE`에 따라 mock 데이터를 리턴하거나 실제 API를 fetch 함

```js
const MOCK_MODE = import.meta.env.VITE_MOCK_MODE !== "false" // 기본값 true

export async function fetchPlaceById(id) {
  if (MOCK_MODE) return topPlaces.find((p) => p.id === id) ?? null
  const res = await fetch(`/api/score/${id}`)
  return res.json()
}
```

백엔드 `/api/score`가 준비되면:

1. 프론트 루트에 `.env` (또는 `.env.local`)를 만들고 `VITE_MOCK_MODE=false` 추가 (`.env.example` 참고)
2. `src/services/scoreService.js`의 각 함수에서 `MOCK_MODE`가 false일 때 타는 `fetch(...)` 부분만 실제 엔드포인트/응답 스키마에 맞게 다듬기
3. 페이지 컴포넌트(`Home.jsx`, `MapView.jsx`, `PulseDashboard.jsx`, `PlaceDetail.jsx`)는 건드릴 필요 없음 — 전부 `services/scoreService.js`를 통해서만 데이터를 가져오기 때문

즉 **mock ↔ 실제 API 전환은 `scoreService.js` 한 파일 + 환경변수 하나로 끝나게** 설계해 두었습니다. NowGo Score 응답 스키마를 임의로 변경하지 않는다는 원칙에 맞춰, mock 데이터도 `/api/score`가 리턴할 것으로 예상되는 필드 구조(`score`, `status`, `breakdown`, `forecast24h` 등)를 흉내 내 두었으니 백엔드 스키마가 확정되면 그 모양대로 맞추면 됩니다.

## 알아두면 좋은 것

- 신호등 색은 `semantic-safe` / `caution` / `danger` 3색(안전=초록, 주의=주황, 위험=빨강)으로 통일되어 있습니다.
- 지도 마커는 1번(해운대)·5번(광안리)만 이름표가 있고 클릭하면 상세 페이지로 이동합니다. 나머지 번호는 장식용 핀입니다.
- TOP10 일부 장소의 세부 점수는 placeholder입니다. 실제 값이 나오면 `src/mock/places.js`의 `breakdown` 필드만 바꾸면 됩니다.
