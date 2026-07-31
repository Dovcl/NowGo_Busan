// Mock data for the local UI demo.
// Shape mirrors the expected `/api/score` response so swapping the
// `src/services/scoreService.js` MOCK_MODE branch for a real fetch later
// requires no changes here or in the page components.

// id는 실제 tour_spot.contentid(숫자 문자열)를 그대로 쓴다 — PlaceDetail이 이 id로
// mock을 먼저 찾고(큐레이션된 score/tips 등), 못 찾으면 실제 백엔드(/api/places/{id})로
// 폴백한다. 그래서 여기 없는 실제 관광지를 클릭해도 정상 동작한다.
// info(이용시간/휴무일/주차)는 backend/etl/seed_tour_spot_intro.py로 시딩된 실제
// tour_spot_intro 값을 그대로 옮겨적었고, score/breakdown/tips/nearbyFood/forecast24h/
// alternatives는 NowGo Score 알고리즘이 없어 여전히 임의 큐레이션이다.
export const topPlaces = [
  {
    id: "126028",
    rank: 1,
    name: "금정산",
    category: "자연 · 전망",
    score: 92,
    status: "safe",
    image: "http://tong.visitkorea.or.kr/cms/resource/44/3575744_image2_1.jpg",
    breakdown: { air: 90, weather: 92, uv: 80, ripCurrentOrWater: 96, crowd: 88 },
    envTag: "실외 관광지",
    info: {
      usetime: "상시 개방",
      restdate: "연중무휴",
      parking: "가능",
    },
    tips: [
      {
        icon: "directions_walk",
        label: "Best Course",
        text: "금강공원 케이블카를 타고 올라가면 체력 부담 없이 고당봉 전망대까지 오를 수 있습니다.",
      },
      {
        icon: "photo_camera",
        label: "Photography Spot",
        text: "동문 성곽길에서 내려다보는 부산 시가지와 낙동강 전경이 가장 인상적입니다.",
      },
    ],
    nearbyFood: [
      { name: "금정산성 막걸리 마을", distance: "도보 10분 · 700m", image: null },
      { name: "산성마을 흑염소불고기", distance: "도보 12분 · 900m", image: null },
      { name: "범어사 사하촌 두부요리", distance: "차량 10분 · 3.2km", image: null },
    ],
    forecast24h: [
      { label: "현재", hours: 0, score: 92, status: "safe" },
      { label: "6h", hours: 6, score: 90, status: "safe" },
      { label: "12h", hours: 12, score: 85, status: "safe" },
      { label: "24h", hours: 24, score: 80, status: "safe" },
    ],
    alternatives: [
      { id: "beomeosa", name: "범어사", score: 85, status: "safe" },
      { id: "busan-citizens-park", name: "부산시민공원", score: 83, status: "safe" },
    ],
  },
  {
    id: "1957694",
    rank: 2,
    name: "용두산 자갈치 관광특구",
    category: "문화 · 체험",
    score: 88,
    status: "safe",
    image: "http://tong.visitkorea.or.kr/cms/resource/46/3049246_image2_1.JPG",
    breakdown: { air: 88, weather: 90, uv: 82, ripCurrentOrWater: 91, crowd: 78 },
    envTag: "실외 관광지",
    info: {
      usetime: "상시 개방",
      restdate: "연중무휴",
      parking: "가능",
    },
    tips: [
      {
        icon: "route",
        label: "Best Course",
        text: "용두산공원 부산타워부터 시작해서 국제시장, 보수동 책방골목까지 도보로 이어 걷기 좋습니다.",
      },
      {
        icon: "photo_camera",
        label: "Photography Spot",
        text: "자갈치시장 옥상 전망대에서 보는 부산항 전경이 가장 특별합니다.",
      },
    ],
    nearbyFood: [
      { name: "자갈치시장 회센터", distance: "도보 3분 · 200m", image: null },
      { name: "40계단 문화관 카페", distance: "도보 6분 · 450m", image: null },
      { name: "국제시장 씨앗호떡", distance: "도보 5분 · 350m", image: null },
    ],
    forecast24h: [
      { label: "현재", hours: 0, score: 88, status: "safe" },
      { label: "6h", hours: 6, score: 86, status: "safe" },
      { label: "12h", hours: 12, score: 80, status: "safe" },
      { label: "24h", hours: 24, score: 75, status: "caution" },
    ],
    alternatives: [
      { id: "busan-modern-history-museum", name: "부산근대역사관", score: 84, status: "safe" },
      { id: "bosu-book-street", name: "보수동 책방골목", score: 82, status: "safe" },
    ],
  },
  {
    id: "126122",
    rank: 3,
    name: "부산 송도해수욕장",
    category: "해변 · 산책",
    score: 82,
    status: "safe",
    image:
      "https://lh3.googleusercontent.com/aida-public/AB6AXuB6a6EMO3D2rXUMKBcrmmSeR-sjOOIlug8bPCp76BUAbvOw0PzZ0gkcZOXk6477ScPTJ9S8DSGlI34xw5sIjFY2ibg--e-qiHAhVrS4Wq244ANAVBhfnkRHFQDi5zuhzKYm2RR9-Q0lTmCFxuaem319g9krWzMzBChLVGgGdB6U5L_NAGkKVX0b3ttxucQApn1H8iiQoLJorNENxRn-VhHTHVwopoakboQM4nx9xFYP2zakIDDZmrHV",
    breakdown: { air: 84, weather: 87, uv: 75, ripCurrentOrWater: 88, crowd: 74 },
    envTag: "실외 관광지",
    info: {
      usetime: "06:00~23:00",
      restdate: "연중무휴",
      parking: "가능",
    },
    tips: [
      {
        icon: "directions_walk",
        label: "Best Course",
        text: "송도구름산책로와 연결되니 해변 산책 후 스카이워크까지 걸어보는 걸 추천합니다.",
      },
      {
        icon: "photo_camera",
        label: "Photography Spot",
        text: "송도 해상케이블카에서 내려다보는 암남공원과 해변 전경이 가장 인상적입니다.",
      },
    ],
    nearbyFood: [
      { name: "송도해수욕장 회센터", distance: "도보 5분 · 300m", image: null },
      { name: "암남공원 카페", distance: "도보 15분 · 1.1km", image: null },
      { name: "송도 베이커리", distance: "도보 7분 · 500m", image: null },
    ],
    forecast24h: [
      { label: "현재", hours: 0, score: 82, status: "safe" },
      { label: "6h", hours: 6, score: 80, status: "safe" },
      { label: "12h", hours: 12, score: 73, status: "caution" },
      { label: "24h", hours: 24, score: 65, status: "caution" },
    ],
    alternatives: [
      { id: "marine-museum-songdo", name: "국립해양박물관", score: 85, status: "safe" },
      { id: "amnam-park", name: "암남공원 산책로", score: 80, status: "safe" },
    ],
  },
  {
    id: "1277679",
    rank: 4,
    name: "부산타워",
    category: "전망 · 도심",
    score: 85,
    status: "safe",
    image: "http://tong.visitkorea.or.kr/cms/resource/40/3494840_image2_1.jpg",
    breakdown: { air: 85, weather: 90, uv: 70, ripCurrentOrWater: 95, crowd: 65 },
    envTag: "실외 관광지",
    info: {
      usetime: "10:00~22:00 (입장 마감 21:30)",
      restdate: "연중무휴",
      parking: "가능",
    },
    tips: [
      {
        icon: "schedule",
        label: "Best Visit Time",
        text: "일몰 30분 전부터 올라가면 노을과 함께 켜지는 야경 조명까지 한번에 볼 수 있습니다.",
      },
      {
        icon: "photo_camera",
        label: "Photography Spot",
        text: "전망대 남쪽 창가에서 보는 광안대교와 부산항대교 야경이 가장 웅장합니다.",
      },
    ],
    nearbyFood: [
      { name: "남포동 씨앗호떡거리", distance: "도보 5분 · 350m", image: null },
      { name: "용두산공원 카페", distance: "도보 3분 · 200m", image: null },
      { name: "광복로 밀면골목", distance: "도보 8분 · 600m", image: null },
    ],
    forecast24h: [
      { label: "현재", hours: 0, score: 85, status: "safe" },
      { label: "6h", hours: 6, score: 80, status: "safe" },
      { label: "12h", hours: 12, score: 70, status: "caution" },
      { label: "24h", hours: 24, score: 55, status: "danger" },
    ],
    alternatives: [
      { id: "busan-modern-history-museum-tower", name: "부산근대역사관", score: 84, status: "safe" },
      { id: "lotte-gwangbok", name: "롯데백화점 광복점", score: 80, status: "caution" },
    ],
  },
  {
    id: "987810",
    rank: 5,
    name: "해운대 동백섬",
    category: "해변 · 산책",
    score: 68,
    status: "caution",
    image: "http://tong.visitkorea.or.kr/cms/resource/47/3350847_image2_1.jpg",
    breakdown: { air: 70, weather: 74, uv: 60, ripCurrentOrWater: 72, crowd: 55 },
    envTag: "실외 관광지",
    info: {
      usetime: "상시 개방",
      restdate: "연중무휴",
      parking: "가능, 요금 (무료)",
    },
    tips: [
      {
        icon: "schedule",
        label: "Best Visit Time",
        text: "오후에는 해수욕장 인파가 동백섬까지 이어지니 오전 산책을 추천합니다.",
      },
      {
        icon: "photo_camera",
        label: "Photography Spot",
        text: "누리마루 APEC하우스 앞 해안 산책로에서 보는 광안대교 방향 전경이 아름답습니다.",
      },
    ],
    nearbyFood: [
      { name: "해운대시장 회센터", distance: "도보 6분 · 400m", image: null },
      { name: "동백섬 카페거리", distance: "도보 10분 · 750m", image: null },
      { name: "웨스틴조선 브런치카페", distance: "도보 5분 · 350m", image: null },
    ],
    forecast24h: [
      { label: "현재", hours: 0, score: 68, status: "caution" },
      { label: "6h", hours: 6, score: 62, status: "caution" },
      { label: "12h", hours: 12, score: 55, status: "danger" },
      { label: "24h", hours: 24, score: 50, status: "danger" },
    ],
    alternatives: [
      { id: "sealife-busan-aquarium", name: "씨라이프부산아쿠아리움", score: 88, status: "safe" },
      { id: "nurimaru-apec-house", name: "누리마루 APEC하우스", score: 84, status: "safe" },
    ],
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
