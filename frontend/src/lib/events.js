// 축제·행사 캘린더 전용 날짜 유틸. Date를 항상 "로컬 자정" 기준으로 다뤄서
// 타임존 때문에 하루씩 밀리는 문제를 피한다.
// 요일/월 표기는 Intl.DateTimeFormat으로 locale에 맞게 포맷한다 —
// locale은 i18n.language(ko/en/zh)를 호출부에서 그대로 넘긴다.
const LOCALE_MAP = { ko: "ko-KR", en: "en-US", zh: "zh-CN" }

function toLocaleTag(locale) {
  return LOCALE_MAP[locale] ?? "ko-KR"
}

export function toISODate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, "0")
  const d = String(date.getDate()).padStart(2, "0")
  return `${y}-${m}-${d}`
}

export function parseISODate(iso) {
  const [y, m, d] = iso.split("-").map(Number)
  return new Date(y, m - 1, d)
}

export function isSameDay(a, b) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

// 월요일 시작 6주(42칸) 그리드. 각 칸은 { date, iso, inMonth }.
export function getMonthGrid(year, month) {
  const first = new Date(year, month, 1)
  const firstWeekday = (first.getDay() + 6) % 7 // 월=0 ... 일=6
  const gridStart = new Date(year, month, 1 - firstWeekday)

  return Array.from({ length: 42 }, (_, i) => {
    const date = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i)
    return { date, iso: toISODate(date), inMonth: date.getMonth() === month }
  })
}

// 캘린더 헤더용 월~일 요일 약칭. 그리드가 항상 월요일 시작으로 고정돼 있어(getMonthGrid),
// 2024-01-01(월요일)을 기준일 삼아 locale에 맞는 짧은 요일명 7개를 뽑는다.
export function weekdayShortLabels(locale) {
  const formatter = new Intl.DateTimeFormat(toLocaleTag(locale), { weekday: "short" })
  return Array.from({ length: 7 }, (_, i) => formatter.format(new Date(2024, 0, 1 + i)))
}

export function formatMonthLabel(year, month, locale) {
  return new Intl.DateTimeFormat(toLocaleTag(locale), { year: "numeric", month: "long" }).format(new Date(year, month, 1))
}

export function formatDateLabel(date, locale) {
  return new Intl.DateTimeFormat(toLocaleTag(locale), { month: "long", day: "numeric", weekday: "short" }).format(date)
}

export function formatDateRange(startIso, endIso, locale) {
  const s = parseISODate(startIso)
  const e = parseISODate(endIso)
  const short = (d) => new Intl.DateTimeFormat(toLocaleTag(locale), { month: "numeric", day: "numeric", weekday: "short" }).format(d)
  if (startIso === endIso) return short(s)
  return `${short(s)} ~ ${short(e)}`
}

// 이벤트가 해당 날짜에 걸쳐있는지 (start <= date <= end)
export function eventCoversDate(event, iso) {
  return event.startDate <= iso && iso <= event.endDate
}

// D-day/진행 상태. today를 인자로 받아 테스트하기 쉽게 한다.
// stateKey는 t(`eventStatus.${stateKey}`, {ns: "recommend", days})로 라벨을 찾는 키.
export function eventStatus(event, today = new Date()) {
  const d0 = startOfDay(today)
  const s0 = parseISODate(event.startDate)
  const e0 = parseISODate(event.endDate)

  if (d0 > e0) return { stateKey: "ended", state: "ended" }
  if (d0 >= s0 && d0 <= e0) return { stateKey: "live", state: "live" }

  const diffDays = Math.round((s0 - d0) / 86400000)
  if (diffDays === 0) return { stateKey: "today", state: "today" }
  return { stateKey: "upcoming", state: "upcoming", days: diffDays }
}

// 드래그로 잡은 두 날짜(순서 무관)를 정렬된 { startDate, endDate } ISO 범위로.
export function normalizeRange(isoA, isoB) {
  return isoA <= isoB ? { startDate: isoA, endDate: isoB } : { startDate: isoB, endDate: isoA }
}

// 캘린더에서 드래그로 만든 개인 일정은 id를 "custom-"으로 시작시켜서
// 공식 행사(mock/events.js)와 구분한다.
export function isCustomEventId(id) {
  return id.startsWith("custom-")
}
