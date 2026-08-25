// 축제·행사 캘린더 전용 날짜 유틸. Date를 항상 "로컬 자정" 기준으로 다뤄서
// 타임존 때문에 하루씩 밀리는 문제를 피한다.
const WEEKDAY_KO = ["일", "월", "화", "수", "목", "금", "토"]

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

export function formatMonthLabel(year, month) {
  return `${year}년 ${month + 1}월`
}

export function formatDateLabel(date) {
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${WEEKDAY_KO[date.getDay()]})`
}

export function formatDateRange(startIso, endIso) {
  const s = parseISODate(startIso)
  const e = parseISODate(endIso)
  const short = (d) => `${d.getMonth() + 1}.${d.getDate()} (${WEEKDAY_KO[d.getDay()]})`
  if (startIso === endIso) return short(s)
  return `${short(s)} ~ ${short(e)}`
}

// 이벤트가 해당 날짜에 걸쳐있는지 (start <= date <= end)
export function eventCoversDate(event, iso) {
  return event.startDate <= iso && iso <= event.endDate
}

// D-day/진행 상태. today를 인자로 받아 테스트하기 쉽게 한다.
export function eventStatus(event, today = new Date()) {
  const d0 = startOfDay(today)
  const s0 = parseISODate(event.startDate)
  const e0 = parseISODate(event.endDate)

  if (d0 > e0) return { label: "종료", state: "ended" }
  if (d0 >= s0 && d0 <= e0) return { label: "진행중", state: "live" }

  const diffDays = Math.round((s0 - d0) / 86400000)
  if (diffDays === 0) return { label: "오늘 시작", state: "today" }
  return { label: `D-${diffDays}`, state: "upcoming" }
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
