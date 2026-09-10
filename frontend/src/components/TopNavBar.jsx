import { useState } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "../context/AuthContext"
import { useLanguage } from "../context/LanguageContext"

const NAV_ITEMS = [
  { to: "/", key: "home" },
  { to: "/map", key: "map" },
  { to: "/recommend", key: "events" },
  { to: "/bumbim", key: "bumbim" },
  { to: "/profile", key: "profile" },
]

export default function TopNavBar() {
  const { t } = useTranslation("common")
  const { isLoggedIn, openLoginModal } = useAuth()
  const { language, setLanguage, supportedLanguages } = useLanguage()
  const [langMenuOpen, setLangMenuOpen] = useState(false)
  const navigate = useNavigate()

  const handleProfileClick = (e) => {
    if (!isLoggedIn) {
      e.preventDefault()
      openLoginModal()
    }
  }

  return (
    <header className="hidden md:flex bg-surface/80 backdrop-blur-md border-b border-outline-variant justify-between items-center px-container-margin h-16 w-full shrink-0 sticky top-0 z-50">
      <div className="flex items-center gap-8">
        <NavLink to="/" className="font-display-lg text-headline-lg font-bold text-primary flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-3xl filled-icon">water</span>
          NowGo Busan
        </NavLink>
        <nav className="flex gap-6">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === "/"}
              onClick={item.to === "/profile" ? handleProfileClick : undefined}
              className={({ isActive }) =>
                `font-body-md text-body-md py-1 cursor-pointer duration-200 transition-colors ${
                  isActive
                    ? "text-primary font-bold border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-primary"
                }`
              }
            >
              {t(`nav.${item.key}`)}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4 text-on-surface-variant">
        <div className="relative">
          <button
            className="p-2 hover:bg-surface-container-low rounded-full transition-colors"
            type="button"
            onClick={() => setLangMenuOpen((open) => !open)}
          >
            <span className="material-symbols-outlined">language</span>
          </button>
          {langMenuOpen && (
            <div className="absolute right-0 mt-1 bg-surface rounded-lg shadow-lg border border-outline-variant/30 py-1 min-w-[120px] z-50">
              {supportedLanguages.map((lang) => (
                <button
                  key={lang}
                  type="button"
                  onClick={() => {
                    setLanguage(lang)
                    setLangMenuOpen(false)
                  }}
                  className={`w-full text-left px-4 py-2 font-body-md text-body-md hover:bg-surface-container-low transition-colors ${
                    lang === language ? "text-primary font-bold" : "text-on-surface"
                  }`}
                >
                  {t(`language.${lang}`)}
                </button>
              ))}
            </div>
          )}
        </div>
        <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors" type="button">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button
          type="button"
          onClick={() => (isLoggedIn ? navigate("/profile") : openLoginModal())}
          className="p-2 hover:bg-surface-container-low rounded-full transition-colors"
        >
          <span className="material-symbols-outlined">account_circle</span>
        </button>
      </div>
    </header>
  )
}
