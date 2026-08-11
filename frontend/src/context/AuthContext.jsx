import { createContext, useCallback, useContext, useEffect, useState } from "react"
import { fetchMe, logout as logoutRequest } from "../services/authService"
import LoginModal from "../components/LoginModal"

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [isModalOpen, setModalOpen] = useState(false)

  useEffect(() => {
    fetchMe()
      .then(setUser)
      .catch(() => setUser(null))
      .finally(() => setLoading(false))
  }, [])

  const openLoginModal = useCallback(() => setModalOpen(true), [])
  const closeLoginModal = useCallback(() => setModalOpen(false), [])

  const logout = useCallback(async () => {
    await logoutRequest()
    setUser(null)
  }, [])

  // admin 로그인은 OAuth와 달리 페이지 리다이렉트 없이 fetch로 끝나서,
  // 로그인 성공 후 이걸 불러 AuthContext의 user 상태를 직접 갱신해줘야 한다.
  const refreshUser = useCallback(async () => {
    const me = await fetchMe()
    setUser(me)
    return me
  }, [])

  const value = {
    user,
    isLoggedIn: Boolean(user),
    loading,
    openLoginModal,
    logout,
    refreshUser,
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
      <LoginModal open={isModalOpen} onClose={closeLoginModal} />
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error("useAuth는 AuthProvider 안에서만 쓸 수 있습니다")
  return ctx
}
