// 실시간 기상청/에어코리아 관측값을 표시용 행으로 뽑는 공통 정의.
// place.breakdown(NowGo Score 환산값)과는 다른 데이터라 분리돼 있다.
// PlaceDetail 페이지와 지도의 PlaceDetailPanel이 같은 목록을 공유한다.
// labelKey는 t(`envRows.${labelKey}`, {ns: "placeDetail"})로 라벨을 찾는 키 — 이 파일은
// 훅을 쓸 수 없는 순수 모듈이라 번역은 호출부(t)에 위임한다.
export const ENV_ROWS = [
  { labelKey: "temperature", icon: "thermostat", get: (e) => fmt(e.weather?.temperature, "℃") },
  { labelKey: "feelsLike", icon: "device_thermostat", get: (e) => fmt(e.weather?.feelsLike, "℃") },
  { labelKey: "humidity", icon: "water_drop", get: (e) => fmt(e.weather?.humidity, "%") },
  { labelKey: "windSpeed", icon: "air", get: (e) => fmt(e.weather?.windSpeed, "m/s") },
  { labelKey: "precipitationType", icon: "umbrella", get: (e, t) => precipitationTypeLabel(e.weather?.precipitationType, t) },
  { labelKey: "pm10", icon: "blur_on", get: (e) => fmt(e.airQuality?.pm10, "㎍/㎥") },
  { labelKey: "pm25", icon: "grain", get: (e) => fmt(e.airQuality?.pm25, "㎍/㎥") },
  { labelKey: "uvIndex", icon: "wb_sunny", get: (e) => fmt(e.uvIndex, "") },
  // 해운대/송정/임랑 반경 5km 안일 때만 값이 있음 — 그 밖엔 e.ripCurrent 자체가 null
  {
    labelKey: "ripRisk",
    icon: "warning",
    get: (e, t) => (e.ripCurrent?.riskLevel ? t(`ripLevel.${e.ripCurrent.riskLevel}`, { ns: "common" }) : null),
  },
  { labelKey: "trafficCongestion", icon: "directions_car", get: (e, t) => trafficCongestionLabel(e.trafficCongestion, t) },
]

export function fmt(value, unit) {
  return value != null ? `${value}${unit}` : null
}

function precipitationTypeLabel(value, t) {
  const key = { 0: "none", 1: "rain", 2: "rainSnow", 3: "snow", 4: "shower" }[value]
  return key ? t(`precipitationType.${key}`) : null
}

function trafficCongestionLabel(traffic, t) {
  if (!traffic) return null
  if (traffic.status === "data_collecting") {
    return t("trafficCollecting")
  }
  // s_traffic: 1=원활, 0.5=보통, 0=정체
  // congestion = 1 - s_traffic으로 역변환
  const congestion = 1 - (traffic.sTraffic || 0)
  const levelKey = congestion < 0.33 ? "low" : congestion < 0.67 ? "moderate" : "high"
  const label = t(`trafficLevel.${levelKey}`)
  const suffix =
    traffic.status === "provisional" ? ` (${t("trafficProvisional")})` : traffic.status === "district_fallback" ? ` (${t("trafficDistrictFallback")})` : ""
  // baseline 대비 편차의 원인을 설명해주는 배지 — 오늘 근처에 축제·행사가 있으면 같이 노출
  const eventNote = traffic.nearbyEvent ? ` · ${t("trafficNearbyEvent", { event: traffic.nearbyEvent })}` : ""
  return `${label}${suffix}${eventNote}`
}
