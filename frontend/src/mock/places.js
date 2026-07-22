// Mock data for the local UI demo.
// Shape mirrors the expected `/api/score` response so swapping the
// `src/services/scoreService.js` MOCK_MODE branch for a real fetch later
// requires no changes here or in the page components.

export const topPlaces = [
  {
    id: "taejongdae",
    rank: 1,
    name: "태종대",
    category: "자연 · 전망",
    score: 92,
    status: "safe",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDKVPUitIqBbUh54zj7LBdza91zXoL_iAZ6KkwEYyXKqTMesLgfjjxs5a4aV3aoGUDySx0oE8fBk5cWuKxVpiFH8mMzyKI8_H-bGtYk6XLxhRxeGeTr2ftchO8rOblxhojI7ycQUlByDSP0ur9mtRa2xsn4rlouhbAUqNrTy6q00HUOHvV3PxiAARHtmG_vBkoVmi23RP_hxuKDCg2aQHAcb8ld1Nshr60-lS-oQjUDguhYpkjaFVuQ",
    breakdown: { air: 90, weather: 92, uv: 80, ripCurrentOrWater: 96, crowd: 88 },
  },
  {
    id: "gamcheon",
    rank: 2,
    name: "감천문화마을",
    category: "문화 · 체험",
    score: 88,
    status: "safe",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuBwLYSpINcRiqiZVcIZHtgKrhUN5jAiOsR-fBdX9Y1wXcWXGONXx_KcHDFzI_UIzL8qMg10lyFIoFuHiIu5W8ZZrwc1ltirLwFY8gB_genmOj1qGIE66l2rF14cneFSw-Og6kSvQb9oXLs4O8q0DxDcterL-NtK7waSCQaRNL0gnPmJRUGGkhosjPIJDxQuWdh-fP8dbHj6mAiaNotAmr5H8p-aafjZHVCQZOh3711nBYdTckIJk0qL",
    breakdown: { air: 88, weather: 90, uv: 82, ripCurrentOrWater: 91, crowd: 78 },
  },
  {
    id: "songdo",
    rank: 3,
    name: "송도해수욕장",
    category: "해변 · 산책",
    score: 82,
    status: "safe",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB6a6EMO3D2rXUMKBcrmmSeR-sjOOIlug8bPCp76BUAbvOw0PzZ0gkcZOXk6477ScPTJ9S8DSGlI34xw5sIjFY2ibg--e-qiHAhVrS4Wq244ANAVBhfnkRHFQDi5zuhzKYm2RR9-Q0lTmCFxuaem319g9krWzMzBChLVGgGdB6U5L_NAGkKVX0b3ttxucQApn1H8iiQoLJorNENxRn-VhHTHVwopoakboQM4nx9xFYP2zakIDDZmrHV",
    breakdown: { air: 84, weather: 87, uv: 75, ripCurrentOrWater: 88, crowd: 74 },
  },
  {
    id: "gwangalli",
    rank: 4,
    name: "광안리해수욕장",
    category: "해변 · 야경",
    score: 92,
    status: "safe",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuDX8ALYPSeR3UvCxSHaLSfiJiG2g9GapBrX1oOkpIdiuAuiXGtqJ2MksN-vYmxCXQKPyc-nXf0Q-gsXfkp8pPRVYw__-QPNC86OqrK0PvskdsS3P1QZUgFL9Vy-MrWrXZ8VfQhlbyLoVFcFhaqUchoKPBKnsuVk9aVPfXLR2SX4b7reyxjA-mvcu5XhHKOZ39L6QJ_xuAdNsDi-kLfsLA1T5whd8gL206L5lE8DLi0runFCxNmwC6vu",
    breakdown: { air: 85, weather: 90, uv: 70, ripCurrentOrWater: 95, crowd: 65 },
    forecast24h: [
      { label: "현재", hours: 0, score: 92, status: "safe" },
      { label: "6시간 후", hours: 6, score: 88, status: "safe" },
      { label: "12시간 후", hours: 12, score: 76, status: "caution" },
      { label: "24시간 후", hours: 24, score: 48, status: "danger" },
    ],
    forecastReasons: [
      "24시간 후 강수 확률 상승 (70%)",
      "풍속 증가 예상 (3~5m/s → 8m/s)",
      "이안류 위험 단계 상승 예상",
      "PM2.5 소폭 증가 예상",
    ],
    alternatives: [
      {
        id: "aquarium",
        name: "부산아쿠아리움",
        score: 88,
        status: "safe",
        category: "실내 · 체험",
        distance: "12분 (3.2km)",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuAdO8udTND3GsE4hYu4N3UZqQFHIfXb-OWVlyip0tLBTnjEh01QNcPN0R9HrK5XoPV8Jm4CPVPl-xM0hlWjMAXNtKMz4fnz3YNExrW26f0HcJqxiA95p6aK-Ooz0h5__HuS8pZEbPluf63AlnvVyOV1VHqWGKHvbMgUF58VnyUmI3umyHHdhZizzBxbk7-zIk8T6JHs61Aq7rvK7aHiM-rhUk-F7OybWGycfBojNJcNh9hxxsOQZnVj",
      },
      {
        id: "cinema-center",
        name: "영화의전당",
        score: 82,
        status: "safe",
        category: "문화 · 전시",
        distance: "15분 (4.1km)",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuCWeJMmEo5Ny2C6atvIlALE_pREWaHWcjKWL6bKR7Dw3RiMgRllxbMI15RtsgVvrhY9hvi9BvXfvwtV94Xmjsy-gMt6FaNe6CDk4z5WER8PgEtEFAUrxOdS-53rbaAmYitUxFZBNYkDZo60akyrqcfX5mJx7fYx4UFtYctNz8ZlQyK1sxjkhQUVeuBrp3cTfvONfnLVRHasplYA70N9znm2Duq7XPTJAURKq2DEA9-PASvgledJJN7y",
      },
      {
        id: "shinsegae-centumcity",
        name: "신세계 센텀시티",
        score: 80,
        status: "caution",
        category: "쇼핑 · 실내",
        distance: "18분 (4.8km)",
        image:
          "https://lh3.googleusercontent.com/aida-public/AB6AXuC3dKpQecc4PutF7x0mqX359WvyypddC-0PHOy6IUeZkHwLUdo-dTlw0Uwfz1PibamILmb-csjCVc1TN3UdbS9KHPP2RJ1zbfq2KO_Q3K065snBatoa_VfHHc-gsquBYHqWSk7QShsKIjGvt8UXdRXNlvJcRnJMpAxqjRJzC4nocsBxvZNJld8Yav6LPj4CaQ5PJyzQLQMFwAJrIsiSG6du0Epq3xvac2a0tW04s22lSRO78VCLtgQ8",
      },
    ],
  },
  {
    id: "haeundae",
    rank: 5,
    name: "해운대해수욕장",
    category: "전망 · 도심",
    score: 68,
    status: "caution",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuD6O6w4axO4zSZFKq25c_POCjwtCtoBd9EmtDWZzrlcMsspV1uQNpuGiqY_cP229yziPo3jOlZFkk93yCiUs1f_tIt2y6tePRsoTEIi3xSw-OnTaiFqNYD0yTptZ2cGLkeMX6mkEUNV-cuWsZ0N3hCtfbz39EmMLx9Hbhc8xVhwzmvA7V9JZ0CFlpis8nXE6wlqHzrqDwAAn_HMhmig3vW7i0CHvexSOHuT_qlWEGsCn9mw1ANjW-iE",
    breakdown: { air: 70, weather: 74, uv: 60, ripCurrentOrWater: 72, crowd: 55 },
  },
]

