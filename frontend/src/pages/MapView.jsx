import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchMapMarkers } from "../services/scoreService"
import { STATUS } from "../lib/status"

const FILTERS = [
  { icon: "waves", label: "해변", iconClass: "text-primary" },
  { icon: "park", label: "자연", iconClass: "text-secondary" },
  { icon: "storefront", label: "실내", iconClass: "text-tertiary" },
  { icon: "palette", label: "문화", iconClass: "text-semantic-caution" },
]

const TYPE_FILTERS = [
  { icon: "waves", label: "해변", bg: "bg-primary-fixed-dim/30", text: "text-primary" },
  { icon: "park", label: "자연 (산/공원)", bg: "bg-secondary-fixed-dim/30", text: "text-secondary" },
  { icon: "museum", label: "문화/역사", bg: "bg-tertiary-fixed-dim/30", text: "text-tertiary" },
  { icon: "storefront", label: "실내", bg: "bg-surface-variant", text: "text-on-surface-variant" },
]

export default function MapView() {
  const [markers, setMarkers] = useState([])

  useEffect(() => {
    fetchMapMarkers().then(setMarkers)
  }, [])

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar */}
      <aside className="w-80 bg-surface-container-lowest shadow-[0_4px_20px_rgba(0,0,0,0.05)] z-10 flex-col overflow-y-auto border-r border-outline-variant shrink-0 hidden md:flex">
        <div className="p-5 border-b border-outline-variant">
          <h2 className="font-body-md text-body-md font-bold mb-4">관광지 검색</h2>
          <div className="relative w-full">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant">
              search
            </span>
            <input
              className="w-full bg-surface border border-outline-variant rounded-lg pl-10 pr-4 py-3 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary transition-all text-body-md font-body-md placeholder:text-outline"
              placeholder="해운대, 광안리 등..."
              type="text"
            />
          </div>
        </div>
        <div className="p-5 border-b border-outline-variant">
          <h3 className="font-body-md text-body-md font-bold mb-3 flex items-center justify-between">
            <span>관광지 유형</span>
            <span className="material-symbols-outlined text-sm text-outline">tune</span>
          </h3>
          <div className="flex flex-col gap-2">
            <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors group">
              <input defaultChecked className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
              <span className="text-on-surface font-body-md text-body-md group-hover:text-primary">전체</span>
            </label>
            {TYPE_FILTERS.map((f) => (
              <label key={f.label} className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors group">
                <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
                <div className={`w-6 h-6 rounded-full ${f.bg} flex items-center justify-center ${f.text}`}>
                  <span className="material-symbols-outlined text-[14px]">{f.icon}</span>
                </div>
                <span className="text-on-surface font-body-md text-body-md group-hover:text-primary">{f.label}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="p-5">
          <h3 className="font-body-md text-body-md font-bold mb-3">정렬 기준</h3>
          <div className="flex flex-col gap-3">
            {["NowGo Score 순", "거리 순", "혼잡도 순", "이름 순"].map((label, i) => (
              <label key={label} className="flex items-center gap-3 cursor-pointer group">
                <input defaultChecked={i === 0} className="w-5 h-5 border-outline-variant text-primary focus:ring-primary" name="sort" type="radio" />
                <span className="text-on-surface font-body-md text-body-md group-hover:text-primary">{label}</span>
              </label>
            ))}
          </div>
          <div className="mt-6 pt-6 border-t border-outline-variant">
            <label className="flex items-center justify-between cursor-pointer">
              <span className="text-on-surface font-body-md text-body-md">위험 관광지만 보기</span>
              <input className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary" type="checkbox" />
            </label>
          </div>
        </div>
      </aside>

      {/* Map area */}
      <div className="flex-1 relative bg-surface-dim">
        <div
          className="absolute inset-0 w-full h-full bg-cover bg-center opacity-80"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCloLVo6vz7IOjyOCA9Y2dQj04czeyzpF24hyAL0Y0bMcWI7ecrO2ajWxEj7pcwTB-0H4ZN8g5_uFxilY4Yv15r9NOcB2GmJEqGalnLr5PZ5GWykUCyj5uY6JcZ4OLoJgnj4yTFMtNZjgn-eUFMyc45geMjBTZQLtoAHPtv1oBBDu7X7IzLqRrFGYC42CX1Vj0jk30OUTAwXI8PTtixBH_iLcekMGi2B17zliCDj_wvGYLJz7o-rTzK')",
          }}
        />

        <div className="absolute top-4 left-4 flex gap-2 z-10 hide-scrollbar overflow-x-auto max-w-[calc(100%-80px)]">
          <button type="button" className="bg-primary text-white px-4 py-2 rounded-full font-label-sm text-label-sm font-bold shadow-md whitespace-nowrap">
            전체
          </button>
          {FILTERS.map((f) => (
            <button
              key={f.label}
              type="button"
              className="bg-surface text-on-surface px-4 py-2 rounded-full font-label-sm text-label-sm shadow-md whitespace-nowrap hover:bg-surface-container-low transition-colors flex items-center gap-1 border border-outline-variant"
            >
              <span className={`material-symbols-outlined text-[16px] ${f.iconClass}`}>{f.icon}</span> {f.label}
            </button>
          ))}
        </div>

        {markers.map((marker) => {
          const status = STATUS[marker.status]
          const pin = (
            <div className={`w-8 h-8 rounded-full ${status.bg} text-white flex items-center justify-center font-bold text-sm border-2 border-white shadow-md z-10 hover:scale-110 transition-transform`}>
              {marker.id}
            </div>
          )
          const markerClassName =
            "absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center group cursor-pointer"
          const tooltip = marker.name && (
            <div className="bg-surface px-2 py-1 rounded shadow-lg text-xs font-bold mb-1 opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap text-on-surface z-20">
              {marker.name}
            </div>
          )
          return marker.placeId ? (
            <Link
              key={marker.id}
              to={`/place/${marker.placeId}`}
              className={markerClassName}
              style={{ top: marker.top, left: marker.left }}
            >
              {tooltip}
              {pin}
            </Link>
          ) : (
            <div key={marker.id} className={markerClassName} style={{ top: marker.top, left: marker.left }}>
              {tooltip}
              {pin}
            </div>
          )
        })}

        <div className="absolute right-4 top-4 flex flex-col gap-2 z-10">
          <div className="bg-surface rounded-lg shadow-md border border-outline-variant flex flex-col overflow-hidden">
            <button type="button" className="w-10 h-10 flex items-center justify-center hover:bg-surface-container-low text-on-surface transition-colors border-b border-outline-variant">
              <span className="material-symbols-outlined">add</span>
            </button>
            <button type="button" className="w-10 h-10 flex items-center justify-center hover:bg-surface-container-low text-on-surface transition-colors">
              <span className="material-symbols-outlined">remove</span>
            </button>
          </div>
          <button type="button" className="w-10 h-10 bg-surface rounded-lg shadow-md border border-outline-variant flex items-center justify-center hover:bg-surface-container-low text-primary transition-colors">
            <span className="material-symbols-outlined">my_location</span>
          </button>
        </div>

        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass-panel rounded-full px-6 py-3 shadow-lg flex items-center gap-6 z-10 whitespace-nowrap">
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-semantic-safe" />
            <span className="font-label-sm text-label-sm text-on-surface font-bold">좋음 (80~100)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-semantic-caution" />
            <span className="font-label-sm text-label-sm text-on-surface font-bold">주의 (60~79)</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-3 h-3 rounded-full bg-semantic-danger" />
            <span className="font-label-sm text-label-sm text-on-surface font-bold">위험 (0~59)</span>
          </div>
        </div>
      </div>
    </div>
  )
}
