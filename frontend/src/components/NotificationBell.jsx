import { useState } from "react"
import { useTranslation } from "react-i18next"
import { useWeatherWarnings } from "../context/WeatherWarningContext"
import { timeAgo } from "../lib/timeAgo"

// 데스크톱 헤더 전용 — 기상특보 피드(최근 20건)를 드롭다운으로 보여준다.
// 실시간 토스트는 별도로 AlertToast가 전역에서 담당하고, 이건 "지난 알림 다시 보기" 용도.
export default function NotificationBell() {
  const { t } = useTranslation("common")
  const { warnings, unreadCount, markAllRead } = useWeatherWarnings()
  const [open, setOpen] = useState(false)

  const toggle = () => {
    const next = !open
    setOpen(next)
    if (next) markAllRead()
  }

  return (
    <div className="relative">
      <button
        className="relative p-2 hover:bg-surface-container-low rounded-full transition-colors"
        type="button"
        onClick={toggle}
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-error text-on-error text-[10px] leading-4 font-bold text-center">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
      {open && (
        <div className="absolute right-0 mt-1 bg-surface rounded-lg shadow-lg border border-outline-variant/30 py-1 w-80 max-h-96 overflow-y-auto z-50">
          <p className="px-4 py-2 font-label-sm text-label-sm text-on-surface-variant">
            {t("weatherWarning.title")}
          </p>
          {warnings.length === 0 ? (
            <p className="px-4 py-6 text-center font-body-md text-body-md text-on-surface-variant">
              {t("weatherWarning.empty")}
            </p>
          ) : (
            warnings.map((w) => (
              <div key={w.title + w.issuedAt} className="px-4 py-2 hover:bg-surface-container-low">
                <p className="font-body-md text-body-md text-on-surface break-words">{w.title}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant">{timeAgo(w.issuedAt, t)}</p>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
