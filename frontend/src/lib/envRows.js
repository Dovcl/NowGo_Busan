// 실시간 기상청/에어코리아 관측값을 표시용 행으로 뽑는 공통 정의.
// place.breakdown(NowGo Score 환산값)과는 다른 데이터라 분리돼 있다.
// PlaceDetail 페이지와 지도의 PlaceDetailPanel이 같은 목록을 공유한다.
export const ENV_ROWS = [
  { label: "기온", icon: "thermostat", get: (e) => fmt(e.weather?.temperature, "℃") },
  { label: "체감온도", icon: "device_thermostat", get: (e) => fmt(e.weather?.feelsLike, "℃") },
  { label: "습도", icon: "water_drop", get: (e) => fmt(e.weather?.humidity, "%") },
  { label: "풍속", icon: "air", get: (e) => fmt(e.weather?.windSpeed, "m/s") },
  { label: "강수형태", icon: "umbrella", get: (e) => precipitationTypeLabel(e.weather?.precipitationType) },
  { label: "미세먼지", icon: "blur_on", get: (e) => fmt(e.airQuality?.pm10, "㎍/㎥") },
  { label: "초미세먼지", icon: "grain", get: (e) => fmt(e.airQuality?.pm25, "㎍/㎥") },
  { label: "자외선지수", icon: "wb_sunny", get: (e) => fmt(e.uvIndex, "") },
  // 해운대/송정/임랑 반경 5km 안일 때만 값이 있음 — 그 밖엔 e.ripCurrent 자체가 null
  { label: "이안류 위험도", icon: "warning", get: (e) => fmt(e.ripCurrent?.riskLevel, "") },
  { label: "주변 혼잡도", icon: "directions_car", get: (e) => trafficCongestionLabel(e.trafficCongestion) },
]

export function fmt(value, unit) {
  return value != null ? `${value}${unit}` : null
}

function precipitationTypeLabel(value) {
  return {
    0: "없음",
    1: "비",
    2: "비/눈",
    3: "눈",
    4: "소나기",
  }[value] ?? null
}

function trafficCongestionLabel(traffic) {
  if (!traffic) return null
  if (traffic.status === "data_collecting") {
    return "정보 수집 중"
  }
  // s_traffic: 1=원활, 0.5=보통, 0=정체
  // congestion = 1 - s_traffic으로 역변환
  const congestion = 1 - (traffic.sTraffic || 0)
  const label = congestion < 0.33 ? "낮음" : congestion < 0.67 ? "보통" : "높음"
  if (traffic.status === "provisional") return `${label} (참고용)`
  if (traffic.status === "district_fallback") return `${label} (지역 평균)`
  return label
}
