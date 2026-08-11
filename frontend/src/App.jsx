import { Routes, Route } from "react-router-dom"
import AppLayout from "./layouts/AppLayout"
import Home from "./pages/Home"
import MapView from "./pages/MapView"
import PulseDashboard from "./pages/PulseDashboard"
import PlaceDetail from "./pages/PlaceDetail"
import Profile from "./pages/Profile"
import ComingSoon from "./pages/ComingSoon"
import AdminLogin from "./pages/AdminLogin"

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Home />} />
        <Route path="/map" element={<MapView />} />
        <Route path="/dashboard" element={<PulseDashboard />} />
        <Route path="/place/:placeId" element={<PlaceDetail />} />
        <Route path="/recommend" element={<ComingSoon title="Recommend" />} />
        <Route path="/profile" element={<Profile />} />
      </Route>
      {/* 메인 네비게이션에 안 걸어둠 — 관리자만 URL을 직접 알고 접근 */}
      <Route path="/admin/login" element={<AdminLogin />} />
    </Routes>
  )
}

export default App
