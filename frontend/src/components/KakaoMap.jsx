import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { useKakaoMap } from "../hooks/useKakaoMap"
import { ENV_GROUP_STYLE, DEFAULT_ENV_GROUP_STYLE } from "../lib/envGroup"
import { clusterPlaces } from "../lib/clusterPlaces"

const BUSAN_CENTER = { lat: 35.1796, lng: 129.0756 }
const FADE_MS = 250

// 관광지 1곳짜리 핀: 환경유형별 색깔 원 + 아이콘. 클릭하면 상세페이지로 이동.
// fadeIn은 경로 모드에서 돌아왔을 때만 true — 매 zoom마다 깜빡이지 않게 평소엔 즉시 그린다.
function createPinOverlay(kakao, map, place, onSelectPlace, fadeIn) {
  const style = ENV_GROUP_STYLE[place.envGroup4] ?? DEFAULT_ENV_GROUP_STYLE

  const content = document.createElement("div")
  content.className = `w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white cursor-pointer hover:scale-110 transition-transform ${
    fadeIn ? "opacity-0" : ""
  }`
  content.style.backgroundColor = style.color
  content.style.transition = fadeIn ? `opacity ${FADE_MS}ms` : ""
  content.innerHTML = `<span class="material-symbols-outlined text-[16px]">${style.icon}</span>`
  content.title = place.name
  content.addEventListener("click", () => onSelectPlace?.(place))

  const overlay = new kakao.maps.CustomOverlay({
    map,
    position: new kakao.maps.LatLng(place.lat, place.lng),
    content,
    yAnchor: 0.5,
  })
  if (fadeIn) requestAnimationFrame(() => { content.style.opacity = "1" })
  return { overlay, content }
}

// 여러 관광지가 겹친 자리에 대신 그리는 숫자 배지. 클릭하면 그 지점으로 확대해서 펼쳐 보여준다.
function createClusterOverlay(kakao, map, cluster, fadeIn) {
  const content = document.createElement("div")
  content.className = `min-w-[40px] h-10 px-2 rounded-full flex items-center justify-center text-white font-bold shadow-md border-2 border-white cursor-pointer bg-primary hover:scale-110 transition-transform ${
    fadeIn ? "opacity-0" : ""
  }`
  content.style.transition = fadeIn ? `opacity ${FADE_MS}ms` : ""
  content.textContent = String(cluster.places.length)
  content.addEventListener("click", () => {
    map.setLevel(map.getLevel() - 2, { anchor: new kakao.maps.LatLng(cluster.lat, cluster.lng) })
  })

  const overlay = new kakao.maps.CustomOverlay({
    map,
    position: new kakao.maps.LatLng(cluster.lat, cluster.lng),
    content,
    yAnchor: 0.5,
  })
  if (fadeIn) requestAnimationFrame(() => { content.style.opacity = "1" })
  return { overlay, content }
}

// 보관함 "경로 모드" 핀: 카테고리 색 대신 저장한 순서 번호를 보여준다.
function createRouteOverlay(kakao, map, place, index, onSelectPlace) {
  const content = document.createElement("div")
  content.className =
    "w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white cursor-pointer bg-primary font-bold text-[13px] hover:scale-110 transition-transform opacity-0"
  content.style.transition = `opacity ${FADE_MS}ms`
  content.textContent = String(index + 1)
  content.title = place.name
  content.addEventListener("click", () => onSelectPlace?.(place))

  const overlay = new kakao.maps.CustomOverlay({
    map,
    position: new kakao.maps.LatLng(place.lat, place.lng),
    content,
    yAnchor: 0.5,
  })
  requestAnimationFrame(() => { content.style.opacity = "1" })
  return { overlay, content }
}

// content를 스르륵 지운 뒤(FADE_MS) 지도에서 제거 — 순간적으로 핀이 뚝 사라지지 않게.
function fadeOutAndRemove(list) {
  if (list.length === 0) return
  list.forEach(({ content }) => {
    content.style.transition = `opacity ${FADE_MS}ms`
    content.style.opacity = "0"
  })
  window.setTimeout(() => list.forEach(({ overlay }) => overlay.setMap(null)), FADE_MS)
}

