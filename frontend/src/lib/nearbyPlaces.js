// 특정 관광지 주변의 다른 관광지를 실제 좌표(하버사인 거리)로 찾는다.
// "점수가 낮은 관광지를 고르면 근처 대체 관광지를 보여주는" 기능에서 사용.
const RADIUS_M = 3000

function haversineMeters(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const toRad = (deg) => (deg * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

// anchor 기준 반경 3km 내 다른 관광지 중 가까운 순 limit개.
export function findNearbyPlaces(anchor, places, limit = 3) {
  if (anchor?.lat == null || anchor?.lng == null) return []
  return places
    .filter((p) => p.id !== anchor.id && p.lat != null && p.lng != null)
    .map((p) => ({ place: p, distance: haversineMeters(anchor.lat, anchor.lng, p.lat, p.lng) }))
    .filter(({ distance }) => distance <= RADIUS_M)
    .sort((a, b) => a.distance - b.distance)
    .slice(0, limit)
    .map(({ place }) => place)
}
