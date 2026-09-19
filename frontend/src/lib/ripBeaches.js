// 이안류를 관측하는 부산 해수욕장 3곳(백엔드 fetch_rip_current.py와 동일).
// 백엔드는 해변 1.5km 안 좌표에만 이안류 값을 주므로, GPS에서 가장 가까운 해변 좌표로 조회한다.
const BEACHES = [
  { key: "haeundae", lat: 35.1587, lng: 129.1604 },
  { key: "songjeong", lat: 35.1789, lng: 129.1996 },
  { key: "imrang", lat: 35.3196, lng: 129.2646 },
]

// 위경도 차이로 가까운 순만 비교(3곳 비교엔 하버사인까지 필요 없음). 위치 없으면 해운대.
export function nearestRipBeach(loc) {
  if (!loc) return BEACHES[0]
  const dist = (b) => (b.lat - loc.lat) ** 2 + ((b.lng - loc.lng) * 0.82) ** 2 // 부산 위도에서 경도 1° ≈ 0.82°
  return BEACHES.reduce((best, b) => (dist(b) < dist(best) ? b : best))
}
