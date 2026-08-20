// 리스트 하나에 담긴 관광지들. 카드를 누르고 있으면 잡히고(grab), 위아래로 움직이면
// 순서가 바뀌고, 손을 떼면 그 자리에 놓인다(drop) — 손을 떼기 전까진 계속 포인터를
// 따라온다. 살짝 눌렀다 바로 떼면(움직임이 거의 없으면) 드래그 대신 상세페이지로 이동.
//
// Pointer Events로 구현했다(HTML5 draggable 아님): 이 앱은 모바일 PWA인데 HTML5
// draggable은 터치에서 아예 동작하지 않는다. setPointerCapture로 손가락이 카드
// 밖으로 나가도 move/up 이벤트를 계속 받는다.
//
// 드래그 중인 카드는 position:fixed로 완전히 레이아웃 밖으로 빼서 top을 포인터
// 위치에 그대로 맞춘다 — "몇 칸 밀렸는지"를 계산해서 보정하는 대신 애초에 흐름에서
// 빼버리니 보정 오차가 생길 여지가 없다. 밀려나는 다른 카드들과, 카드를 집어드는/
// 내려놓는 순간의 레이아웃 변화는 FLIP 기법(변경 직전 위치를 기억해뒀다가 그 차이만큼
// 역방향으로 즉시 옮긴 뒤 transition으로 0으로 되돌림)으로 스르륵 처리한다.
import { useLayoutEffect, useRef, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { fetchListItems, fetchMyLists, reorderList } from "../services/listsService"
import { fetchPlaceById } from "../services/placesService"

const GAP_PX = 8 // 컨테이너의 gap-2와 맞춘 값
const DRAG_THRESHOLD = 6 // 이만큼 움직여야 "탭"이 아니라 "드래그"로 인정
const SETTLE_MS = 200
const SETTLE_TRANSITION = `top ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)`
const FLIP_TRANSITION = `transform ${SETTLE_MS}ms cubic-bezier(0.2, 0, 0, 1)`

export default function SavedListDetail() {
  const { listId } = useParams()
  const navigate = useNavigate()
  const [listName, setListName] = useState(null)
  const [places, setPlaces] = useState(null)
  const [draggingId, setDraggingId] = useState(null)

  const placesRef = useRef(null)
  const containerRef = useRef(null)
  const rowRefs = useRef({}) // placeId -> row DOM node
  const prevRectsRef = useRef({}) // FLIP용: 재정렬 직전 위치 스냅샷
  const gestureRef = useRef(null) // 진행 중인 포인터 제스처 (null이면 없음)

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

  // 재정렬(setPlaces)로 places가 바뀔 때마다: 드래그 중인 카드를 뺀 나머지가 화면에서
  // 갑자기 점프해 보이지 않도록, 직전 위치와의 차이만큼 되돌렸다가 애니메이션으로 정리한다.
  useLayoutEffect(() => {
    animateFlipFromSnapshot(prevRectsRef.current, gestureRef.current?.id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [places])

  function animateFlipFromSnapshot(prevRects, excludeId) {
    const excludeStr = excludeId != null ? String(excludeId) : null
    for (const [id, el] of Object.entries(rowRefs.current)) {
      if (!el || id === excludeStr) continue
      const prev = prevRects[id]
      if (!prev) continue
      const next = el.getBoundingClientRect()
      const deltaY = prev.top - next.top
      if (Math.abs(deltaY) > 0.5) {
        el.style.transition = "none"
        el.style.transform = `translateY(${deltaY}px)`
        requestAnimationFrame(() => {
          el.style.transition = FLIP_TRANSITION
          el.style.transform = ""
        })
      }
    }
  }

  function captureRowRects() {
    const rects = {}
    for (const [id, el] of Object.entries(rowRefs.current)) {
      if (el) rects[id] = el.getBoundingClientRect()
    }
    return rects
  }

  // 카드를 흐름에서 완전히 빼서(position: fixed) 포인터를 그대로 따라가게 만든다.
  // 이 순간 나머지 카드들이 빈자리를 메우려고 즉시 당겨지는데, 그 이동도 FLIP으로 감싼다.
  function liftRowOutOfFlow(placeId, rect) {
    const before = captureRowRects()
    const rowEl = rowRefs.current[placeId]
    if (rowEl) {
      rowEl.style.position = "fixed"
      rowEl.style.left = `${rect.left}px`
      rowEl.style.top = `${rect.top}px`
      rowEl.style.width = `${rect.width}px`
      rowEl.style.margin = "0"
      rowEl.style.zIndex = "50"
      rowEl.style.transition = "none"
    }
    requestAnimationFrame(() => animateFlipFromSnapshot(before, placeId))
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
      liftRowOutOfFlow(g.id, g.rect)
    }

    const rowEl = rowRefs.current[g.id]
    if (rowEl) rowEl.style.top = `${g.rect.top + deltaY}px`

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
    }
  }

  // 최종적으로 이 카드가 자연스럽게 놓여야 할 위치를 실제 형제 카드 위치를 재서 구한다
  // (근사 계산이 아니라 실측이라 오차가 쌓이지 않는다).
  function measureNaturalTop(g) {
    const order = placesRef.current ?? []
    if (g.currentIndex === 0) return containerRef.current?.getBoundingClientRect().top ?? g.rect.top
    const prevPlace = order[g.currentIndex - 1]
    const prevEl = prevPlace && rowRefs.current[prevPlace.id]
    if (prevEl) return prevEl.getBoundingClientRect().bottom + GAP_PX
    return g.rect.top + (g.currentIndex - g.startIndex) * g.rowHeight
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

    setDraggingId(null)
    const rowEl = rowRefs.current[g.id]
    if (rowEl) {
      const finalTop = measureNaturalTop(g)
      rowEl.style.transition = SETTLE_TRANSITION
      rowEl.style.top = `${finalTop}px`
      window.setTimeout(() => {
        if (!rowEl) return
        rowEl.style.position = ""
        rowEl.style.left = ""
        rowEl.style.top = ""
        rowEl.style.width = ""
        rowEl.style.margin = ""
        rowEl.style.zIndex = ""
        rowEl.style.transition = ""
      }, SETTLE_MS)
    }
    reorderList(listId, (placesRef.current ?? []).map((p) => Number(p.id)))
  }

  const cancelDrag = () => {
    const g = gestureRef.current
    gestureRef.current = null
    if (!g?.dragging) return
    setDraggingId(null)
    const rowEl = rowRefs.current[g.id]
    if (rowEl) {
      rowEl.style.position = ""
      rowEl.style.left = ""
      rowEl.style.top = ""
      rowEl.style.width = ""
      rowEl.style.margin = ""
      rowEl.style.zIndex = ""
      rowEl.style.transition = ""
    }
  }

  // 안전망: 포인터 캡처가 (드물게) 엉뚱한 요소로 새거나 브라우저가 탭 전환 등으로
  // 제스처를 끊어버려도, 카드가 fixed 상태로 영영 붙어있지 않도록 window 레벨에서도 감시한다.
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

        <div ref={containerRef} className="flex flex-col gap-2">
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
                draggingId === place.id ? "border-primary shadow-xl scale-[1.02]" : "border-outline-variant/30 shadow-sm"
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
