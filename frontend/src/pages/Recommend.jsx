// "축제·행사" 탭 — 부산 축제/공연/전시/스포츠/마켓 정보를 모아 보여주고,
// 캘린더 팝업에서 담거나(가고싶어요) 직접 개인 일정을 만들 수 있다.
import { useEffect, useMemo, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import EventCalendarModal from "../components/EventCalendarModal"
import EventDetailModal from "../components/EventDetailModal"
import { useAuth } from "../context/AuthContext"
import { useMyEvents } from "../hooks/useMyEvents"
import { eventStatus, formatDateRange } from "../lib/events"
import { EVENT_CATEGORIES } from "../mock/events"
import { fetchDedupCandidates } from "../services/adminService"
import { fetchAnnouncements, fetchEvents } from "../services/eventsService"

const CATEGORY_ORDER = ["festival", "performance", "exhibition", "sports", "market"]

// "전체 행사" 목록 전용 상태 필터 — 카테고리 필터(위쪽 탭)와는 별개 축.
// 연도 버튼은 하드코딩하지 않고 실제 행사 데이터(startDate)에 있는 연도로만 만든다.
const STATUS_FILTERS = ["all", "upcoming", "ended"]

function matchesStatusFilter(event, filter) {
  if (filter === "all") return true
  if (filter === "upcoming") return eventStatus(event).state !== "ended"
  if (filter === "ended") return eventStatus(event).state === "ended"
  return event.startDate?.slice(0, 4) === filter // 연도 필터
}

// "놓치면 아쉬운 행사" 기준 — 백엔드(TourAPI/KOPIS)엔 인기도·중요도 신호가 없어서,
// 큐레이션된 축제 카테고리(TourAPI searchFestival2 — 시가 인정한 축제만 들어옴, KOPIS의
// 일반 티켓 공연 전체는 제외) 중 가장 임박한 것부터 최대 3개를 뽑는다.
const NOTEWORTHY_LIMIT = 3

function pickNoteworthy(events) {
  return events
    .filter((e) => e.category === "festival" && eventStatus(e).state !== "ended")
    .sort((a, b) => a.startDate.localeCompare(b.startDate))
    .slice(0, NOTEWORTHY_LIMIT)
}

// 검색용 정규화 — 행사명 공백 위치가 소스마다 제각각이라("부산국제록페스티벌"처럼
// 붙여쓰기도 흔함) 완전 문자열 일치 대신 양쪽 다 공백을 지우고 비교한다.
function normalizeForSearch(text) {
  return text.toLowerCase().replace(/\s+/g, "")
}

export default function Recommend() {
  const { t } = useTranslation("recommend")
  const { user } = useAuth()
  const navigate = useNavigate()
  const [events, setEvents] = useState([])
  const [announcements, setAnnouncements] = useState([])
  const [category, setCategory] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")
  const [search, setSearch] = useState("")
  const [calendarOpen, setCalendarOpen] = useState(false)
  const [calendarInitialDate, setCalendarInitialDate] = useState(null)
  const [detailEventId, setDetailEventId] = useState(null)
  const [pendingReviewCount, setPendingReviewCount] = useState(0)

  const { savedIds, toggleSaved, customEvents, addCustomEvent, removeCustomEvent, excludedDates, toggleExcludedDate } = useMyEvents()

  useEffect(() => {
    fetchEvents().then(setEvents)
    fetchAnnouncements().then(setAnnouncements)
  }, [])

  // 관리자일 때만 검토 대기 배지를 보여준다 — 버튼을 숨기는 건 UX일 뿐이고, 실제
  // 접근 차단은 백엔드(require_admin)가 함.
  useEffect(() => {
    if (user?.role === "admin") fetchDedupCandidates().then((list) => setPendingReviewCount(list.length))
  }, [user])

  const categoryFiltered = category === "all" ? events : events.filter((e) => e.category === category)
  // 공백 위치가 제각각인 행사명이 많아서("부산국제록페스티벌" vs 사용자가 "록 페스티벌"로
  // 검색) 완전 문자열 일치 대신 양쪽 다 공백을 지우고 비교한다.
  const query = normalizeForSearch(search)
  const searched = query
    ? categoryFiltered.filter((e) => normalizeForSearch(e.title).includes(query) || normalizeForSearch(e.location).includes(query))
    : categoryFiltered
  const filtered = statusFilter === "all" ? searched : searched.filter((e) => matchesStatusFilter(e, statusFilter))
  const noteworthy = pickNoteworthy(events)

  // 연도 버튼 목록 — 실제 행사 startDate에 있는 연도 중 올해·작년만, 최신순으로.
  // (전체 기간을 다 열면 KOPIS 데이터 오류로 시작일이 몇 년씩 어긋난 이상치까지 탭으로 뜬다)
  const yearOptions = useMemo(() => {
    const thisYear = new Date().getFullYear()
    const years = new Set(
      events.map((e) => Number(e.startDate?.slice(0, 4))).filter((y) => y >= thisYear - 1 && y <= thisYear)
    )
    return [...years].sort((a, b) => b - a).map(String)
  }, [events])

  // 캘린더는 이제 담은 행사만 보여주니까(EventCalendarModal 참고), "캘린더에서 보기"로
  // 어떤 행사의 날짜를 열 땐 그 행사가 아직 안 담겨있으면 같이 담아준다 — 안 그러면
  // 빈 날짜만 뜨는 이상한 경험이 됨.
  function openCalendar(iso, eventId) {
    if (eventId && !savedIds.includes(eventId)) toggleSaved(eventId)
    setCalendarInitialDate(iso ?? null)
    setCalendarOpen(true)
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-container-margin py-4 md:py-8 pb-24 md:pb-8 max-w-7xl mx-auto w-full flex flex-col gap-gutter">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-outline-variant/30 pb-6">
          <div className="flex flex-col gap-2">
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">
              {t("pageTitle")}
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant">{t("pageSubtitle")}</p>
          </div>
          <button
            type="button"
            onClick={() => openCalendar(null)}
            className="flex items-center gap-2 bg-surface hover:bg-surface-container transition-colors border border-outline-variant rounded-full px-4 py-2 text-primary font-label-sm shadow-sm shrink-0"
          >
            <span className="material-symbols-outlined text-[18px]">calendar_month</span>
            {t("calendarButton")}
          </button>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
          <FilterChip active={category === "all"} onClick={() => setCategory("all")}>
            {t("categoryAll")}
          </FilterChip>
          {CATEGORY_ORDER.map((key) => (
            <FilterChip key={key} active={category === key} onClick={() => setCategory(key)} dotClass={EVENT_CATEGORIES[key].dot}>
              {t(`eventCategory.${key}`)}
            </FilterChip>
          ))}
        </div>

        {noteworthy.length > 0 && (
          <section className="mt-4 flex flex-col gap-4">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{t("noteworthyTitle")}</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-gutter">
              {noteworthy.map((ev) => (
                <NoteworthyCard
                  key={ev.id}
                  event={ev}
                  onOpenCalendar={() => openCalendar(ev.startDate, ev.id)}
                  onOpenDetail={() => setDetailEventId(ev.id)}
                />
              ))}
            </div>
          </section>
        )}

        {announcements.map((a) => (
          <div
            key={a.id}
            className="mt-2 bg-surface-container-high rounded-xl p-4 md:p-6 flex items-center justify-between gap-4 border border-outline-variant/30 shadow-sm cursor-pointer hover:bg-surface-container transition-colors"
            onClick={() => setCategory("all")}
          >
            <div className="flex items-center gap-4 min-w-0">
              <div className="w-12 h-12 rounded-full bg-surface text-primary flex items-center justify-center shadow-sm shrink-0">
                <span className="material-symbols-outlined text-[24px]">campaign</span>
              </div>
              <div className="flex flex-col min-w-0">
                <h4 className="font-body-md font-bold text-on-surface truncate">{a.title}</h4>
                <p className="font-label-sm text-on-surface-variant truncate">{a.body}</p>
              </div>
            </div>
            <span className="material-symbols-outlined text-on-surface-variant hidden md:block shrink-0">chevron_right</span>
          </div>
        ))}

        <section className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex items-baseline gap-2">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{t("allEventsTitle")}</h2>
              <span className="font-label-sm text-[12px] text-outline">{t("resultUnit", { count: filtered.length })}</span>
              {user?.role === "admin" && pendingReviewCount > 0 && (
                <button
                  type="button"
                  onClick={() => navigate("/admin/events/review")}
                  className="flex items-center gap-1 px-2.5 py-1 rounded-full bg-tertiary-container text-on-tertiary-container font-label-sm text-[11px] font-bold hover:opacity-80 transition-opacity"
                >
                  <span className="material-symbols-outlined text-[14px]">rule</span>
                  {t("pendingReview", { count: pendingReviewCount })}
                </button>
              )}
            </div>
            <div className="relative sm:w-64 shrink-0">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("searchPlaceholder")}
                className="w-full bg-surface-container border border-outline-variant rounded-full pl-9 pr-8 py-2 text-[13.5px] font-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
                >
                  <span className="material-symbols-outlined text-[16px]">close</span>
                </button>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {STATUS_FILTERS.map((key) => (
              <FilterChip key={key} active={statusFilter === key} onClick={() => setStatusFilter(key)}>
                {t(`statusFilter.${key}`)}
              </FilterChip>
            ))}
            {yearOptions.map((year) => (
              <FilterChip key={year} active={statusFilter === year} onClick={() => setStatusFilter(year)}>
                {year}
              </FilterChip>
            ))}
          </div>

          {filtered.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12 text-center">
              <span className="material-symbols-outlined text-3xl text-outline-variant">search_off</span>
              <p className="font-label-sm text-[13px] text-on-surface-variant">
                {query ? t("noResultsForQuery", { q: search.trim() }) : t("noResults")}
              </p>
            </div>
          ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
            {filtered.map((ev) => (
              <EventRow
                key={ev.id}
                event={ev}
                saved={savedIds.includes(ev.id)}
                onToggleSaved={() => toggleSaved(ev.id)}
                onOpenDetail={() => setDetailEventId(ev.id)}
              />
            ))}
          </div>
          )}
        </section>
      </div>

      {calendarOpen && (
        <EventCalendarModal
          onClose={() => setCalendarOpen(false)}
          events={events}
          savedIds={savedIds}
          onToggleSaved={toggleSaved}
          customEvents={customEvents}
          onAddCustomEvent={addCustomEvent}
          onRemoveCustomEvent={removeCustomEvent}
          initialDate={calendarInitialDate}
          excludedDates={excludedDates}
          onToggleExcludedDate={toggleExcludedDate}
        />
      )}

      {detailEventId && (
        <EventDetailModal
          eventId={detailEventId}
          onClose={() => setDetailEventId(null)}
          saved={savedIds.includes(detailEventId)}
          onToggleSaved={() => toggleSaved(detailEventId)}
          onOpenCalendar={openCalendar}
        />
      )}
    </div>
  )
}

