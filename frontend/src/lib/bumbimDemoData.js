// "부산 붐빔" 데모 모드용 가상 혼잡도 생성기.
//
// 지금 로컬/배포 DB는 도로 baseline이 막 쌓이기 시작한 cold-start라 모든 관광지가
// district_fallback(구 평균)으로 똑같은 값을 보여준다 — 팀원 데모용으로는 "baseline이
// 3주 이상 쌓였을 때" 화면을 미리 보여줄 필요가 있어서, 실제 관광지 이름/좌표는 그대로
// 쓰고 혼잡도 숫자만 스팟 id 기반 결정적 시드로 만들어낸다(새로고침해도 값이 안 바뀜).
//
// 절대 실제 API 응답인 척하지 않는다 — 호출부에서 항상 "데모" 표시와 함께만 노출할 것.

function hashSeed(str) {
  let h = 0
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0
  return h
}

function seededFraction(seed) {
  const x = Math.sin(seed) * 43758.5453
  return x - Math.floor(x)
}

const DEMO_ROAD_NAMES = ["해변로", "중앙대로", "APEC로", "좌수영로", "연안로", "테마거리"]

export function demoTrafficFor(spot) {
  const seed = hashSeed(spot.id)
  const congestion = Math.round(seededFraction(seed) * 100)
  const sTraffic = Math.min(Math.max(1 - congestion / 100, 0.05), 1)
  const baselineSpeed = 18 + seededFraction(seed + 1) * 18
  const currentSpeed = Math.max(2, baselineSpeed * sTraffic)
  const roadName = DEMO_ROAD_NAMES[Math.floor(seededFraction(seed + 2) * DEMO_ROAD_NAMES.length)]

  return {
    sTraffic,
    status: "normal",
    currentSpeed,
    baselineSpeed,
    congestedRoadName: `${roadName} (데모)`,
    nearbyEvent: seededFraction(seed + 3) > 0.8 ? "가상 축제 (데모)" : null,
  }
}

export function demoHistoryCurveFor(spot) {
  const seed = hashSeed(spot.id)
  const severity = 0.6 + seededFraction(seed + 4) * 0.9 // 스팟마다 오늘 피크가 얼마나 튀는지
  const hours = Array.from({ length: 25 }, (_, h) => h)
  const baseline = hours.map((h) => {
    const daytime = h >= 6 && h <= 23 ? 1 : 0.3
    return Math.max(5, 30 + 30 * Math.sin(((h - 6) / 24) * Math.PI * 2) * daytime)
  })
  const actual = baseline.map((b, i) => {
    const noise = (seededFraction(seed + 10 + i) - 0.5) * 12
    return Math.min(100, Math.max(0, b * severity + noise))
  })
  return { hours, baseline, actual }
}
