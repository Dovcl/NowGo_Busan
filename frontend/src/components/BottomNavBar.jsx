import { NavLink } from "react-router-dom"

const NAV_ITEMS = [
  { to: "/", label: "Home", icon: "home" },
  { to: "/map", label: "Map", icon: "map" },
  { to: "/recommend", label: "Recommend", icon: "star" },
  { to: "/dashboard", label: "Dashboard", icon: "dashboard" },
  { to: "/profile", label: "Profile", icon: "person" },
]

export default function BottomNavBar() {
  return (
    <nav className="md:hidden fixed bottom-0 left-0 w-full flex justify-around items-center h-16 px-4 pb-safe bg-surface-container-lowest shadow-[0_-4px_20px_rgba(0,0,0,0.05)] rounded-t-xl z-50 border-t border-outline-variant/20 shrink-0">
      {NAV_ITEMS.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.to === "/"}
          className={({ isActive }) =>
            `flex flex-col items-center justify-center transition-transform active:scale-95 ${
              isActive
                ? "text-primary font-bold bg-primary-container/20 rounded-xl px-3 py-1"
                : "text-on-surface-variant"
            }`
          }
        >
          {({ isActive }) => (
            <>
              <span className={`material-symbols-outlined text-xl mb-1 ${isActive ? "filled-icon" : ""}`}>
                {item.icon}
              </span>
              <span className="font-label-sm text-label-sm">{item.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
