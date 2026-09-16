import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react"
import { fetchWeatherWarnings } from "../services/environmentService"
import AlertToast from "../components/AlertToast"

const WeatherWarningContext = createContext(null)

const LAST_SEEN_KEY = "nowgo_weather_warning_last_seen"
const NOTIF_ENABLED_KEY = "nowgo_weather_warning_notif_enabled"
// ETL이 15분 주기로 돌아서 그보다 훨씬 촘촘히 물어봐야 의미가 없다 — 1분이면
// "실시간"으로 체감되면서도 무의미한 요청 폭주는 아니다.
const POLL_INTERVAL_MS = 60_000
const TOAST_DURATION_MS = 8_000

export function WeatherWarningProvider({ children }) {
  const [warnings, setWarnings] = useState([])
  const [lastSeenAt, setLastSeenAt] = useState(() => localStorage.getItem(LAST_SEEN_KEY) ?? "")
  const [toasts, setToasts] = useState([])
  // 벨 드롭다운(피드)은 끄고 켜는 것과 무관하게 항상 동작 — 이건 "팝업으로 방해받을지"만
  // 끄는 스위치다(Slack 채널 음소거와 같은 개념). 기본값 true, 로그인 여부와 무관하게
  // 이 브라우저에서 유지.
  const [notificationsEnabled, setNotificationsEnabledState] = useState(
    () => localStorage.getItem(NOTIF_ENABLED_KEY) !== "false"
  )
  const toastedTitlesRef = useRef(new Set())

  const setNotificationsEnabled = useCallback((enabled) => {
    setNotificationsEnabledState(enabled)
    localStorage.setItem(NOTIF_ENABLED_KEY, String(enabled))
  }, [])

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const poll = useCallback(async () => {
    let fresh
    try {
      fresh = await fetchWeatherWarnings()
    } catch {
      return // 조용히 다음 폴링 때 재시도 — 알림 기능이 앱 전체를 막으면 안 됨
    }
    setWarnings(fresh)

    // 첫 방문(lastSeenAt 없음)이면 기존 20건을 전부 "새 알림"으로 토스트하지 않고
    // 조용히 최신 시각으로 기준선만 맞춘다 — 그 이후 새로 올라오는 것만 토스트한다.
    if (!lastSeenAt) {
      if (fresh.length > 0) {
        setLastSeenAt(fresh[0].issuedAt)
        localStorage.setItem(LAST_SEEN_KEY, fresh[0].issuedAt)
      }
      return
    }

    const newOnes = fresh.filter(
      (w) => w.issuedAt > lastSeenAt && !toastedTitlesRef.current.has(w.title + w.issuedAt)
    )
    if (newOnes.length === 0) return
    newOnes.forEach((w) => toastedTitlesRef.current.add(w.title + w.issuedAt))
    // 알림 끔 상태여도 안 읽음 배지·드롭다운 피드는 그대로 유지하고, 팝업(토스트)만 안 띄운다.
    if (!notificationsEnabled) return
    const withIds = newOnes.map((w) => ({ ...w, id: w.title + w.issuedAt }))
    setToasts((prev) => [...prev, ...withIds])
    // 토스트마다 등장 시점 기준으로 독립적으로 8초 뒤 닫는다 — 배열 전체를 다시
    // 훑는 effect로 하면 새 토스트가 추가될 때마다 기존 것들 타이머까지 밀린다.
    withIds.forEach((w) => {
      setTimeout(() => dismissToast(w.id), TOAST_DURATION_MS)
    })
  }, [lastSeenAt, dismissToast, notificationsEnabled])

  useEffect(() => {
    poll()
    const handle = setInterval(() => {
      if (document.visibilityState === "visible") poll()
    }, POLL_INTERVAL_MS)
    return () => clearInterval(handle)
  }, [poll])

  const unreadCount = warnings.filter((w) => w.issuedAt > lastSeenAt).length

  const markAllRead = useCallback(() => {
    if (warnings.length === 0) return
    const newest = warnings[0].issuedAt
    setLastSeenAt(newest)
    localStorage.setItem(LAST_SEEN_KEY, newest)
  }, [warnings])

  const value = { warnings, unreadCount, markAllRead, notificationsEnabled, setNotificationsEnabled }

  return (
    <WeatherWarningContext.Provider value={value}>
      {children}
      <AlertToast toasts={toasts} onDismiss={dismissToast} />
    </WeatherWarningContext.Provider>
  )
}

export function useWeatherWarnings() {
  const ctx = useContext(WeatherWarningContext)
  if (!ctx) throw new Error("useWeatherWarnings는 WeatherWarningProvider 안에서만 쓸 수 있습니다")
  return ctx
}
