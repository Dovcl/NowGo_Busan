// Maps a NowGo Score status ("safe" | "caution" | "danger") to the
// matching Tailwind color token and Korean label, shared by every screen
// that renders a score badge, bar, or map marker.
export const STATUS = {
  safe: { label: "좋음", text: "text-semantic-safe", bg: "bg-semantic-safe", trackBg: "bg-semantic-safe/20" },
  caution: { label: "주의", text: "text-semantic-caution", bg: "bg-semantic-caution", trackBg: "bg-semantic-caution/20" },
  danger: { label: "위험", text: "text-semantic-danger", bg: "bg-semantic-danger", trackBg: "bg-semantic-danger/20" },
}

export function scoreToStatus(score) {
  if (score >= 80) return "safe"
  if (score >= 60) return "caution"
  return "danger"
}

// 환경부 공식 미세먼지 등급(1=좋음~4=매우나쁨) -> 이 앱의 3단계 신호등으로 축약.
export const PM_GRADE_LABEL = { 1: "좋음", 2: "보통", 3: "나쁨", 4: "매우나쁨" }

export function pmGradeToStatus(grade) {
  if (grade == null) return "safe"
  if (grade <= 2) return "safe"
  if (grade === 3) return "caution"
  return "danger"
}

// 기상청 자외선지수 공식 5단계 기준을 이 앱의 3단계 신호등으로 축약.
export function uvToLevel(uv) {
  if (uv == null) return { label: "-", status: "safe" }
  if (uv < 3) return { label: "낮음", status: "safe" }
  if (uv < 6) return { label: "보통", status: "safe" }
  if (uv < 8) return { label: "높음", status: "caution" }
  return { label: uv < 11 ? "매우높음" : "위험", status: "danger" }
}

// 국립해양조사원 이안류지수 공식 4단계(관심<주의<경계<위험) -> 이 앱의 3단계 신호등.
// "경계"부터 위험으로 묶음 — 4단계 중 세 번째라 이미 충분히 심각한 단계라고 판단.
export function ripLevelToStatus(level) {
  if (level === "관심") return "safe"
  if (level === "주의") return "caution"
  return "danger" // 경계, 위험
}
