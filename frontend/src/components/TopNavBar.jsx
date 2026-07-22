import { NavLink } from "react-router-dom"

const NAV_ITEMS = [
  { to: "/", label: "홈" },
  { to: "/map", label: "지도" },
  { to: "/recommend", label: "추천" },
  { to: "/dashboard", label: "대시보드" },
  { to: "/profile", label: "프로필" },
]

export default function TopNavBar() {
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
              className={({ isActive }) =>
                `font-body-md text-body-md py-1 cursor-pointer duration-200 transition-colors ${
                  isActive
                    ? "text-primary font-bold border-b-2 border-primary"
                    : "text-on-surface-variant hover:text-primary"
                }`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>
      <div className="flex items-center gap-4 text-on-surface-variant">
        <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors" type="button">
          <span className="material-symbols-outlined">language</span>
        </button>
        <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors" type="button">
          <span className="material-symbols-outlined">notifications</span>
        </button>
        <button className="p-2 hover:bg-surface-container-low rounded-full transition-colors" type="button">
          <span className="material-symbols-outlined">account_circle</span>
        </button>
      </div>
    </header>
  )
}
