// 실시간 기상청/에어코리아 관측값을 표시용 행으로 뽑는 공통 정의.
// place.breakdown(NowGo Score 환산값)과는 다른 데이터라 분리돼 있다.
// PlaceDetail 페이지와 지도의 PlaceDetailPanel이 같은 목록을 공유한다.
export const ENV_ROWS = [
  { label: "기온", icon: "thermostat", get: (e) => fmt(e.weather?.temperature, "℃") },
  { label: "체감온도", icon: "device_thermostat", get: (e) => fmt(e.weather?.feelsLike, "℃") },
  { label: "습도", icon: "water_drop", get: (e) => fmt(e.weather?.humidity, "%") },
  { label: "풍속", icon: "air", get: (e) => fmt(e.weather?.windSpeed, "m/s") },
  { label: "강수확률", icon: "umbrella", get: (e) => fmt(e.weather?.precipitationProb, "%") },
  { label: "미세먼지", icon: "blur_on", get: (e) => fmt(e.airQuality?.pm10, "㎍/㎥") },
  { label: "초미세먼지", icon: "grain", get: (e) => fmt(e.airQuality?.pm25, "㎍/㎥") },
  { label: "자외선지수", icon: "wb_sunny", get: (e) => fmt(e.uvIndex, "") },
  // 해운대/송정/임랑 반경 5km 안일 때만 값이 있음 — 그 밖엔 e.ripCurrent 자체가 null
  { label: "이안류 위험도", icon: "warning", get: (e) => fmt(e.ripCurrent?.riskLevel, "") },
]

export function fmt(value, unit) {
  return value != null ? `${value}${unit}` : null
}
