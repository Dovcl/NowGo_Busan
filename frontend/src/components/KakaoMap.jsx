import { forwardRef, useEffect, useImperativeHandle, useRef } from "react"
import { useKakaoMap } from "../hooks/useKakaoMap"
import { ENV_GROUP_STYLE, DEFAULT_ENV_GROUP_STYLE } from "../lib/envGroup"
import { clusterPlaces } from "../lib/clusterPlaces"

const BUSAN_CENTER = { lat: 35.1796, lng: 129.0756 }

// 관광지 1곳짜리 핀: 환경유형별 색깔 원 + 아이콘. 클릭하면 상세페이지로 이동.
function createPinOverlay(kakao, map, place, onSelectPlace) {
  const style = ENV_GROUP_STYLE[place.envGroup4] ?? DEFAULT_ENV_GROUP_STYLE

  const content = document.createElement("div")
  content.className =
    "w-8 h-8 rounded-full flex items-center justify-center text-white shadow-md border-2 border-white cursor-pointer hover:scale-110 transition-transform"
  content.style.backgroundColor = style.color
  content.innerHTML = `<span class="material-symbols-outlined text-[16px]">${style.icon}</span>`
  content.title = place.name
  content.addEventListener("click", () => onSelectPlace?.(place))

  return new kakao.maps.CustomOverlay({
    map,
    position: new kakao.maps.LatLng(place.lat, place.lng),
    content,
    yAnchor: 0.5,
  })
}

// 여러 관광지가 겹친 자리에 대신 그리는 숫자 배지. 클릭하면 그 지점으로 확대해서 펼쳐 보여준다.
function createClusterOverlay(kakao, map, cluster) {
  const content = document.createElement("div")
  content.className =
    "min-w-[40px] h-10 px-2 rounded-full flex items-center justify-center text-white font-bold shadow-md border-2 border-white cursor-pointer bg-primary hover:scale-110 transition-transform"
  content.textContent = String(cluster.places.length)
  content.addEventListener("click", () => {
    map.setLevel(map.getLevel() - 2, { anchor: new kakao.maps.LatLng(cluster.lat, cluster.lng) })
  })

  return new kakao.maps.CustomOverlay({
    map,
    position: new kakao.maps.LatLng(cluster.lat, cluster.lng),
    content,
    yAnchor: 0.5,
  })
}

const KakaoMap = forwardRef(function KakaoMap({ places, onSelectPlace }, ref) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
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

  useEffect(() => {
    if (!kakao || !mapRef.current) return
    const map = mapRef.current

    // 지금 확대 정도에 맞게 핀을 다시 그린다: 겹칠 만큼 가까운 핀은 숫자 배지로,
    // 아니면 개별 핀으로. 확대/축소할 때마다(zoom_changed) 다시 계산해야 한다.
    function redraw() {
      overlaysRef.current.forEach((overlay) => overlay.setMap(null))
      const clusters = clusterPlaces(places, map.getLevel())
      overlaysRef.current = clusters.map((cluster) =>
        cluster.places.length === 1
          ? createPinOverlay(kakao, map, cluster.places[0], onSelectPlace)
          : createClusterOverlay(kakao, map, cluster)
      )
    }

    redraw()
    kakao.maps.event.addListener(map, "zoom_changed", redraw)
    return () => kakao.maps.event.removeListener(map, "zoom_changed", redraw)
  }, [kakao, places, onSelectPlace])

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
