// 관광지 상세 데이터(장소 + 실시간 환경) 조회. PlaceDetail 페이지와 지도의
// PlaceDetailPanel이 같은 로직을 쓰므로 여기 하나로 공유한다.
import { useEffect, useState } from "react"
import { fetchPlaceById as fetchMockPlaceById } from "../services/scoreService"
import { fetchPlaceById as fetchRealPlaceById } from "../services/placesService"
import { fetchEnvironment } from "../services/environmentService"

// TOP10 목업이 실제 tour_spot.contentid를 id로 쓰므로, mock을 먼저 찾아 큐레이션된
// score/tips/forecast를 우선 쓰고 없으면 실제 백엔드로 폴백한다.
async function fetchPlaceById(placeId) {
  const mockPlace = await fetchMockPlaceById(placeId)
  if (mockPlace) return mockPlace
  return /^\d+$/.test(placeId) ? fetchRealPlaceById(placeId) : null
}

export function usePlaceDetail(placeId) {
  const [place, setPlace] = useState(undefined)
  const [environment, setEnvironment] = useState(undefined)

  useEffect(() => {
    setPlace(undefined)
    setEnvironment(undefined)
    if (!placeId) return
    fetchPlaceById(placeId).then(setPlace)
  }, [placeId])

  // mock 큐레이션 장소는 좌표가 없어서(mock/places.js 참고) 자연히 스킵됨
  useEffect(() => {
    if (place?.lat == null || place?.lng == null) return
    fetchEnvironment(place.lat, place.lng).then(setEnvironment)
  }, [place?.lat, place?.lng])

  return { place, environment }
}