const KakaoMap = forwardRef(function KakaoMap({ places, onSelectPlace, route }, ref) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const placeOverlaysRef = useRef([])
  const routeOverlaysRef = useRef([])
  const routePolylineRef = useRef(null)
  const wasInRouteModeRef = useRef(false)
  const { kakao, error } = useKakaoMap()

  useEffect(() => {
    if (!kakao || !containerRef.current || mapRef.current) return
    mapRef.current = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(BUSAN_CENTER.lat, BUSAN_CENTER.lng),
      level: 9,
    })
  }, [kakao])

  // 좌측 패널이 열리고 닫힐 때 지도 컨테이너 너비가 바뀌는데, 카카오맵은 이걸
  // 자동으로 못 알아채서 relayout()을 직접 호출해줘야 렌더링이 안 깨진다.
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => mapRef.current?.relayout())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [kakao])

  // 평소 마커(클러스터/핀) — 보관함 경로 모드일 땐 그리지 않고 자리를 비켜준다.
  useEffect(() => {
    if (!kakao || !mapRef.current) return
    const map = mapRef.current

    if (route) {
      fadeOutAndRemove(placeOverlaysRef.current)
      placeOverlaysRef.current = []
      wasInRouteModeRef.current = true
      return undefined
    }

    function redraw(fadeIn) {
      placeOverlaysRef.current.forEach(({ overlay }) => overlay.setMap(null))
      const clusters = clusterPlaces(places, map.getLevel())
      placeOverlaysRef.current = clusters.map((cluster) =>
        cluster.places.length === 1
          ? createPinOverlay(kakao, map, cluster.places[0], onSelectPlace, fadeIn)
          : createClusterOverlay(kakao, map, cluster, fadeIn)
      )
    }

    // 경로 모드에서 막 돌아온 첫 렌더만 스르륵, 그 뒤 zoom마다는 즉시 그린다.
    redraw(wasInRouteModeRef.current)
    wasInRouteModeRef.current = false

    const listener = () => redraw(false)
    kakao.maps.event.addListener(map, "zoom_changed", listener)
    return () => kakao.maps.event.removeListener(map, "zoom_changed", listener)
  }, [kakao, places, onSelectPlace, route])

  // 보관함 경로 모드: 저장한 순서대로 번호 핀 + 연결선을 그리고, 전부 보이게 시점을 맞춘다.
  useEffect(() => {
    if (!kakao || !mapRef.current) return
    const map = mapRef.current

    // 이 effect가 다시 실행될 때마다(리스트 전환, StrictMode의 이중 호출 포함)
    // 이전 오버레이/폴리라인을 먼저 정리한다 — 안 그러면 지워지지 않는 고아 핀이 남는다.
    fadeOutAndRemove(routeOverlaysRef.current)
    routeOverlaysRef.current = []
    if (routePolylineRef.current) {
      routePolylineRef.current.setMap(null)
      routePolylineRef.current = null
    }

    if (!route || route.length === 0) return

    routeOverlaysRef.current = route.map((place, index) => createRouteOverlay(kakao, map, place, index, onSelectPlace))

    const path = route.map((place) => new kakao.maps.LatLng(place.lat, place.lng))
    routePolylineRef.current = new kakao.maps.Polyline({
      map,
      path,
      strokeWeight: 4,
      strokeColor: "#00328A",
      strokeOpacity: 0.8,
      strokeStyle: "solid",
    })

    if (path.length === 1) {
      map.panTo(path[0])
    } else {
      const bounds = new kakao.maps.LatLngBounds()
      path.forEach((latlng) => bounds.extend(latlng))
      map.setBounds(bounds)
    }
  }, [kakao, route, onSelectPlace])

  useImperativeHandle(ref, () => ({
    zoomIn() {
      mapRef.current?.setLevel(mapRef.current.getLevel() - 1)
    },
    zoomOut() {
      mapRef.current?.setLevel(mapRef.current.getLevel() + 1)
    },
    panTo(lat, lng) {
      if (!kakao || !mapRef.current) return
      mapRef.current.panTo(new kakao.maps.LatLng(lat, lng))
    },
  }))

  if (error) {
    return (
      <div className="absolute inset-0 flex items-center justify-center text-on-surface-variant text-body-md px-6 text-center bg-surface-dim">
        {error}
      </div>
    )
  }

  return <div ref={containerRef} className="absolute inset-0" />
})

export default KakaoMap
