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

  const value = {
    user,
    isLoggedIn: Boolean(user),
    loading,
    openLoginModal,
    logout,
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
