// 구글 지도의 "목록에 저장" 팝업 재현. 체크박스로 여러 리스트에 동시에 담을 수 있고,
// "새 목록"으로 그 자리에서 리스트를 만들어 바로 담을 수 있다.
import { useEffect, useState } from "react"
import { addToList, createList, fetchMyLists, removeFromList } from "../services/listsService"

export default function SaveToListModal({ contentid, onClose }) {
  const [lists, setLists] = useState(null)
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState("")

  useEffect(() => {
    fetchMyLists(contentid).then(setLists)
  }, [contentid])

  const toggle = async (list) => {
    setLists((prev) => prev.map((l) => (l.id === list.id ? { ...l, contains: !l.contains, itemCount: l.itemCount + (l.contains ? -1 : 1) } : l)))
    if (list.contains) {
      await removeFromList(list.id, contentid)
    } else {
      await addToList(list.id, contentid)
    }
  }

  const submitNewList = async () => {
    if (!newName.trim()) return
    const list = await createList(newName.trim())
    await addToList(list.id, contentid)
    setLists((prev) => [...prev, { ...list, contains: true, itemCount: 1 }])
    setNewName("")
    setCreating(false)
  }

  // "완료"는 원래 그냥 닫기만 했는데, 입력창에 이름을 쳐두고 (작은 "추가" 링크 대신)
  // 익숙한 큰 버튼인 "완료"를 누르면 그 입력이 그냥 버려지는 게 실제 버그였다 —
  // 닫기 전에 미완료 입력이 있으면 먼저 반영한다.
  const handleDone = async () => {
    if (creating && newName.trim()) await submitNewList()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={handleDone}>
      <div
        className="bg-surface-container-lowest rounded-xl shadow-2xl w-full max-w-sm max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-card-padding pb-2">
          <h2 className="font-body-md text-body-md font-bold">목록에 저장</h2>
          <button type="button" onClick={handleDone} className="w-8 h-8 rounded-full hover:bg-surface-container-low flex items-center justify-center">
            <span className="material-symbols-outlined">close</span>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-card-padding">
          {lists === null && (
            <div className="py-8 flex justify-center">
              <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
            </div>
          )}

          {lists?.map((list) => (
            <label
              key={list.id}
              className="flex items-center gap-3 py-3 cursor-pointer hover:bg-surface-container-low -mx-2 px-2 rounded-lg transition-colors"
            >
              <div
                className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
                  list.isDefault ? "bg-error/10 text-error" : "bg-surface-container text-on-surface"
                }`}
              >
                <span className="material-symbols-outlined text-[20px]" style={list.isDefault ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                  {list.isDefault ? "favorite" : "list"}
                </span>
              </div>
              <div className="flex-1">
                <p className="text-body-md font-body-md font-bold text-on-surface">{list.name}</p>
                <p className="text-label-sm font-label-sm text-on-surface-variant">{list.itemCount}개 장소</p>
              </div>
              <input
                type="checkbox"
                checked={list.contains}
                onChange={() => toggle(list)}
                className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
              />
            </label>
          ))}

          {creating ? (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                submitNewList()
              }}
              className="flex items-center gap-2 py-3"
            >
              <input
                autoFocus
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onBlur={() => !newName.trim() && setCreating(false)}
                placeholder="리스트 이름"
                className="flex-1 bg-surface border border-outline-variant rounded-lg px-3 py-2 text-body-md font-body-md focus:outline-none focus:border-primary"
              />
              <button type="submit" className="text-primary font-body-md font-bold px-2">
                추가
              </button>
            </form>
          ) : (
            <button
              type="button"
              onClick={() => setCreating(true)}
              className="w-full flex items-center gap-3 py-3 hover:bg-surface-container-low -mx-2 px-2 rounded-lg transition-colors"
            >
              <div className="w-9 h-9 rounded-lg bg-surface-container flex items-center justify-center">
                <span className="material-symbols-outlined text-[20px]">add</span>
              </div>
              <span className="text-body-md font-body-md font-bold text-primary">새 목록</span>
            </button>
          )}
        </div>

        <div className="p-card-padding pt-3">
          <button type="button" onClick={handleDone} className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-colors">
            완료
          </button>
        </div>
      </div>
    </div>
  )
}
