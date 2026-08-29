// "캘린더" 버튼으로 여는 팝업. 월 그리드에서 날짜를 탭하면 그날 일정을 보여주고,
// 날짜 칸을 꾹 눌렀다가 옆으로 끌면(long-press + drag) 여러 날짜를 한 번에 잡아
// 개인 일정(예: 2/4~2/7 여행)을 만들 수 있다.
import { useMemo, useRef, useState } from "react"
import {
  eventCoversDate,
  formatDateLabel,
  formatDateRange,
  formatMonthLabel,
  getMonthGrid,
  isCustomEventId,
  isSameDay,
  normalizeRange,
  parseISODate,
  toISODate,
} from "../lib/events"
import { EVENT_CATEGORIES } from "../mock/events"

const WEEKDAYS = ["월", "화", "수", "목", "금", "토", "일"]
const LONG_PRESS_MS = 260

// 부모가 `{calendarOpen && <EventCalendarModal ... />}`로 마운트/언마운트를 제어한다.
// 그래서 열 때마다 새 인스턴스가 생기고, 드래그 상태·선택 날짜가 자연히 초기화된다
// (닫힐 때 상태를 되돌리는 별도 effect가 필요 없음).
export default function EventCalendarModal({
  onClose,
  events,
  savedIds,
  onToggleSaved,
  customEvents,
  onAddCustomEvent,
  onRemoveCustomEvent,
  initialDate,
  excludedDates,
  onToggleExcludedDate,
}) {
  const today = useMemo(() => new Date(), [])
  const [cursor, setCursor] = useState(() => (initialDate ? parseISODate(initialDate) : today))
  const [selectedIso, setSelectedIso] = useState(() => initialDate ?? toISODate(today))
  const [dragRange, setDragRange] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const [draft, setDraft] = useState(null)
  const pressTimerRef = useRef(null)
  const dragAnchorRef = useRef(null)

  const year = cursor.getFullYear()
  const month = cursor.getMonth()
  const grid = getMonthGrid(year, month)
  // 부산 전체 행사(200건 넘음)를 다 띄우면 캘린더가 못 쓸 정도로 빽빽해져서, 기본은
  // 빈 캘린더로 두고 "가고싶어요"로 담은 것 + 직접 만든 개인 일정만 보여준다.
  // 안 담은 행사를 발견/탐색하는 건 리스트 화면(카테고리 필터·상세 모달) 몫으로 남긴다.
  const allEvents = [...events.filter((ev) => savedIds.includes(ev.id)), ...customEvents]
  // 다일 행사(예: 3일짜리 축제)를 담아도 실제로는 하루만 갈 수 있어서, 날짜별로 뺄 수
  // 있게 한다. 월 그리드(색 막대)는 뺀 날짜를 안 보여주고, 날짜를 직접 눌렀을 때 뜨는
  // 상세 패널은 뺀 날짜여도 그 행사를 계속 보여줘서(흐리게 표시) 되돌릴 수 있게 한다 —
  // 안 그러면 뺀 날짜는 다시 찾을 방법이 없어짐.
  const isExcluded = (ev, iso) => (excludedDates[ev.id] ?? []).includes(iso)
  const eventsOnIso = (iso) => allEvents.filter((ev) => eventCoversDate(ev, iso))
  const eventsOnIsoForGrid = (iso) => eventsOnIso(iso).filter((ev) => !isExcluded(ev, iso))

  function goMonth(delta) {
    setCursor(new Date(year, month + delta, 1))
  }
  function goToday() {
    setCursor(new Date(today.getFullYear(), today.getMonth(), 1))
    setSelectedIso(toISODate(today))
  }

  function isoFromPoint(x, y) {
    return document.elementFromPoint(x, y)?.closest("[data-iso]")?.dataset.iso ?? null
  }

  function handleCellPointerDown(iso) {
    dragAnchorRef.current = iso
    clearTimeout(pressTimerRef.current)
    pressTimerRef.current = setTimeout(() => {
      setIsDragging(true)
      setDragRange({ startDate: iso, endDate: iso })
      navigator.vibrate?.(10)
    }, LONG_PRESS_MS)
  }

  function handleGridPointerMove(e) {
    if (!isDragging) return
    const iso = isoFromPoint(e.clientX, e.clientY)
    if (iso) setDragRange(normalizeRange(dragAnchorRef.current, iso))
  }

  function handleGridPointerUp() {
    clearTimeout(pressTimerRef.current)
    if (isDragging) {
      setIsDragging(false)
      setDraft({ title: "", category: "personal" })
    } else if (dragAnchorRef.current) {
      setSelectedIso(dragAnchorRef.current)
    }
    dragAnchorRef.current = null
  }

  function cancelDraft() {
    setDragRange(null)
    setDraft(null)
  }

  function saveDraft() {
    if (!draft?.title.trim() || !dragRange) return
    onAddCustomEvent({
      id: `custom-${Date.now()}`,
      title: draft.title.trim(),
      category: draft.category,
      startDate: dragRange.startDate,
      endDate: dragRange.endDate,
    })
    setSelectedIso(dragRange.startDate)
    setDragRange(null)
    setDraft(null)
  }

  const selectedDate = parseISODate(selectedIso)
  const selectedEvents = eventsOnIso(selectedIso)

  return (
    <div className="fixed inset-0 z-[70] flex items-end md:items-center justify-center">
      <div className="absolute inset-0 bg-on-surface/30 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative bg-surface w-full md:max-w-5xl md:rounded-2xl rounded-t-3xl shadow-xl flex flex-col max-h-[92vh] md:max-h-[88vh] overflow-hidden">
        <div className="md:hidden flex justify-center pt-2 pb-1 shrink-0">
          <span className="w-9 h-1 rounded-full bg-outline-variant" />
        </div>

        <div className="flex items-center justify-between px-4 md:px-6 pt-1 md:pt-5 pb-3 border-b border-outline-variant/30 shrink-0">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => goMonth(-1)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_left</span>
            </button>
            <h3 className="font-headline-lg-mobile text-[17px] md:text-[24px] font-bold text-on-surface min-w-[104px] md:min-w-[140px] text-center">
              {formatMonthLabel(year, month)}
            </h3>
            <button
              type="button"
              onClick={() => goMonth(1)}
              className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container text-on-surface-variant"
            >
              <span className="material-symbols-outlined text-[20px]">chevron_right</span>
            </button>
            <button
              type="button"
              onClick={goToday}
              className="ml-1 hidden sm:inline-flex px-3 py-1 rounded-full border border-outline-variant text-[12px] font-label-sm text-on-surface-variant hover:border-primary hover:text-primary transition-colors"
            >
              오늘
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-surface-container text-on-surface-variant"
          >
            <span className="material-symbols-outlined text-[20px]">close</span>
          </button>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto px-4 md:px-6 py-2.5 border-b border-outline-variant/20 shrink-0 hide-scrollbar">
          {Object.entries(EVENT_CATEGORIES).map(([key, cat]) => (
            <div key={key} className="flex items-center gap-1.5 shrink-0">
              <span className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${cat.dot}`} />
              <span className="font-label-sm text-[11px] md:text-[12.5px] text-on-surface-variant">{cat.label}</span>
            </div>
          ))}
          <span className="ml-auto shrink-0 hidden sm:flex items-center gap-1 text-[11px] text-outline font-label-sm">
            <span className="material-symbols-outlined text-[14px]">touch_app</span>
            꾹 눌러서 옆으로 끌면 여러 날 일정을 만들 수 있어요
          </span>
        </div>

        <div className="flex-1 min-h-0 flex flex-col md:flex-row overflow-hidden">
          <div className="md:w-[62%] shrink-0 flex flex-col overflow-y-auto md:border-r border-outline-variant/20">
            <div className="grid grid-cols-7 px-2 md:px-3 pt-2 shrink-0">
              {WEEKDAYS.map((w) => (
                <div key={w} className="text-center font-label-sm text-[11px] md:text-[13px] text-outline py-1 md:py-1.5">
                  {w}
                </div>
              ))}
            </div>
            <div
              className="grid grid-cols-7 gap-[3px] md:gap-1.5 px-2 md:px-3 pb-3 select-none touch-none"
              onPointerMove={handleGridPointerMove}
              onPointerUp={handleGridPointerUp}
              onPointerCancel={handleGridPointerUp}
            >
              {grid.map(({ date, iso, inMonth }) => {
                const dayEvents = eventsOnIsoForGrid(iso)
                const isToday = isSameDay(date, today)
                const isSelected = iso === selectedIso
                const inDrag = dragRange && iso >= dragRange.startDate && iso <= dragRange.endDate
                return (
                  <div
                    key={iso}
                    data-iso={iso}
                    onPointerDown={() => handleCellPointerDown(iso)}
                    className={`min-h-[58px] md:min-h-[96px] rounded-lg p-1 md:p-1.5 flex flex-col gap-[2px] md:gap-1 cursor-pointer transition-colors
                      ${inMonth ? "" : "opacity-35"}
                      ${inDrag ? "bg-primary-container/60" : isSelected ? "bg-primary-container/40" : "hover:bg-surface-container"}`}
                  >
                    <span
                      className={`w-5 h-5 md:w-7 md:h-7 rounded-full flex items-center justify-center text-[11px] md:text-[13px] font-bold mx-auto shrink-0
                        ${isSelected ? "bg-primary text-on-primary" : isToday ? "border border-primary text-primary" : "text-on-surface"}`}
                    >
                      {date.getDate()}
                    </span>
                    <div className="flex flex-col gap-[2px] md:gap-1">
                      {dayEvents.slice(0, 2).map((ev) => {
                        const cat = EVENT_CATEGORIES[ev.category]
                        return (
                          <span
                            key={ev.id}
                            className={`text-[8.5px] md:text-[10.5px] leading-[13px] md:leading-[17px] px-1 md:px-1.5 rounded truncate font-bold ${cat.barBg} ${cat.barText} ${
                              isCustomEventId(ev.id) ? "border border-dashed border-white/70" : ""
                            }`}
                          >
                            {ev.title}
                          </span>
                        )
                      })}
                      {dayEvents.length > 2 && (
                        <span className="text-[8.5px] md:text-[10.5px] text-on-surface-variant text-center">+{dayEvents.length - 2}</span>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <div className="flex-1 min-h-0 overflow-y-auto p-4 md:p-6 flex flex-col gap-3 md:gap-4 bg-background/60">
            {draft ? (
              <EventDraftForm range={dragRange} draft={draft} onChange={setDraft} onCancel={cancelDraft} onSave={saveDraft} />
            ) : (
              <>
                <div>
                  <h4 className="font-headline-lg-mobile text-[15px] md:text-[19px] font-bold text-on-surface">{formatDateLabel(selectedDate)}</h4>
                  <p className="font-label-sm text-[12px] md:text-[13.5px] text-on-surface-variant mt-0.5">
                    {selectedEvents.length > 0 ? `${selectedEvents.length}건의 일정` : "일정이 없어요"}
                  </p>
                </div>

                {allEvents.length === 0 && (
                  <div className="flex flex-col items-center gap-2 py-8 text-center">
                    <span className="material-symbols-outlined text-3xl text-outline-variant">event_available</span>
                    <p className="font-label-sm text-[12.5px] text-on-surface-variant leading-relaxed">
                      아직 담은 행사가 없어요.
                      <br />
                      리스트에서 관심있는 행사에 <b className="text-on-surface">+</b>를 눌러보세요.
                    </p>
                  </div>
                )}

                {selectedEvents.map((ev) => {
                  const cat = EVENT_CATEGORIES[ev.category]
                  const isCustom = isCustomEventId(ev.id)
                  const isSaved = savedIds.includes(ev.id)
                  const isMultiDay = ev.startDate !== ev.endDate
                  const excludedToday = !isCustom && isExcluded(ev, selectedIso)
                  return (
                    <div
                      key={ev.id}
                      className={`flex gap-3 pb-3 md:pb-4 border-b border-outline-variant/20 last:border-0 last:pb-0 ${excludedToday ? "opacity-40" : ""}`}
                    >
                      <div className="flex-1 min-w-0 flex flex-col gap-1 md:gap-1.5">
                        <span className={`font-label-sm text-[10px] md:text-[11px] font-bold w-fit px-2 md:px-2.5 py-0.5 rounded-full ${cat.badgeBg} ${cat.badgeText}`}>
                          {cat.label}
                        </span>
                        <span className={`font-body-md text-[13.5px] md:text-[16px] font-bold text-on-surface ${excludedToday ? "line-through" : ""}`}>
                          {ev.title}
                        </span>
                        {ev.location && (
                          <span className="font-label-sm text-[11.5px] md:text-[13px] text-on-surface-variant flex items-center gap-1">
                            <span className="material-symbols-outlined text-[13px] md:text-[15px]">location_on</span>
                            {ev.location}
                          </span>
                        )}
                        {isMultiDay && (
                          <span className="font-label-sm text-[11px] md:text-[12.5px] text-outline">{formatDateRange(ev.startDate, ev.endDate)}</span>
                        )}
                        {isMultiDay && !isCustom && (
                          <button
                            type="button"
                            onClick={() => onToggleExcludedDate(ev.id, selectedIso)}
                            className="w-fit font-label-sm text-[11px] md:text-[12px] text-primary hover:underline mt-0.5"
                          >
                            {excludedToday ? "이 날짜 다시 담기" : "이 날짜만 빼기"}
                          </button>
                        )}
                      </div>
                      {isCustom ? (
                        <button
                          type="button"
                          onClick={() => onRemoveCustomEvent(ev.id)}
                          className="w-7 h-7 md:w-9 md:h-9 rounded-full border border-outline-variant text-on-surface-variant hover:border-error hover:text-error flex items-center justify-center shrink-0 self-start"
                        >
                          <span className="material-symbols-outlined text-[16px] md:text-[18px]">delete</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => onToggleSaved(ev.id)}
                          className={`w-7 h-7 md:w-9 md:h-9 rounded-full flex items-center justify-center shrink-0 self-start transition-colors ${
                            isSaved ? "bg-secondary text-white" : "border border-outline-variant text-on-surface-variant"
                          }`}
                        >
                          <span className="material-symbols-outlined text-[16px] md:text-[18px]">{isSaved ? "check" : "add"}</span>
                        </button>
                      )}
                    </div>
                  )
                })}
              </>
            )}
          </div>
        </div>

        <div className="hidden md:flex items-center gap-2 px-6 py-3.5 border-t border-outline-variant/20 bg-surface-container/60 shrink-0">
          <span className="material-symbols-outlined text-[17px] text-secondary">bookmark</span>
          <span className="font-label-sm text-[12.5px] text-on-surface-variant">담은 행사는 프로필 &gt; 보관함에서도 다시 볼 수 있어요</span>
        </div>
      </div>
    </div>
  )
}

function EventDraftForm({ range, draft, onChange, onCancel, onSave }) {
  if (!range) return null
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-primary text-[20px]">date_range</span>
        <div>
          <h4 className="font-headline-lg-mobile text-[15px] font-bold text-on-surface">새 일정 만들기</h4>
          <p className="font-label-sm text-[12px] text-on-surface-variant">{formatDateRange(range.startDate, range.endDate)}</p>
        </div>
      </div>
      <input
        autoFocus
        value={draft.title}
        onChange={(e) => onChange({ ...draft, title: e.target.value })}
        placeholder="일정 제목 (예: 해운대 가족여행)"
        className="w-full bg-surface border border-outline-variant rounded-lg px-3 py-2 text-[13.5px] font-body-md focus:outline-none focus:border-primary"
      />
      <div className="flex flex-wrap gap-1.5">
        {Object.entries(EVENT_CATEGORIES).map(([key, cat]) => (
          <button
            key={key}
            type="button"
            onClick={() => onChange({ ...draft, category: key })}
            className={`px-2.5 py-1 rounded-full font-label-sm text-[11px] border transition-colors ${
              draft.category === key ? `${cat.chipActive} border-transparent` : "border-outline-variant text-on-surface-variant"
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>
      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className="px-3 py-1.5 rounded-lg font-label-sm text-[12.5px] text-on-surface-variant hover:bg-surface-container">
          취소
        </button>
        <button
          type="button"
          onClick={onSave}
          disabled={!draft.title.trim()}
          className="px-4 py-1.5 rounded-lg font-label-sm text-[12.5px] bg-primary text-on-primary disabled:opacity-40"
        >
          저장
        </button>
      </div>
    </div>
  )
}
