// "가고싶어요"로 담은 공식 행사 id + 캘린더에서 직접 드래그로 만든 개인 일정을
// 로컬에 저장한다. 사용자 캘린더를 저장할 백엔드 테이블이 아직 없어서
// (harness 참고) 우선 localStorage로만 유지 — 로그인 연동은 이후 과제.
import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "nowgo_myEvents_v1"

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return {
      savedIds: parsed?.savedIds ?? [],
      customEvents: parsed?.customEvents ?? [],
      // 다일 행사(예: 3일짜리 축제)를 담아도 실제로는 그중 하루만 갈 수 있어서,
      // 이벤트 id -> 제외한 날짜(ISO) 배열로 "이 날은 안 감"을 따로 기억한다.
      excludedDates: parsed?.excludedDates ?? {},
    }
  } catch {
    return { savedIds: [], customEvents: [], excludedDates: {} }
  }
}

export function useMyEvents() {
  const [state, setState] = useState(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const toggleSaved = useCallback((id) => {
    setState((prev) => {
      const isSaved = prev.savedIds.includes(id)
      // 담기 해제하면 그 행사의 날짜별 제외 기록도 같이 정리(다시 담으면 처음부터 전체 기간)
      const restExcluded = { ...prev.excludedDates }
      delete restExcluded[id]
      return {
        ...prev,
        savedIds: isSaved ? prev.savedIds.filter((sid) => sid !== id) : [...prev.savedIds, id],
        excludedDates: isSaved ? restExcluded : prev.excludedDates,
      }
    })
  }, [])

  const toggleExcludedDate = useCallback((eventId, iso) => {
    setState((prev) => {
      const current = prev.excludedDates[eventId] ?? []
      const next = current.includes(iso) ? current.filter((d) => d !== iso) : [...current, iso]
      return { ...prev, excludedDates: { ...prev.excludedDates, [eventId]: next } }
    })
  }, [])

  const addCustomEvent = useCallback((event) => {
    setState((prev) => ({ ...prev, customEvents: [...prev.customEvents, event] }))
  }, [])

  const removeCustomEvent = useCallback((id) => {
    setState((prev) => ({ ...prev, customEvents: prev.customEvents.filter((e) => e.id !== id) }))
  }, [])

  return {
    savedIds: state.savedIds,
    customEvents: state.customEvents,
    excludedDates: state.excludedDates,
    toggleSaved,
    toggleExcludedDate,
    addCustomEvent,
    removeCustomEvent,
  }
}
