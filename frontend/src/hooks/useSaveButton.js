// "저장" 버튼 하나가 필요로 하는 상태: 로그인 게이트, 저장 여부(어느 리스트에든
// 담겨있으면 true), 모달 열림/닫힘. PlaceDetailPanel과 PlaceDetail이 공유한다.
import { useCallback, useEffect, useState } from "react"
import { useAuth } from "../context/AuthContext"
import { fetchMyLists } from "../services/listsService"

export function useSaveButton(placeId) {
  const { isLoggedIn, openLoginModal } = useAuth()
  const [isSaved, setIsSaved] = useState(false)
  const [showModal, setShowModal] = useState(false)

  const refresh = useCallback(() => {
    if (!isLoggedIn || placeId == null) return setIsSaved(false)
    fetchMyLists(placeId).then((lists) => setIsSaved(lists.some((l) => l.contains)))
  }, [isLoggedIn, placeId])

  useEffect(refresh, [refresh])

  const handleClick = () => {
    if (!isLoggedIn) return openLoginModal()
    setShowModal(true)
  }

  // 모달에서 체크/해제한 결과를 버튼 상태에 반영하려면 닫힐 때 다시 조회해야 한다
  // (모달이 매번 실시간으로 부모 상태를 올려보내게 하는 대신, 닫을 때 한 번만 새로 묻는 편이 더 단순함).
  const closeModal = () => {
    setShowModal(false)
    refresh()
  }

  return { isSaved, showModal, handleClick, closeModal }
}
