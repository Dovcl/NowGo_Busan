// 축제·행사 카테고리 색상 정의 + 공지 배너 mock. 실제 행사 목록은 harness/DECISIONS.md
// Phase 0~3에서 백엔드 event_raw -> events 파이프라인이 완성돼 services/eventsService.js가
// 항상 실제 /api/events를 호출한다 — 그래서 이 파일엔 행사 mock 데이터 자체는 없다.

// 카테고리 색상은 새로 만들지 않고 기존 M3 토큰(primary/secondary/tertiary)과
// PulseDashboard에서 이미 쓰던 chart-3/5(=amber/purple)를 재사용해 앱 전체 색 의미를 통일했다.
// exhibition에는 참고 목업이 쓴 error(빨강) 대신 primary를 썼다 — 빨강은 이 앱에서
// NowGo Score "위험"으로 이미 의미가 고정돼 있어 겹치면 안 되기 때문.
// 라벨은 여기 두지 않고 t(`eventCategory.${key}`, {ns: "recommend"})로 조회한다.
export const EVENT_CATEGORIES = {
  festival: {
    dot: "bg-secondary",
    text: "text-secondary",
    chipActive: "bg-secondary text-on-secondary",
    barBg: "bg-secondary",
    barText: "text-on-secondary",
    badgeBg: "bg-secondary",
    badgeText: "text-on-secondary",
  },
  performance: {
    dot: "bg-tertiary-container",
    text: "text-tertiary",
    chipActive: "bg-tertiary text-on-tertiary",
    barBg: "bg-tertiary-container",
    barText: "text-on-tertiary-container",
    badgeBg: "bg-tertiary",
    badgeText: "text-on-tertiary",
  },
  exhibition: {
    dot: "bg-primary",
    text: "text-primary",
    chipActive: "bg-primary text-on-primary",
    barBg: "bg-primary",
    barText: "text-on-primary",
    badgeBg: "bg-primary",
    badgeText: "text-on-primary",
  },
  sports: {
    dot: "bg-chart-5",
    text: "text-chart-5",
    chipActive: "bg-chart-5 text-white",
    barBg: "bg-chart-5",
    barText: "text-white",
    badgeBg: "bg-chart-5",
    badgeText: "text-white",
  },
  market: {
    dot: "bg-chart-3",
    text: "text-chart-3",
    chipActive: "bg-chart-3 text-white",
    barBg: "bg-chart-3",
    barText: "text-white",
    badgeBg: "bg-chart-3",
    badgeText: "text-white",
  },
  // 사용자가 캘린더에서 직접 만든 개인 일정용 — 공식 행사와 구분되게 중립 톤.
  personal: {
    dot: "bg-outline",
    text: "text-outline",
    chipActive: "bg-outline text-white",
    barBg: "bg-surface-container-highest",
    barText: "text-on-surface",
    badgeBg: "bg-surface-container-highest",
    badgeText: "text-on-surface",
  },
}

// 리스트 화면 상단 공지 배너용.
export const announcements = [
  {
    id: "biff-ticket",
    eventId: "biff-2026",
    title: "부산국제영화제 티켓 예매 안내",
    body: "7월 1일 오전 10시부터 공식 홈페이지에서 예매가 시작돼요.",
  },
]
