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
