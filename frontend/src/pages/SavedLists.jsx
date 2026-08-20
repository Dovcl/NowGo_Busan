// "보관함" — 내가 만든 리스트(구글 지도 "저장된 장소"의 컬렉션 그리드)를 모아 보여준다.
// 카드를 누르면 SavedListDetail로 들어가 순서를 바꿀 수 있다.
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { createList, fetchListItems, fetchMyLists } from "../services/listsService"
import { fetchPlaceById } from "../services/placesService"

export default function SavedLists() {
  const { isLoggedIn, openLoginModal } = useAuth()
  const [lists, setLists] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")
  const navigate = useNavigate()

  const load = () => {
    if (!isLoggedIn) return setLists([])
    fetchMyLists().then(async (rawLists) => {
      const withCover = await Promise.all(
        rawLists.map(async (list) => {
          if (list.itemCount === 0) return { ...list, cover: null }
          const [firstId] = await fetchListItems(list.id)
          const place = firstId != null ? await fetchPlaceById(firstId) : null
          return { ...list, cover: place?.image ?? null }
        })
      )
      setLists(withCover)
    })
  }

  useEffect(load, [isLoggedIn])

  const submitCreate = async (e) => {
    e.preventDefault()
    if (!newName.trim()) return
    await createList(newName.trim())
    setNewName("")
    setCreating(false)
    load()
  }

  if (!isLoggedIn) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4">
        <span className="material-symbols-outlined text-5xl text-outline-variant">folder_open</span>
        <p className="font-body-md text-on-surface-variant">로그인하면 보관함을 볼 수 있어요.</p>
        <button type="button" onClick={openLoginModal} className="text-primary font-body-md font-bold hover:underline">
          로그인하기
        </button>
      </div>
    )
  }

  const totalPlaces = lists?.reduce((sum, l) => sum + l.itemCount, 0) ?? 0

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-5xl mx-auto w-full px-4 md:px-container-margin py-8 pb-24 md:pb-8 flex flex-col gap-section-gap">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-bold text-on-surface">
            보관함
          </h1>
          <p className="font-body-md text-on-surface-variant mt-1">저장한 관광지를 리스트별로 모아봤어요.</p>
        </div>

        <div className="grid grid-cols-2 gap-gutter max-w-md">
          <div className="bg-surface-container-lowest rounded-xl p-card-padding border border-outline-variant/30">
            <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">저장한 장소</p>
            <p className="text-headline-lg font-headline-lg text-primary font-bold">{totalPlaces}</p>
          </div>
          <div className="bg-surface-container-lowest rounded-xl p-card-padding border border-outline-variant/30">
            <p className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-1">리스트</p>
            <p className="text-headline-lg font-headline-lg text-primary font-bold">{lists?.length ?? 0}</p>
          </div>
        </div>

        {lists === null ? (
          <div className="flex justify-center py-8">
            <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-gutter">
            {lists.map((list) => (
              <button
                key={list.id}
                type="button"
                onClick={() => navigate(`/saved/${list.id}`)}
                className="text-left bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all border border-outline-variant/30 group"
              >
                <div className="h-32 w-full relative bg-surface-dim">
                  {list.cover ? (
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                      src={list.cover}
                      alt={list.name}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <span className="material-symbols-outlined text-4xl text-outline-variant">image</span>
                    </div>
                  )}
                  <span className="absolute top-2 left-2 bg-black/50 text-white text-label-sm font-label-sm px-2 py-0.5 rounded-full">
                    {list.itemCount}개
                  </span>
                </div>
                <div className="p-4 flex items-center gap-2">
                  <span
                    className="material-symbols-outlined text-primary"
                    style={list.isDefault ? { fontVariationSettings: "'FILL' 1" } : undefined}
                  >
                    {list.isDefault ? "favorite" : "list"}
                  </span>
                  <h4 className="font-body-md text-body-md font-bold text-on-surface truncate">{list.name}</h4>
                </div>
              </button>
            ))}

            {creating ? (
              <form
                onSubmit={submitCreate}
                className="flex flex-col gap-2 p-card-padding bg-surface-container-lowest rounded-xl border border-dashed border-outline-variant min-h-[176px] justify-center"
              >
                <input
                  autoFocus
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onBlur={() => !newName.trim() && setCreating(false)}
                  placeholder="리스트 이름"
                  className="bg-surface border border-outline-variant rounded-lg px-3 py-2 text-body-md font-body-md focus:outline-none focus:border-primary"
                />
                <button type="submit" className="text-primary font-body-md font-bold self-end">
                  추가
                </button>
              </form>
            ) : (
              <button
                type="button"
                onClick={() => setCreating(true)}
                className="flex flex-col items-center justify-center gap-2 p-card-padding bg-surface-container-lowest rounded-xl border-2 border-dashed border-outline-variant hover:border-primary hover:bg-surface-container-low transition-colors min-h-[176px]"
              >
                <span className="material-symbols-outlined text-3xl text-primary">add_circle</span>
                <span className="font-body-md text-body-md font-bold text-primary">새 리스트 만들기</span>
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
