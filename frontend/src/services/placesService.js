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

import i18n from "../lib/i18n"

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

// 도보/차량 여부를 거리로 대략 나누고(1.2km 기준), 각각 평균 속도(도보 4km/h,
// 도심 주행 30km/h)로 소요 시간을 추정한다 — mock 데이터("도보 10분 · 700m")와
// 같은 형식으로 보여주기 위한 표시용 근사치일 뿐, 실제 경로 시간이 아니다.
function formatDistance(meters) {
  const isWalk = meters <= 1200
  const minutes = Math.max(1, Math.round(meters / (isWalk ? 67 : 500)))
  const dist = meters >= 1000 ? `${(meters / 1000).toFixed(1)}km` : `${Math.round(meters)}m`
  return i18n.t(isWalk ? "distance.walk" : "distance.drive", { ns: "common", minutes, dist })
}

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
    envGroup4: place.env_group4, // 해변 / 산 / 도심 / 실내 (백엔드 원본 분류, 그대로 보존)
    // 지도 필터/마커 아이콘 전용 그룹 — 음식점(cat1=A05)만 "실내"에서 따로 빼서 보여준다.
    mapGroup: place.cat1 === "A05" ? "음식점" : place.env_group4,
    envTypeCode: place.env_type_code,
    isEnvTarget: place.is_env_target, // 환경 신호등 점수 대상 여부 (실내는 항상 false)
    envTag: i18n.t(place.is_env_target ? "envTag.outdoor" : "envTag.indoor", { ns: "common" }),
    sigunguCode: place.sigungucode,
    lat: place.lat,
    lng: place.lng,
    overview: place.overview,
    homepage: place.homepage,
    info: hasInfo ? info : undefined,
    // nearby_food는 /places/{contentid}(상세)에만 있음
    nearbyFood: place.nearby_food?.length
      ? place.nearby_food.map((food) => ({
          name: food.title,
          image: food.firstimage || null,
          distance: formatDistance(food.distance_m),
        }))
      : undefined,
    // NowGo Score 필드 — 알고리즘 결정 전까지 placeholder
    score: null,
    status: null,
    breakdown: null,
  }
}

export async function fetchPlaces(params = {}) {
  const query = new URLSearchParams({ ...params, lang: i18n.language }).toString()
  const res = await fetch(`${API_BASE_URL}/api/places?${query}`)
  if (!res.ok) throw new Error(`fetchPlaces failed: ${res.status}`)
  const data = await res.json()
  return data.map(adaptPlace)
}

export async function fetchPlaceById(contentid) {
  const query = new URLSearchParams({ lang: i18n.language }).toString()
  const res = await fetch(`${API_BASE_URL}/api/places/${contentid}?${query}`)
  if (res.status === 404) return null
  if (!res.ok) throw new Error(`fetchPlaceById failed: ${res.status}`)
  return adaptPlace(await res.json())
}