function FilterChip({ active, onClick, dotClass, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-1.5 px-4 py-1.5 rounded-full font-label-sm whitespace-nowrap transition-colors border shrink-0 ${
        active ? "bg-primary text-on-primary border-primary shadow-sm" : "bg-surface-container text-on-surface border-outline-variant hover:bg-surface-container-high"
      }`}
    >
      {dotClass && <span className={`w-1.5 h-1.5 rounded-full ${active ? "bg-white" : dotClass}`} />}
      {children}
    </button>
  )
}

function NoteworthyCard({ event, onOpenCalendar, onOpenDetail }) {
  const { t, i18n } = useTranslation("recommend")
  const status = eventStatus(event)
  const cat = EVENT_CATEGORIES[event.category]
  return (
    <button
      type="button"
      onClick={onOpenDetail}
      className="text-left bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all overflow-hidden flex flex-col group relative border border-outline-variant/10"
    >
      <span
        className={`absolute top-3 left-3 z-10 font-label-sm text-[11px] font-bold px-3 py-1 rounded-full shadow-sm ${
          status.state === "live" ? "bg-secondary text-white" : "bg-on-surface/70 text-white backdrop-blur-sm"
        }`}
      >
        {t(`eventStatus.${status.stateKey}`, { days: status.days })}
      </span>
      <div className="h-40 w-full overflow-hidden relative">
        <img
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          src={event.image}
          alt={event.title}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
      </div>
      <div className="p-card-padding flex flex-col gap-3 flex-1">
        <div className="flex flex-col gap-1">
          <span className={`font-label-sm text-[11px] font-bold ${cat.text}`}>{t(`eventCategory.${event.category}`)}</span>
          <h3 className="font-body-md text-[16px] font-bold text-on-surface line-clamp-1">{event.title}</h3>
          <span className="font-label-sm text-[12.5px] text-on-surface-variant">{formatDateRange(event.startDate, event.endDate, i18n.language)}</span>
          <span className="font-label-sm text-[12.5px] text-on-surface-variant flex items-center gap-1">
            <span className="material-symbols-outlined text-[14px]">location_on</span>
            {event.location}
          </span>
        </div>
        <span
          onClick={(e) => {
            e.stopPropagation()
            onOpenCalendar()
          }}
          className="mt-auto self-start flex items-center gap-1 font-label-sm text-[12px] text-primary hover:underline"
        >
          <span className="material-symbols-outlined text-[15px]">calendar_month</span>
          {t("viewInCalendar")}
        </span>
      </div>
    </button>
  )
}

function EventRow({ event, saved, onToggleSaved, onOpenDetail }) {
  const { t } = useTranslation("recommend")
  const status = eventStatus(event)
  const cat = EVENT_CATEGORIES[event.category]
  return (
    // 안에 "가고싶어요" 버튼이 따로 있어서 <button> 안에 <button>을 못 넣음(무효 HTML) —
    // div + role="button"으로 클릭·키보드 둘 다 카드 열기가 되게 한다.
    <div
      role="button"
      tabIndex={0}
      onClick={onOpenDetail}
      onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && onOpenDetail()}
      className="text-left flex bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-shadow border border-outline-variant/10 p-3 gap-3 cursor-pointer"
    >
      <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
        <img className="w-full h-full object-cover" src={event.image} alt={event.title} />
      </div>
      <div className="flex flex-col justify-between flex-1 min-w-0">
        <div className="flex flex-col gap-0.5">
          <span className={`font-label-sm text-[10.5px] font-bold flex items-center gap-1 ${cat.text}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${cat.dot}`} />
            {t(`eventCategory.${event.category}`)}
          </span>
          <h4 className="font-body-md font-bold text-on-surface text-[14.5px] leading-tight truncate">{event.title}</h4>
          <span className="font-label-sm text-on-surface-variant text-[11.5px] truncate">{event.location}</span>
        </div>
        <div className="flex items-center justify-between mt-1">
          <span
            className={`font-label-sm text-[10.5px] font-bold px-2 py-0.5 rounded-full ${
              status.state === "live" ? "border border-secondary text-secondary" : "bg-primary-container text-on-primary-container"
            }`}
          >
            {t(`eventStatus.${status.stateKey}`, { days: status.days })}
          </span>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              onToggleSaved()
            }}
            className={`w-7 h-7 rounded-full flex items-center justify-center transition-colors shrink-0 ${
              saved ? "bg-secondary text-white" : "border border-primary text-primary hover:bg-primary hover:text-on-primary"
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">{saved ? "check" : "add"}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
