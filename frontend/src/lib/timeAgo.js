// 알림 피드용 상대 시간 포맷 — i18next t()를 받아 언어별 문자열을 만든다.
export function timeAgo(isoString, t) {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const minutes = Math.max(0, Math.floor(diffMs / 60000))
  if (minutes < 1) return t("timeAgo.justNow")
  if (minutes < 60) return t("timeAgo.minutesAgo", { count: minutes })
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return t("timeAgo.hoursAgo", { count: hours })
  return t("timeAgo.daysAgo", { count: Math.floor(hours / 24) })
}
