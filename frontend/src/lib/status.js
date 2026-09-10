// Maps a NowGo Score status ("safe" | "caution" | "danger") to the
// matching Tailwind color token, shared by every screen that renders a
// score badge, bar, or map marker. Labels are looked up separately via
// t(`status.${key}`) (common.json) so this stays language-agnostic.
export const STATUS = {
  safe: { text: "text-semantic-safe", bg: "bg-semantic-safe", trackBg: "bg-semantic-safe/20" },
  caution: { text: "text-semantic-caution", bg: "bg-semantic-caution", trackBg: "bg-semantic-caution/20" },
  danger: { text: "text-semantic-danger", bg: "bg-semantic-danger", trackBg: "bg-semantic-danger/20" },
}

export function scoreToStatus(score) {
  if (score >= 80) return "safe"
  if (score >= 60) return "caution"
  return "danger"
}

export function pmGradeToStatus(grade) {
  if (grade == null) return "safe"
  if (grade <= 2) return "safe"
  if (grade === 3) return "caution"
  return "danger"
}

// 기상청 자외선지수 공식 5단계 기준을 이 앱의 3단계 신호등으로 축약.
// levelKey는 t(`uvLevel.${levelKey}`)로 common.json에서 라벨을 찾는 키.
export function uvToLevel(uv) {
  if (uv == null) return { levelKey: "none", status: "safe" }
  if (uv < 3) return { levelKey: "low", status: "safe" }
  if (uv < 6) return { levelKey: "moderate", status: "safe" }
  if (uv < 8) return { levelKey: "high", status: "caution" }
  return { levelKey: uv < 11 ? "veryHigh" : "extreme", status: "danger" }
}

// 국립해양조사원 이안류지수 공식 4단계(관심<주의<경계<위험) -> 이 앱의 3단계 신호등.
// "경계"부터 위험으로 묶음 — 4단계 중 세 번째라 이미 충분히 심각한 단계라고 판단.
// level 자체는 API 원본 한국어 값 그대로라 t(`ripLevel.${level}`)로 번역한다.
export function ripLevelToStatus(level) {
  if (level === "관심") return "safe"
  if (level === "주의") return "caution"
  return "danger" // 경계, 위험
}
