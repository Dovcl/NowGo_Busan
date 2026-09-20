// 관광지 상세 데이터(장소 + 실시간 환경) 조회. PlaceDetail 페이지와 지도의
// PlaceDetailPanel이 같은 로직을 쓰므로 여기 하나로 공유한다.
import { useEffect, useState } from "react"
import { fetchPlaceById as fetchRealPlaceById } from "../services/placesService"
import { fetchEnvironment } from "../services/environmentService"
import { useLanguage } from "../context/LanguageContext"

// 항상 실제 백엔드(contentid 기준) 데이터를 쓴다 — 숫자 id가 아니면 없는 장소로 처리
async function fetchPlaceById(placeId) {
  return /^\d+$/.test(placeId) ? fetchRealPlaceById(placeId) : null
}

export function usePlaceDetail(placeId) {
  const { language } = useLanguage()
  const [place, setPlace] = useState(undefined)
  const [environment, setEnvironment] = useState(undefined)

  useEffect(() => {
    setPlace(undefined)
    setEnvironment(undefined)
    if (!placeId) return
    fetchPlaceById(placeId).then(setPlace)
  }, [placeId, language])

  useEffect(() => {
    if (place?.lat == null || place?.lng == null) return
    fetchEnvironment(place.lat, place.lng).then(setEnvironment)
  }, [place?.lat, place?.lng])

  return { place, environment }
}
