import { useEffect, useMemo, useRef, useState } from "react"
import KakaoMap from "../components/KakaoMap"
import PlaceDetailPanel from "../components/PlaceDetailPanel"
import { fetchPlaces } from "../services/placesService"
import { fetchListItems, fetchMyLists } from "../services/listsService"
import { ENV_GROUP_STYLE } from "../lib/envGroup"
import { useAuth } from "../context/AuthContext"

// 사이드바 체크박스용 조금 더 자세한 라벨 — 마커 색상/범례와 같은 env_group4 키를 쓰되
// 문구만 더 풀어서 쓴다 (top pill·범례는 ENV_GROUP_STYLE의 짧은 라벨을 그대로 씀).
const SIDEBAR_LABELS = { 해변: "해변", 산: "자연 (산/공원)", 도심: "문화/역사", 실내: "실내" }
const ALL_GROUPS = Object.keys(ENV_GROUP_STYLE)

export default function MapView() {
  const { isLoggedIn } = useAuth()
  const [places, setPlaces] = useState([])
  const [selectedPlaceId, setSelectedPlaceId] = useState(null)
  const [activeGroups, setActiveGroups] = useState(() => new Set(ALL_GROUPS))
  const [savedLists, setSavedLists] = useState([])
  const [activeRouteListId, setActiveRouteListId] = useState(null)
  const [routePlaces, setRoutePlaces] = useState(null)
  const mapRef = useRef(null)

  useEffect(() => {
    fetchPlaces().then(setPlaces)
  }, [])

  useEffect(() => {
    if (!isLoggedIn) return setSavedLists([])
    fetchMyLists().then(setSavedLists)
  }, [isLoggedIn])

  // 보관함 리스트를 고르면 저장된 순서 그대로 장소를 찾아와 "경로 모드"에 넘긴다.
  useEffect(() => {
    if (activeRouteListId == null) return setRoutePlaces(null)
    fetchListItems(activeRouteListId).then((contentids) => {
      const byId = new Map(places.map((p) => [p.id, p]))
      setRoutePlaces(contentids.map((id) => byId.get(String(id))).filter(Boolean))
    })
  }, [activeRouteListId, places])

  const toggleRouteList = (listId) => {
    setActiveRouteListId((prev) => (prev === listId ? null : listId))
  }

  const filteredPlaces = useMemo(
    () => (activeGroups.size === ALL_GROUPS.length ? places : places.filter((p) => activeGroups.has(p.envGroup4))),
    [places, activeGroups]
  )

  const toggleGroup = (group) => {
    setActiveGroups((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })
  }

  // 전체 다 켜진 상태에서 "전체"를 또 누르면 전부 끄고, 아니면 전부 켠다.
  const toggleAll = () => {
    setActiveGroups((prev) => (prev.size === ALL_GROUPS.length ? new Set() : new Set(ALL_GROUPS)))
  }

  const handleSelectPlace = (place) => {
    setSelectedPlaceId(place.id)
    mapRef.current?.panTo(place.lat, place.lng)
  }

  const handleLocateMe = () => {
    if (!navigator.geolocation) return
    navigator.geolocation.getCurrentPosition((position) => {
      mapRef.current?.panTo(position.coords.latitude, position.coords.longitude)
    })
  }

  return (
    <div className="h-full flex overflow-hidden">
      {/* Sidebar: place detail panel replaces the filter sidebar when a marker is selected */}
      {selectedPlaceId ? (
        <PlaceDetailPanel placeId={selectedPlaceId} onClose={() => setSelectedPlaceId(null)} />
      ) : (
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
              <input
                checked={activeGroups.size === ALL_GROUPS.length}
                onChange={toggleAll}
                className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                type="checkbox"
              />
              <span className="text-on-surface font-body-md text-body-md group-hover:text-primary">전체</span>
            </label>
            {ALL_GROUPS.map((group) => {
              const style = ENV_GROUP_STYLE[group]
              return (
                <label
                  key={group}
                  className="flex items-center gap-3 p-2 rounded-lg hover:bg-surface-container-low cursor-pointer transition-colors group"
                >
                  <input
                    checked={activeGroups.has(group)}
                    onChange={() => toggleGroup(group)}
                    className="w-5 h-5 rounded border-outline-variant text-primary focus:ring-primary"
                    type="checkbox"
                  />
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center"
                    style={{ backgroundColor: `${style.color}30`, color: style.color }}
                  >
                    <span className="material-symbols-outlined text-[14px]">{style.icon}</span>
                  </div>
                  <span className="text-on-surface font-body-md text-body-md group-hover:text-primary">{SIDEBAR_LABELS[group]}</span>
                </label>
              )
            })}
          </div>
        </div>
        {isLoggedIn && savedLists.length > 0 && (
          <div className="p-5 border-b border-outline-variant">
            <h3 className="font-body-md text-body-md font-bold mb-3 flex items-center justify-between">
              <span>보관함</span>
              <span className="material-symbols-outlined text-sm text-outline">bookmark</span>
            </h3>
            <div className="flex flex-col gap-1">
              {savedLists.map((list) => (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => toggleRouteList(list.id)}
                  className={`flex items-center gap-3 p-2 rounded-lg transition-colors text-left ${
                    activeRouteListId === list.id ? "bg-primary-container/10 text-primary" : "hover:bg-surface-container-low text-on-surface"
                  }`}
                >
                  <span className="material-symbols-outlined text-[18px]" style={list.isDefault ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                    {list.isDefault ? "favorite" : "list"}
                  </span>
                  <span className="font-body-md text-body-md flex-1 truncate">{list.name}</span>
                  <span className="font-label-sm text-label-sm text-outline">{list.itemCount}</span>
                </button>
              ))}
            </div>
            {activeRouteListId != null && (
              <button
                type="button"
                onClick={() => setActiveRouteListId(null)}
                className="mt-3 w-full text-center font-label-sm text-label-sm text-primary font-bold hover:underline"
              >
                일반 지도로 돌아가기
              </button>
            )}
          </div>
        )}
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
      )}

      {/* Map area */}
      <div className="flex-1 relative bg-surface-dim">
        <KakaoMap ref={mapRef} places={filteredPlaces} route={routePlaces} onSelectPlace={handleSelectPlace} />

        {activeRouteListId == null ? (
          <div className="absolute top-4 left-4 flex gap-2 z-10 hide-scrollbar overflow-x-auto max-w-[calc(100%-80px)]">
            <button
              type="button"
              onClick={toggleAll}
              className={`px-4 py-2 rounded-full font-label-sm text-label-sm font-bold shadow-md whitespace-nowrap transition-colors ${
                activeGroups.size === ALL_GROUPS.length ? "bg-primary text-white" : "bg-surface text-on-surface border border-outline-variant hover:bg-surface-container-low"
              }`}
            >
              전체
            </button>
            {ALL_GROUPS.map((group) => {
              const style = ENV_GROUP_STYLE[group]
              const active = activeGroups.has(group) && activeGroups.size !== ALL_GROUPS.length
              return (
                <button
                  key={group}
                  type="button"
                  onClick={() => toggleGroup(group)}
                  className={`px-4 py-2 rounded-full font-label-sm text-label-sm shadow-md whitespace-nowrap transition-colors flex items-center gap-1 border ${
                    active ? "bg-primary text-white border-primary" : "bg-surface text-on-surface border-outline-variant hover:bg-surface-container-low"
                  }`}
                >
                  <span className="material-symbols-outlined text-[16px]" style={{ color: active ? undefined : style.color }}>
                    {style.icon}
                  </span>
                  {style.label}
                </button>
              )
            })}
          </div>
        ) : (
          <div className="absolute top-4 left-4 z-10 bg-surface rounded-full pl-4 pr-2 py-2 shadow-md border border-outline-variant flex items-center gap-2">
            <span className="material-symbols-outlined text-primary text-[18px]">route</span>
            <span className="font-label-sm text-label-sm font-bold text-on-surface whitespace-nowrap">
              {savedLists.find((l) => l.id === activeRouteListId)?.name} 경로 보는 중
            </span>
            <button
              type="button"
              onClick={() => setActiveRouteListId(null)}
              className="w-7 h-7 rounded-full hover:bg-surface-container-low flex items-center justify-center shrink-0"
            >
              <span className="material-symbols-outlined text-[16px]">close</span>
            </button>
          </div>
        )}

        <div className="absolute right-4 top-4 flex flex-col gap-2 z-10">
          <div className="bg-surface rounded-lg shadow-md border border-outline-variant flex flex-col overflow-hidden">
            <button
              type="button"
              onClick={() => mapRef.current?.zoomIn()}
              className="w-10 h-10 flex items-center justify-center hover:bg-surface-container-low text-on-surface transition-colors border-b border-outline-variant"
            >
              <span className="material-symbols-outlined">add</span>
            </button>
            <button
              type="button"
              onClick={() => mapRef.current?.zoomOut()}
              className="w-10 h-10 flex items-center justify-center hover:bg-surface-container-low text-on-surface transition-colors"
            >
              <span className="material-symbols-outlined">remove</span>
            </button>
          </div>
          <button
            type="button"
            onClick={handleLocateMe}
            className="w-10 h-10 bg-surface rounded-lg shadow-md border border-outline-variant flex items-center justify-center hover:bg-surface-container-low text-primary transition-colors"
          >
            <span className="material-symbols-outlined">my_location</span>
          </button>
        </div>

        {activeRouteListId == null && (
          <div className="absolute bottom-6 left-1/2 -translate-x-1/2 glass-panel rounded-full px-6 py-3 shadow-lg flex items-center gap-6 z-10 whitespace-nowrap">
            {Object.values(ENV_GROUP_STYLE).map((style) => (
              <div key={style.label} className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: style.color }} />
                <span className="font-label-sm text-label-sm text-on-surface font-bold">{style.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
