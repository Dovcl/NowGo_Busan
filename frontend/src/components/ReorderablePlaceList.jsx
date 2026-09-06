// 관광지 목록을 순서 번호와 함께 보여주고, 카드를 눌러 잡고 위아래로 옮겨 순서를
// 바꿀 수 있게 하는 공용 컴포넌트. SavedListDetail(전체 화면)과 MapView 사이드바
// (좁은 아코디언)에서 같이 쓴다 — 드래그 로직(Pointer Events + FLIP 애니메이션)은
// 자세한 설명을 SavedListDetail.jsx 원본 주석에 남겨뒀다.
//
// 순서 변경은 로컬 state로만 반영하고, 드래그가 끝났을 때(finishDrag) 한 번만
// onReorder(newPlaces)를 호출한다 — 저장(API 호출)이나 지도 마커 갱신 같은 실제
// 반영은 그 콜백 안에서 부모가 결정한다.
import { useLayoutEffect, useRef, useState } from "react"

const GAP_PX = 8 // 컨테이너의 gap과 맞춘 값
const DRAG_THRESHOLD = 6 // 이만큼 움직여야 "탭"이 아니라 "드래그"로 인정
const SETTLE_MS = 200
const SETTLE_TRANSITION = `top ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)`

export default function ReorderablePlaceList({ places: initialPlaces, onReorder, onSelectPlace, compact = false }) {
  const [places, setPlaces] = useState(initialPlaces)
  const [draggingId, setDraggingId] = useState(null)

  const placesRef = useRef(null)
  const rowRefs = useRef({})
  const prevRectsRef = useRef({})
  const gestureRef = useRef(null)
  const ghostRef = useRef(null)
  const flipAnimRef = useRef({})

  placesRef.current = places

  useLayoutEffect(() => {
    const prevRects = prevRectsRef.current
    for (const [id, el] of Object.entries(rowRefs.current)) {
      if (!el) continue
      const prev = prevRects[id]
      if (!prev) continue
      const next = el.getBoundingClientRect()
      const deltaY = prev.top - next.top
      if (Math.abs(deltaY) > 0.5) {
        flipAnimRef.current[id]?.cancel()
        flipAnimRef.current[id] = el.animate(
          [{ transform: `translateY(${deltaY}px)` }, { transform: "translateY(0)" }],
          { duration: SETTLE_MS, easing: "cubic-bezier(0.2, 0, 0, 1)" }
        )
      }
    }
  }, [places])

  function captureRowRects() {
    const rects = {}
    for (const [id, el] of Object.entries(rowRefs.current)) {
      if (el) rects[id] = el.getBoundingClientRect()
    }
    return rects
  }

  function createGhost(rowEl, rect) {
    const ghost = rowEl.cloneNode(true)
    ghost.style.position = "fixed"
    ghost.style.top = `${rect.top}px`
    ghost.style.left = `${rect.left}px`
    ghost.style.width = `${rect.width}px`
    ghost.style.margin = "0"
    ghost.style.zIndex = "50"
    ghost.style.pointerEvents = "none"
    ghost.classList.add("shadow-xl", "scale-[1.02]")
    document.body.appendChild(ghost)
    ghostRef.current = ghost
  }

  function removeGhost() {
    ghostRef.current?.remove()
    ghostRef.current = null
  }

  const handlePointerDown = (e, placeId) => {
    e.currentTarget.setPointerCapture(e.pointerId)
    const rowEl = rowRefs.current[placeId]
    if (!rowEl) return
    const rect = rowEl.getBoundingClientRect()
    const startIndex = (placesRef.current ?? []).findIndex((p) => p.id === placeId)
    gestureRef.current = {
      id: placeId,
      startX: e.clientX,
      startY: e.clientY,
      rect,
      rowHeight: rect.height + GAP_PX,
      startIndex,
      currentIndex: startIndex,
      itemCount: (placesRef.current ?? []).length,
      dragging: false,
    }
  }

  const handlePointerMove = (e) => {
    const g = gestureRef.current
    if (!g) return
    const deltaY = e.clientY - g.startY

    if (!g.dragging) {
      if (Math.abs(deltaY) < DRAG_THRESHOLD && Math.abs(e.clientX - g.startX) < DRAG_THRESHOLD) return
      g.dragging = true
      setDraggingId(g.id)
      const rowEl = rowRefs.current[g.id]
      if (rowEl) createGhost(rowEl, g.rect)
    }

    if (ghostRef.current) ghostRef.current.style.top = `${g.rect.top + deltaY}px`

    const targetIndex = Math.max(0, Math.min(g.itemCount - 1, g.startIndex + Math.round(deltaY / g.rowHeight)))
    if (targetIndex !== g.currentIndex) {
      g.currentIndex = targetIndex
      setPlaces((prev) => {
        const fromIndex = prev.findIndex((p) => String(p.id) === String(g.id))
        if (fromIndex === -1 || targetIndex === fromIndex) return prev
        prevRectsRef.current = captureRowRects()
        const next = [...prev]
        const [moved] = next.splice(fromIndex, 1)
        next.splice(targetIndex, 0, moved)
        return next
      })
      const badge = ghostRef.current?.querySelector(".rounded-full")
      if (badge) badge.textContent = String(targetIndex + 1)
    }
  }

  const finishDrag = () => {
    const g = gestureRef.current
    gestureRef.current = null
    if (!g) return

    if (!g.dragging) {
      const place = (placesRef.current ?? []).find((p) => String(p.id) === String(g.id))
      if (place) onSelectPlace?.(place)
      return
    }

    const rowEl = rowRefs.current[g.id]
    const ghost = ghostRef.current
    if (ghost && rowEl) {
      const finalTop = rowEl.getBoundingClientRect().top
      ghost.style.transition = SETTLE_TRANSITION
      ghost.style.top = `${finalTop}px`
      window.setTimeout(() => {
        setDraggingId(null)
        removeGhost()
      }, SETTLE_MS)
    } else {
      setDraggingId(null)
      removeGhost()
    }
    onReorder?.(placesRef.current ?? [])
  }

  const cancelDrag = () => {
    const g = gestureRef.current
    gestureRef.current = null
    if (!g?.dragging) return
    setDraggingId(null)
    removeGhost()
  }

  useLayoutEffect(() => {
    window.addEventListener("pointerup", finishDrag)
    window.addEventListener("pointercancel", cancelDrag)
    window.addEventListener("blur", cancelDrag)
    return () => {
      window.removeEventListener("pointerup", finishDrag)
      window.removeEventListener("pointercancel", cancelDrag)
      window.removeEventListener("blur", cancelDrag)
    }
  })

  return (
    <div className={`flex flex-col ${compact ? "gap-1.5" : "gap-2"}`}>
      {places.map((place, index) => (
        <div
          key={place.id}
          ref={(el) => {
            if (el) rowRefs.current[place.id] = el
            else delete rowRefs.current[place.id]
          }}
          onPointerDown={(e) => handlePointerDown(e, place.id)}
          onPointerMove={handlePointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={cancelDrag}
          className={`flex items-center gap-2 bg-surface-container-lowest rounded-lg border select-none touch-none cursor-grab active:cursor-grabbing ${
            compact ? "p-2" : "p-3 gap-3"
          } ${draggingId === place.id ? "opacity-0 pointer-events-none" : "border-outline-variant/30 shadow-sm"}`}
        >
          <span className={`material-symbols-outlined text-outline-variant shrink-0 ${compact ? "text-[16px]" : ""}`}>
            drag_indicator
          </span>
          <span
            className={`rounded-full bg-primary text-on-primary font-label-sm font-bold flex items-center justify-center shrink-0 ${
              compact ? "w-5 h-5 text-[11px]" : "w-6 h-6 text-label-sm"
            }`}
          >
            {index + 1}
          </span>
          {!compact && (
            <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface-dim shrink-0">
              {place.image && <img className="w-full h-full object-cover" src={place.image} alt={place.name} draggable={false} />}
            </div>
          )}
          {compact && place.image && (
            <img className="w-8 h-8 rounded-md object-cover shrink-0" src={place.image} alt={place.name} draggable={false} />
          )}
          <div className="flex-1 min-w-0">
            <p className={`font-bold text-on-surface truncate ${compact ? "font-label-sm text-label-sm" : "font-body-md text-body-md"}`}>
              {place.name}
            </p>
            {!compact && <p className="font-label-sm text-label-sm text-on-surface-variant truncate">{place.category}</p>}
          </div>
        </div>
      ))}
    </div>
  )
}
