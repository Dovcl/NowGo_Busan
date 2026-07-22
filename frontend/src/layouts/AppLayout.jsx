import { Outlet } from "react-router-dom"
import TopNavBar from "../components/TopNavBar"
import BottomNavBar from "../components/BottomNavBar"

export default function AppLayout() {
  return (
    <div className="bg-background text-on-background font-body-md h-screen flex flex-col overflow-hidden">
      <TopNavBar />
      <main className="flex-1 min-h-0 flex flex-col">
        <Outlet />
      </main>
      <BottomNavBar />
    </div>
  )
}
