// "전체 행사" 카드를 누르면 뜨는 상세 팝업. 목록 카드는 한 줄로 잘리는 제목/장소만
// 보여주는데, 여기서는 전체 제목·주소·자세히 보기 링크(KOPIS 티켓 페이지 등)까지 보여준다.
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { eventStatus, formatDateRange } from "../lib/events"
import { EVENT_CATEGORIES } from "../mock/events"
import { fetchEventById } from "../services/eventsService"

export default function EventDetailModal({ eventId, onClose, saved, onToggleSaved, onOpenCalendar }) {
  const { t } = useTranslation("recommend")
  const { t: tCommon } = useTranslation("common")
  const [event, setEvent] = useState(null)
  const [notFound, setNotFound] = useState(false)

  useEffect(() => {
    fetchEventById(eventId).then((e) => (e ? setEvent(e) : setNotFound(true)))
  }, [eventId])

  return (
    <div className="fixed inset-0 z-[75] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-on-surface/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-surface w-full md:max-w-md md:rounded-2xl rounded-t-3xl shadow-xl flex flex-col max-h-[90vh] overflow-hidden">
        <div className="md:hidden flex justify-center pt-2 pb-1 shrink-0">
          <span className="w-9 h-1 rounded-full bg-outline-variant" />
        </div>

        {notFound ? (
          <div className="p-8 flex flex-col items-center gap-3 text-center">
            <span className="material-symbols-outlined text-4xl text-outline-variant">event_busy</span>
            <p className="font-body-md text-on-surface-variant">{t("notFound")}</p>
            <button type="button" onClick={onClose} className="text-primary font-label-sm font-bold">
              {tCommon("actions.close")}
            </button>
          </div>
        ) : !event ? (
          <div className="p-10 flex justify-center">
            <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
          </div>
        ) : (
          <EventDetailBody
            event={event}
            saved={saved}
            onToggleSaved={onToggleSaved}
            onClose={onClose}
            onOpenCalendar={onOpenCalendar}
          />
        )}
      </div>
    </div>
  )
}

function EventDetailBody({ event, saved, onToggleSaved, onClose, onOpenCalendar }) {
  const { t, i18n } = useTranslation("recommend")
  const status = eventStatus(event)
  const cat = EVENT_CATEGORIES[event.category]

  return (
    <div className="overflow-y-auto">
      <div className="relative h-48 w-full shrink-0">
        {event.image ? (
          <img className="w-full h-full object-cover" src={event.image} alt={event.title} />
        ) : (
          <div className="w-full h-full bg-surface-container flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-outline-variant">image</span>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 w-8 h-8 rounded-full bg-black/40 text-white flex items-center justify-center backdrop-blur-sm"
        >
          <span className="material-symbols-outlined text-[20px]">close</span>
        </button>
        <span
          className={`absolute top-3 left-3 font-label-sm text-[11px] font-bold px-3 py-1 rounded-full shadow-sm ${
            status.state === "live" ? "bg-secondary text-white" : "bg-black/50 text-white backdrop-blur-sm"
          }`}
        >
          {t(`eventStatus.${status.stateKey}`, { days: status.days })}
        </span>
      </div>

      <div className="p-5 flex flex-col gap-4">
        <div className="flex flex-col gap-1.5">
          <span className={`font-label-sm text-[11.5px] font-bold ${cat.text}`}>{t(`eventCategory.${event.category}`)}</span>
          <h3 className="font-headline-lg-mobile text-[19px] font-bold text-on-surface leading-snug">{event.title}</h3>
        </div>

        <div className="flex flex-col gap-2.5 py-3 border-y border-outline-variant/20">
          <div className="flex items-start gap-2 text-on-surface-variant">
            <span className="material-symbols-outlined text-[18px] mt-0.5">calendar_today</span>
            <span className="font-body-md text-[14px]">{formatDateRange(event.startDate, event.endDate, i18n.language)}</span>
          </div>
          {(event.venue || event.address) && (
            <div className="flex items-start gap-2 text-on-surface-variant">
              <span className="material-symbols-outlined text-[18px] mt-0.5">location_on</span>
              <div className="flex flex-col font-body-md text-[14px]">
                {event.venue && <span>{event.venue}</span>}
                {event.address && event.address !== event.venue && (
                  <span className="text-[12.5px] text-outline">{event.address}</span>
                )}
              </div>
            </div>
          )}
        </div>

        {event.sourceUrls.length > 0 && (
          <div className="flex flex-col gap-2">
            {event.sourceUrls.map((url) => (
              <a
                key={url}
                href={url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-outline-variant text-on-surface font-label-sm text-[13px] font-bold hover:bg-surface-container transition-colors"
              >
                {t("viewDetails")}
                <span className="material-symbols-outlined text-[16px]">open_in_new</span>
              </a>
            ))}
          </div>
        )}

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              onOpenCalendar(event.startDate, event.id)
              onClose()
            }}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg border border-outline-variant text-on-surface-variant font-label-sm text-[13px] font-bold hover:bg-surface-container transition-colors"
          >
            <span className="material-symbols-outlined text-[16px]">calendar_month</span>
            {t("viewInCalendar")}
          </button>
          <button
            type="button"
            onClick={onToggleSaved}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg font-label-sm text-[13px] font-bold transition-colors ${
              saved ? "bg-secondary text-white" : "bg-primary text-on-primary hover:bg-primary/90"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{saved ? "check" : "add"}</span>
            {saved ? t("saved") : t("wantToGo")}
          </button>
        </div>
      </div>
    </div>
  )
}
