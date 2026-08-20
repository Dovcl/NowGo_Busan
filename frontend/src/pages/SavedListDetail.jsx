// 리스트 하나에 담긴 관광지들. 카드를 누르고 있으면 잡히고(grab), 위아래로 움직이면
// 순서가 바뀌고, 손을 떼면 그 자리에 놓인다(drop) — 손을 떼기 전까진 계속 포인터를
// 따라온다. 살짝 눌렀다 바로 떼면(움직임이 거의 없으면) 드래그 대신 상세페이지로 이동.
//
// Pointer Events로 구현했다(HTML5 draggable 아님): 이 앱은 모바일 PWA인데 HTML5
// draggable은 터치에서 아예 동작하지 않는다. setPointerCapture로 손가락이 카드
// 밖으로 나가도 move/up 이벤트를 계속 받는다.
//
// 잡은 카드는 목록 흐름 안에 그대로 있되 투명해지기만 한다(자리를 계속 차지) —
// 그래서 잡는 순간엔 아무도 움직이지 않는다. 실제로 손가락을 따라다니는 건 그 카드를
// cloneNode한 "고스트"로, 화면에 별도로 띄워서 위치만 갱신한다. 드래그가 다른 카드
// 위치를 넘어서면 그때 비로소 배열을 재정렬하고, 밀려나는 카드들은 FLIP 기법(재정렬
// 직전 위치를 기억해뒀다가 Web Animations API(el.animate)로 그 차이만큼에서 0으로
// 애니메이션)으로 스르륵 자리를 비켜준다 — 마치 "여기 놓을래?"하고 자리를 만들어주듯이.
// CSS transition 토글 대신 animate()를 쓰는 이유: 카드를 여러 칸 빠르게 지나가면 이
// effect가 짧은 간격으로 연달아 도는데, transition 토글 방식은 브라우저가 이전 스타일
// 변경을 페인트하기 전에 다음 변경이 들어오면 애니메이션이 통째로 씹히는(끊기는)
// 경우가 있었다 — animate()는 그 문제 없이 매번 확정적으로 재생을 시작/대체한다.
import { useLayoutEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { fetchListItems, fetchMyLists, reorderList } from "../services/listsService"
import { fetchPlaceById } from "../services/placesService"

const GAP_PX = 8 // 컨테이너의 gap-2와 맞춘 값
const DRAG_THRESHOLD = 6 // 이만큼 움직여야 "탭"이 아니라 "드래그"로 인정
const SETTLE_MS = 200
const SETTLE_TRANSITION = `top ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)`

export default function SavedListDetail() {
  const { listId } = useParams()
  const navigate = useNavigate()
  const [listName, setListName] = useState(null)
  const [places, setPlaces] = useState(null)
  const [draggingId, setDraggingId] = useState(null)

  const placesRef = useRef(null)
  const rowRefs = useRef({}) // placeId -> row DOM node
  const prevRectsRef = useRef({}) // FLIP용: 재정렬 직전 위치 스냅샷
  const gestureRef = useRef(null) // 진행 중인 포인터 제스처 (null이면 없음)
  const ghostRef = useRef(null) // 드래그 중 화면에 떠서 손가락을 따라다니는 카드 복제본
  const flipAnimRef = useRef({}) // placeId -> 재생 중인 FLIP Animation (연달아 재정렬될 때 취소용)

  placesRef.current = places

  useLayoutEffect(() => {
    fetchMyLists().then((lists) => {
      const match = lists.find((l) => String(l.id) === listId)
      setListName(match?.name ?? null)
    })
    fetchListItems(listId)
      .then((contentids) => Promise.all(contentids.map(fetchPlaceById)))
      .then((result) => setPlaces(result.filter(Boolean)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listId])

  // 재정렬(setPlaces)로 places가 바뀔 때마다: 카드들이 갑자기 점프해 보이지 않도록,
  // 직전 위치와의 차이만큼 되돌렸다가 애니메이션으로 정리한다(FLIP, 파일 상단 설명 참고).
  // 드래그 중인 카드(투명)도 같이 흘러가야 "빈 자리가 이동하는" 느낌이 나서 제외하지 않는다.
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

  // rect 위치에 딱 맞춰 카드를 복제해 띄운다 — 원본은 목록 안에서 투명해질 뿐 자리를
  // 그대로 지키고, 이 복제본만 포인터를 따라 움직인다.
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

    // 다른 카드 자리를 절반 이상 넘어섰을 때만 재정렬 — 그 전까진 다들 제자리.
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
      // 고스트는 잡은 순간 그대로 복제된 거라 번호 배지가 안 바뀌는데, 실제 카드가
      // 몇 번째로 옮겨가는지는 계속 보여줘야 하니 여기서 직접 갱신한다.
      const badge = ghostRef.current?.querySelector(".rounded-full")
      if (badge) badge.textContent = String(targetIndex + 1)
    }
  }

  // gestureRef.current.id로부터 필요한 걸 다 유도할 수 있어서 인자가 필요 없다 —
  // 그래서 이 함수를 행(row)의 onPointerUp뿐 아니라, capture가 엉뚱한 곳으로
  // 새는 경우를 대비한 window 레벨 안전망에서도 그대로 재사용할 수 있다.
  const finishDrag = () => {
    const g = gestureRef.current
    gestureRef.current = null
    if (!g) return

    if (!g.dragging) {
      navigate(`/place/${g.id}`)
      return
    }

    const rowEl = rowRefs.current[g.id]
    const ghost = ghostRef.current
    if (ghost && rowEl) {
      // 카드가 최종적으로 놓일 실제 위치로 고스트를 스르륵 옮긴 뒤, 그때 원본을 다시 보여준다.
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
    reorderList(listId, (placesRef.current ?? []).map((p) => Number(p.id)))
  }

  const cancelDrag = () => {
    const g = gestureRef.current
    gestureRef.current = null
    if (!g?.dragging) return
    setDraggingId(null)
    removeGhost()
  }

  // 안전망: 포인터 캡처가 (드물게) 엉뚱한 요소로 새거나 브라우저가 탭 전환 등으로
  // 제스처를 끊어버려도, 카드가 계속 투명한 채로 영영 남지 않도록 window에서도 감시한다.
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

  if (places === null) return null

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto w-full px-4 md:px-container-margin py-8 pb-24 md:pb-8 flex flex-col gap-gutter">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => navigate("/saved")}
            className="w-10 h-10 rounded-full hover:bg-surface-container-low flex items-center justify-center shrink-0"
          >
            <span className="material-symbols-outlined">arrow_back</span>
          </button>
          <div>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-bold text-on-surface">
              {listName ?? "리스트"}
            </h1>
            <p className="font-label-sm text-label-sm text-on-surface-variant">{places.length}개 관광지</p>
          </div>
        </div>

        {places.length > 0 && (
          <div className="bg-primary-container/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">drag_indicator</span>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              카드를 눌러 잡고 위아래로 옮겨보세요. 이 순서대로 나중에 지도 경로에 표시될 예정이에요.
            </p>
          </div>
        )}

        {places.length === 0 && (
          <p className="font-body-md text-on-surface-variant">아직 이 리스트에 저장한 관광지가 없어요.</p>
        )}

        <div className="flex flex-col gap-2">
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
              className={`flex items-center gap-3 bg-surface-container-lowest rounded-xl p-3 border select-none touch-none cursor-grab active:cursor-grabbing ${
                draggingId === place.id ? "opacity-0 pointer-events-none" : "border-outline-variant/30 shadow-sm"
              }`}
            >
              <span className="material-symbols-outlined text-outline-variant shrink-0">drag_indicator</span>
              <span className="w-6 h-6 rounded-full bg-primary text-on-primary text-label-sm font-label-sm font-bold flex items-center justify-center shrink-0">
                {index + 1}
              </span>
              <div className="w-14 h-14 rounded-lg overflow-hidden bg-surface-dim shrink-0">
                {place.image && <img className="w-full h-full object-cover" src={place.image} alt={place.name} draggable={false} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-body-md text-body-md font-bold text-on-surface truncate">{place.name}</p>
                <p className="font-label-sm text-label-sm text-on-surface-variant truncate">{place.category}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
