import { createContext, useCallback, useContext, useEffect, useState } from "react"
import i18n, { STORAGE_KEY, SUPPORTED_LANGUAGES } from "../lib/i18n"

const LanguageContext = createContext(null)

export function LanguageProvider({ children }) {
  const [language, setLanguageState] = useState(i18n.language)

  useEffect(() => {
    document.documentElement.lang = language
  }, [language])

  const setLanguage = useCallback((lang) => {
    if (!SUPPORTED_LANGUAGES.includes(lang)) return
    i18n.changeLanguage(lang)
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // localStorage 접근 불가 시 이번 세션 동안만 언어 유지
    }
    setLanguageState(lang)
  }, [])

  const value = { language, setLanguage, supportedLanguages: SUPPORTED_LANGUAGES }

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error("useLanguage는 LanguageProvider 안에서만 쓸 수 있습니다")
  return ctx
}
