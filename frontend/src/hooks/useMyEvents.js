// "가고싶어요"로 담은 공식 행사 id + 캘린더에서 직접 드래그로 만든 개인 일정을
// 로컬에 저장한다. 사용자 캘린더를 저장할 백엔드 테이블이 아직 없어서
// (harness 참고) 우선 localStorage로만 유지 — 로그인 연동은 이후 과제.
import { useCallback, useEffect, useState } from "react"

const STORAGE_KEY = "nowgo_myEvents_v1"

function load() {
  try {
    const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY))
    return { savedIds: parsed?.savedIds ?? [], customEvents: parsed?.customEvents ?? [] }
  } catch {
    return { savedIds: [], customEvents: [] }
  }
}

export function useMyEvents() {
  const [state, setState] = useState(load)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const toggleSaved = useCallback((id) => {
    setState((prev) => ({
      ...prev,
      savedIds: prev.savedIds.includes(id) ? prev.savedIds.filter((sid) => sid !== id) : [...prev.savedIds, id],
    }))
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
    toggleSaved,
    addCustomEvent,
    removeCustomEvent,
  }
}
