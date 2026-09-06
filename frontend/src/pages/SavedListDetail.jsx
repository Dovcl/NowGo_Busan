// 리스트 하나에 담긴 관광지들. 드래그 순서 변경 UI는 ReorderablePlaceList로
// 공용화되어 있음(MapView 사이드바에서도 같은 컴포넌트를 씀) — 카드를 눌러 잡고
// 위아래로 움직이면 순서가 바뀌는 동작의 자세한 구현은 그 파일 상단 주석 참고.
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { fetchListItems, fetchMyLists, reorderList } from "../services/listsService"
import { fetchPlaceById } from "../services/placesService"
import ReorderablePlaceList from "../components/ReorderablePlaceList"

export default function SavedListDetail() {
  const { listId } = useParams()
  const navigate = useNavigate()
  const [listName, setListName] = useState(null)
  const [places, setPlaces] = useState(null)

  useEffect(() => {
    fetchMyLists().then((lists) => {
      const match = lists.find((l) => String(l.id) === listId)
      setListName(match?.name ?? null)
    })
    fetchListItems(listId)
      .then((contentids) => Promise.all(contentids.map(fetchPlaceById)))
      .then((result) => setPlaces(result.filter(Boolean)))
  }, [listId])

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

        <ReorderablePlaceList
          key={listId}
          places={places}
          onReorder={(next) => {
            setPlaces(next)
            reorderList(listId, next.map((p) => Number(p.id)))
          }}
          onSelectPlace={(place) => navigate(`/place/${place.id}`)}
        />
      </div>
    </div>
  )
}
