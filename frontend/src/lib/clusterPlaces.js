// 지도 확대 정도(카카오맵 level)에 맞춰 가까운 관광지들을 하나로 묶는다.
// 방식: 좌표를 격자(grid)로 나눠서, 같은 칸에 들어온 장소끼리 한 그룹으로 묶는 단순한 방식.
// (거리 기반 정밀 클러스터링도 가능하지만, 지금 목표는 "핀이 겹쳐 안 보이는 것"
//  해결이라 이 정도로 충분함 — KISS/YAGNI)
// 카카오 SDK를 직접 쓰지 않는 순수 함수라 카카오맵 없이도 테스트 가능하다.

// level이 작을수록(많이 확대된 상태) 핀이 이미 넓게 퍼져 있어 묶을 필요가 없다.
// level 6 이하는 클러스터링을 아예 끄고, 그 위로는 제곱으로 키운다 — 살짝만 확대해도
// (level 7~8) 금방 풀리지만, 처음 켜지는 전체 화면(level 9)에서는 확 크게 묶여서
// "2"짜리 배지가 잔뜩 흩어져 보이지 않게 한다.
function gridSizeForLevel(level) {
  return level <= 6 ? 0 : 0.006 * (level - 6) ** 2
}

function average(numbers) {
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length
}

// 한 칸에 이보다 적게 모이면 굳이 배지로 안 묶는다 — 2~3개짜리는 뭉쳐봤자 별로
// 안 줄어들고, 오히려 개별 핀의 색깔/아이콘(관광지 유형) 정보만 사라지기 때문.
const MIN_CLUSTER_SIZE = 4

// places: {lat, lng, ...} 배열, level: 카카오맵 zoom level
// 반환값: [{ lat, lng, places: [...] }, ...]
// places.length가 1이면 단일 핀으로, 2 이상이면 클러스터(숫자 배지)로 그리면 된다.
export function clusterPlaces(places, level) {
  const located = places.filter((p) => p.lat != null && p.lng != null)
  const gridSize = gridSizeForLevel(level)

  if (gridSize === 0) {
    return located.map((place) => ({ lat: place.lat, lng: place.lng, places: [place] }))
  }

  // 좌표를 격자 칸 단위로 반올림해서 같은 칸끼리 묶는다
  const buckets = new Map()
  for (const place of located) {
    const key = `${Math.round(place.lat / gridSize)},${Math.round(place.lng / gridSize)}`
    if (!buckets.has(key)) buckets.set(key, [])
    buckets.get(key).push(place)
  }

  // 칸마다: 충분히 모였으면 하나의 클러스터로, 아니면 그냥 개별 핀들로 풀어서 반환
  return Array.from(buckets.values()).flatMap((group) =>
    group.length < MIN_CLUSTER_SIZE
      ? group.map((place) => ({ lat: place.lat, lng: place.lng, places: [place] }))
      : [{ lat: average(group.map((p) => p.lat)), lng: average(group.map((p) => p.lng)), places: group }]
  )
}
