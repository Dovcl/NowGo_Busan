// 리스트 하나에 담긴 관광지들. 드래그 순서 변경 UI는 ReorderablePlaceList로
// 공용화되어 있음(MapView 사이드바에서도 같은 컴포넌트를 씀) — 카드를 눌러 잡고
// 위아래로 움직이면 순서가 바뀌는 동작의 자세한 구현은 그 파일 상단 주석 참고.
import { useEffect, useState } from "react"
import { useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { fetchListItems, fetchMyLists, reorderList, removeFromList, renameList, deleteList } from "../services/listsService"
import { fetchPlaceById } from "../services/placesService"
import ReorderablePlaceList from "../components/ReorderablePlaceList"

export default function SavedListDetail() {
  const { t, i18n } = useTranslation("saved")
  const { listId } = useParams()
  const navigate = useNavigate()
  const [list, setList] = useState(null)
  const [places, setPlaces] = useState(null)
  const [renaming, setRenaming] = useState(false)
  const [nameDraft, setNameDraft] = useState("")

  useEffect(() => {
    fetchMyLists().then((lists) => {
      setList(lists.find((l) => String(l.id) === listId) ?? null)
    })
    fetchListItems(listId)
      .then((contentids) => Promise.all(contentids.map(fetchPlaceById)))
      .then((result) => setPlaces(result.filter(Boolean)))
  }, [listId, i18n.language])

  const startRename = () => {
    setNameDraft(list.name)
    setRenaming(true)
  }

  const submitRename = async (e) => {
    e.preventDefault()
    const name = nameDraft.trim()
    if (!name || name === list.name) return setRenaming(false)
    const updated = await renameList(listId, name)
    setList((prev) => ({ ...prev, name: updated.name }))
    setRenaming(false)
  }

  // 담긴 장소가 많을수록 되돌리기 부담이 큰 동작이라(항목 하나 빼기와 달리 리스트
  // 전체가 사라짐), 커스텀 모달 없이도 확실히 막아주는 네이티브 confirm을 쓴다.
  const handleDeleteList = async () => {
    if (!window.confirm(t("deleteListConfirm", { name: list.name }))) return
    await deleteList(listId)
    navigate("/saved")
  }

  if (places === null || list === null) return null

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
          <div className="flex-1 min-w-0">
            {renaming ? (
              <form onSubmit={submitRename} className="flex items-center gap-2">
                <input
                  autoFocus
                  value={nameDraft}
                  onChange={(e) => setNameDraft(e.target.value)}
                  onBlur={() => setRenaming(false)}
                  placeholder={t("listNamePlaceholder")}
                  className="flex-1 min-w-0 bg-surface border border-outline-variant rounded-lg px-3 py-1.5 font-headline-lg-mobile text-headline-lg-mobile md:text-headline-lg focus:outline-none focus:border-primary"
                />
                <button type="submit" onMouseDown={(e) => e.preventDefault()} className="text-primary font-body-md font-bold shrink-0">
                  {t("done")}
                </button>
              </form>
            ) : (
              <div className="flex items-center gap-2">
                <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-bold text-on-surface truncate">
                  {list.name}
                </h1>
                {!list.isDefault && (
                  <button
                    type="button"
                    onClick={startRename}
                    className="w-8 h-8 rounded-full hover:bg-surface-container-low flex items-center justify-center shrink-0"
                  >
                    <span className="material-symbols-outlined text-[18px] text-on-surface-variant">edit</span>
                  </button>
                )}
              </div>
            )}
            <p className="font-label-sm text-label-sm text-on-surface-variant">{t("placeCount", { count: places.length })}</p>
          </div>
          {!list.isDefault && (
            <button
              type="button"
              onClick={handleDeleteList}
              className="w-10 h-10 rounded-full hover:bg-error-container/20 flex items-center justify-center shrink-0"
            >
              <span className="material-symbols-outlined text-error">delete</span>
            </button>
          )}
        </div>

        {places.length > 0 && (
          <div className="bg-primary-container/10 border border-primary/20 rounded-xl p-4 flex items-center gap-3">
            <span className="material-symbols-outlined text-primary">drag_indicator</span>
            <p className="font-label-sm text-label-sm text-on-surface-variant">
              {t("dragHint")}
            </p>
          </div>
        )}

        {places.length === 0 && (
          <p className="font-body-md text-on-surface-variant">{t("emptyList")}</p>
        )}

        <ReorderablePlaceList
          key={listId}
          places={places}
          onReorder={(next) => {
            setPlaces(next)
            reorderList(listId, next.map((p) => Number(p.id)))
          }}
          onSelectPlace={(place) => navigate(`/place/${place.id}`)}
          onDelete={(place, next) => {
            setPlaces(next)
            removeFromList(listId, Number(place.id))
          }}
        />
      </div>
    </div>
  )
}
