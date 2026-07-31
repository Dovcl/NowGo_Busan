// Data-access layer for the `/api/places` endpoint (관광지 목록/상세, DB 기반).
//
// This is separate from scoreService.js on purpose: scoreService deals with
// NowGo Score data (still mocked, algorithm not decided yet), while this file
// talks to the real backend place data that already exists in Postgres.
//
// adaptPlace() is the seam between the backend's DB-shaped response
// (contentid/title/env_group4/...) and the view model pages consume
// (id/name/category/...). Real DB fields (image, category name) are read
// straight from the backend. score/status/breakdown are NowGo Score fields —
// there's no algorithm yet, so they're left null here instead of being faked
// on the backend. See harness/DECISIONS.md for why.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

export function adaptPlace(place) {
  // usetime/restdate/parking/usefee만 /places/{contentid}(상세)에 있고
  // /places(목록)에는 없어서 전부 undefined일 수 있다 — 하나라도 있을 때만 info를 채운다.
  const info = {
    usetime: place.usetime,
    restdate: place.restdate,
    parking: place.parking,
    usefee: place.usefee,
  }
  const hasInfo = Object.values(info).some(Boolean)

  return {
    id: String(place.contentid),
    name: place.title,
    addr: place.addr1,
    category: place.category_name ?? place.env_group4,
    image: place.firstimage || null,
    envGroup4: place.env_group4, // 해변 / 산 / 도심 / 실내
    envTypeCode: place.env_type_code,
    isEnvTarget: place.is_env_target, // 환경 신호등 점수 대상 여부 (실내는 항상 false)
    envTag: place.is_env_target ? "실외 관광지" : "실내 관광지",
    lat: place.lat,
    lng: place.lng,
    overview: place.overview,
    homepage: place.homepage,
    info: hasInfo ? info : undefined,
    // NowGo Score 필드 — 알고리즘 결정 전까지 placeholder
    score: null,
    status: null,
    breakdown: null,
  }
}

export async function fetchPlaces(params = {}) {
  const query = new URLSearchParams(params).toString()
  const res = await fetch(`${API_BASE_URL}/api/places${query ? `?${query}` : ""}`)
  if (!res.ok) throw new Error(`fetchPlaces failed: ${res.status}`)
  const data = await res.json()
  return data.map(adaptPlace)
}

export async function fetchPlaceById(contentid) {
  const res = await fetch(`${API_BASE_URL}/api/places/${contentid}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`fetchPlaceById failed: ${res.status}`)
  return adaptPlace(await res.json())
}
