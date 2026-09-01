// Data-access layer for the `/api/environment` endpoint (좌표 기반 날씨·대기질·자외선).
// placesService.js와 같은 패턴: 백엔드 응답(snake_case)을 프론트가 쓰는 camelCase로 변환.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"

export function adaptEnvironment(data) {
  return {
    weather: data.weather && {
      temperature: data.weather.temperature,
      feelsLike: data.weather.feels_like,
      humidity: data.weather.humidity,
      windSpeed: data.weather.wind_speed,
      precipitationProb: data.weather.precipitation_prob,
      sky: data.weather.sky,
      precipitationType: data.weather.precipitation_type,
      forecast: data.weather.forecast.map((slot) => ({
        hour: Number(slot.fcst_time.slice(0, 2)),
        temperature: slot.temperature,
        sky: slot.sky,
        precipitationType: slot.precipitation_type,
        precipitationProb: slot.precipitation_prob,
      })),
    },
    airQuality: data.air_quality && {
      stationName: data.air_quality.station_name,
      pm10: data.air_quality.pm10,
      pm25: data.air_quality.pm25,
      o3: data.air_quality.o3,
      pm10Grade: data.air_quality.pm10_grade,
      pm25Grade: data.air_quality.pm25_grade,
    },
    uvIndex: data.uv_index,
    ripCurrent: data.rip_current && {
      stationName: data.rip_current.station_name,
      indexValue: data.rip_current.index_value,
      riskLevel: data.rip_current.risk_level,
      waveHeight: data.rip_current.wave_height,
      waterTemp: data.rip_current.water_temp,
    },
    trafficCongestion: data.traffic_congestion && {
      sTraffic: data.traffic_congestion.s_traffic,
      status: data.traffic_congestion.status,
      nearbyEvent: data.traffic_congestion.nearby_event,
      currentSpeed: data.traffic_congestion.current_speed,
      baselineSpeed: data.traffic_congestion.baseline_speed,
      congestedRoadName: data.traffic_congestion.congested_road_name,
    },
    updatedAt: data.updated_at,
  }
}

export async function fetchEnvironment(lat, lng) {
  const query = new URLSearchParams({ lat, lon: lng }).toString()
  const res = await fetch(`${API_BASE_URL}/api/environment?${query}`)
  if (!res.ok) throw new Error(`fetchEnvironment failed: ${res.status}`)
  return adaptEnvironment(await res.json())
}

// "오늘 실측 vs 평소 baseline" 그래프용 — 24시간 전체, 값 없는 시간대는 null 그대로 유지
// (프론트에서 그 구간만 선을 끊어 그리는 데 필요해서 0으로 메우지 않는다)
export async function fetchTrafficHistory(lat, lng) {
  const query = new URLSearchParams({ lat, lon: lng }).toString()
  const res = await fetch(`${API_BASE_URL}/api/environment/traffic-history?${query}`)
  if (!res.ok) throw new Error(`fetchTrafficHistory failed: ${res.status}`)
  const data = await res.json()
  return data.hours.map((h) => ({
    hour: h.hour,
    currentSpeed: h.current_speed,
    baselineSpeed: h.baseline_speed,
  }))
}
