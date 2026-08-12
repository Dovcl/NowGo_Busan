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
    updatedAt: data.updated_at,
  }
}

export async function fetchEnvironment(lat, lng) {
  const query = new URLSearchParams({ lat, lon: lng }).toString()
  const res = await fetch(`${API_BASE_URL}/api/environment?${query}`)
  if (!res.ok) throw new Error(`fetchEnvironment failed: ${res.status}`)
  return adaptEnvironment(await res.json())
}