export const currentWeather = {
  tempC: 27,
  condition: "맑음",
  feelsLikeC: 29,
  windMs: 2.1,
  humidityPct: 60,
  rainChancePct: 10,
}

export const airQuality = { level: "좋음", pm25: 18, pm10: 32, o3: 0.021 }
export const uvIndex = { level: "보통", uv: 4 }
export const ripCurrentRisk = { area: "해운대", level: "안전" }
export const crowdLevel = {
  area: "수영구",
  level: "혼잡",
  foreign: 9870,
  domestic: 12450,
}

// Only markers 1 (해운대) and 5 (광안리) carry a name/tooltip in the source
// mockup — the rest are left as plain numbered pins, same as the design.
export const mapMarkers = [
  { id: 1, placeId: "haeundae", name: "해운대해수욕장", status: "safe", top: "35%", left: "65%" },
  { id: 2, placeId: null, status: "safe", top: "25%", left: "55%" },
  { id: 3, placeId: null, status: "safe", top: "30%", left: "70%" },
  { id: 5, placeId: "gwangalli", name: "광안리해수욕장", status: "caution", top: "40%", left: "60%" },
  { id: 7, placeId: null, status: "caution", top: "50%", left: "58%" },
  { id: 8, placeId: null, status: "danger", top: "45%", left: "45%" },
  { id: 10, placeId: null, status: "danger", top: "48%", left: "68%" },
]

export const districts = [
  "전체 부산",
  "해운대구",
  "수영구",
  "남구",
  "동구",
  "부산진구",
  "중구",
  "서구",
  "사하구",
  "사상구",
]

export const pulseDashboard = {
  수영구: {
    district: "수영구",
    updatedLabel: "최근 1시간 기준",
    kpis: {
      foreign: { count: 9870, deltaPct: 21 },
      domestic: { count: 12450, deltaPct: 8 },
      total: { count: 22320, deltaPct: 14 },
    },
    nationalityShare: [
      { label: "중국", pct: 32, color: "#4F46E5" },
      { label: "일본", pct: 21, color: "#3B82F6" },
      { label: "미국", pct: 17, color: "#10B981" },
      { label: "대만", pct: 12, color: "#F59E0B" },
      { label: "기타", pct: 18, color: "#E5E7EB" },
    ],
    districtForeignVisitors: [
      { label: "해운대구", count: 15420, widthPct: 100 },
      { label: "수영구", count: 9870, widthPct: 65, highlight: true },
      { label: "남구", count: 7210, widthPct: 45 },
      { label: "부산진구", count: 5800, widthPct: 35 },
    ],
  },
}
