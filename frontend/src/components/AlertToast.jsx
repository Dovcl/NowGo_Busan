import { useTranslation } from "react-i18next"

// 새 기상특보가 뜰 때마다 화면 우상단(모바일은 상단 중앙)에 뜨는 토스트.
// 헤더에 알림벨이 없는 모바일에서도 "실시간" 체감을 주는 유일한 통로라 전역(AppLayout 밖)에 둔다.
export default function AlertToast({ toasts, onDismiss }) {
  const { t } = useTranslation("common")

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-4 inset-x-4 md:inset-x-auto md:right-4 md:left-auto z-[100] flex flex-col gap-2 items-center md:items-end pointer-events-none">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role="alert"
          className="pointer-events-auto w-full md:w-96 max-w-full bg-surface border border-semantic-caution/40 shadow-lg rounded-xl p-4 flex gap-3 items-start"
        >
          <span className="material-symbols-outlined text-semantic-caution shrink-0 filled-icon">warning</span>
          <div className="flex-1 min-w-0">
            <p className="font-label-sm text-label-sm text-semantic-caution">{t("weatherWarning.badge")}</p>
            <p className="font-body-md text-body-md text-on-surface break-words">{toast.title}</p>
          </div>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            className="shrink-0 text-on-surface-variant hover:text-on-surface"
            aria-label={t("actions.close")}
          >
            <span className="material-symbols-outlined text-lg">close</span>
          </button>
        </div>
      ))}
    </div>
  )
}
