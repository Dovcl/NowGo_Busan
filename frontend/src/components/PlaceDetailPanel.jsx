// 지도에서 마커를 클릭했을 때 좌측에 뜨는 미리보기 패널 (구글 지도 스타일).
// 전체 정보(방문객 팁/주변 맛집/AI 예측 등)는 상세페이지(/place/:id)로 링크만 걸고,
// 여기서는 핵심 정보(사진/주소/이용정보/실시간 환경)만 보여준다.
import { Link } from "react-router-dom"
import { usePlaceDetail } from "../hooks/usePlaceDetail"
import { useSaveButton } from "../hooks/useSaveButton"
import { ENV_ROWS } from "../lib/envRows"
import SaveToListModal from "./SaveToListModal"

const INFO_ROWS = [
  { key: "usetime", icon: "schedule", label: "이용시간" },
  { key: "restdate", icon: "event_busy", label: "휴무일" },
  { key: "parking", icon: "local_parking", label: "주차시설" },
  { key: "usefee", icon: "payments", label: "이용요금" },
]

function directionsUrl(place) {
  return `https://map.kakao.com/link/to/${encodeURIComponent(place.name)},${place.lat},${place.lng}`
}

export default function PlaceDetailPanel({ placeId, onClose }) {
  const { place, environment } = usePlaceDetail(placeId)
  const { isSaved, showModal, handleClick, closeModal } = useSaveButton(place?.id)

  return (
    <aside className="absolute md:relative inset-0 md:inset-auto z-20 w-full md:w-[400px] h-full shrink-0 bg-surface-container-lowest shadow-2xl flex flex-col overflow-y-auto">
      {place === undefined && (
        <div className="flex-1 flex items-center justify-center">
          <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
        </div>
      )}

      {place === null && (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 p-6 text-center">
          <p className="font-body-md text-on-surface-variant">해당 관광지를 찾을 수 없어요.</p>
          <button type="button" onClick={onClose} className="text-primary font-body-md hover:underline">
            지도로 돌아가기
          </button>
        </div>
      )}

      {place && (
        <>
          {/* Hero */}
          <div className="relative w-full h-[220px] shrink-0 bg-surface-dim">
            {place.image && <img className="w-full h-full object-cover" src={place.image} alt={place.name} />}
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
            <button
              type="button"
              onClick={onClose}
              className="absolute top-4 left-4 w-10 h-10 rounded-full bg-surface/80 backdrop-blur flex items-center justify-center text-on-surface hover:bg-surface transition-colors shadow-md"
            >
              <span className="material-symbols-outlined">arrow_back</span>
            </button>
            <div className="absolute bottom-4 left-4 right-4 text-white">
              <h1 className="text-headline-lg-mobile font-headline-lg-mobile leading-tight mb-1">{place.name}</h1>
              <p className="text-label-sm font-label-sm opacity-90">{place.category}</p>
            </div>
          </div>

          <div className="p-card-padding flex flex-col gap-gutter">
            {/* Actions */}
            <div className="flex justify-around items-start px-2">
              <a
                href={directionsUrl(place)}
                target="_blank"
                rel="noreferrer"
                className="flex flex-col items-center gap-2 group"
              >
                <div className="w-12 h-12 rounded-full bg-primary text-on-primary flex items-center justify-center shadow-md group-hover:-translate-y-1 transition-transform">
                  <span className="material-symbols-outlined">directions</span>
                </div>
                <span className="text-label-sm font-label-sm text-on-surface">길찾기</span>
              </a>
              <button type="button" onClick={handleClick} className="flex flex-col items-center gap-2 group">
                <div
                  className={`w-12 h-12 rounded-full flex items-center justify-center transition-transform group-hover:-translate-y-1 ${
                    isSaved ? "bg-error text-white shadow-md" : "bg-surface-container text-on-surface shadow-sm"
                  }`}
                >
                  <span className="material-symbols-outlined" style={isSaved ? { fontVariationSettings: "'FILL' 1" } : undefined}>
                    {isSaved ? "bookmark" : "bookmark_add"}
                  </span>
                </div>
                <span className={`text-label-sm font-label-sm ${isSaved ? "text-error font-bold" : "text-on-surface-variant"}`}>
                  {isSaved ? "저장됨" : "저장"}
                </span>
              </button>
              <Link to={`/place/${place.id}`} className="flex flex-col items-center gap-2 group">
                <div className="w-12 h-12 rounded-full bg-surface-container text-on-surface flex items-center justify-center shadow-sm group-hover:-translate-y-1 transition-transform">
                  <span className="material-symbols-outlined">open_in_full</span>
                </div>
                <span className="text-label-sm font-label-sm text-on-surface-variant">상세정보</span>
              </Link>
            </div>

            {showModal && <SaveToListModal contentid={place.id} onClose={closeModal} />}

            {/* Address / info */}
            <div className="flex flex-col gap-1">
              {place.addr && (
                <div className="flex items-start gap-4 py-3 border-b border-surface-container px-2">
                  <span className="material-symbols-outlined text-primary mt-0.5">location_on</span>
                  <span className="text-body-md font-body-md text-on-surface">{place.addr}</span>
                </div>
              )}
              {place.info &&
                INFO_ROWS.map((row) => {
                  const value = place.info[row.key]
                  if (!value) return null
                  return (
                    <div key={row.key} className="flex items-start gap-4 py-3 border-b border-surface-container px-2">
                      <span className="material-symbols-outlined text-primary mt-0.5">{row.icon}</span>
                      <span className="text-body-md font-body-md text-on-surface">{value}</span>
                    </div>
                  )
                })}
              {place.homepage && (
                <div className="flex items-start gap-4 py-3 px-2">
                  <span className="material-symbols-outlined text-primary mt-0.5">language</span>
                  <a
                    href={place.homepage}
                    target="_blank"
                    rel="noreferrer"
                    className="text-body-md font-body-md text-primary hover:underline break-all"
                  >
                    {place.homepage}
                  </a>
                </div>
              )}
            </div>

            {/* Live environment */}
            {environment && (
              <div className="border-t border-outline-variant/30 pt-4">
                <h3 className="text-label-sm font-label-sm text-on-surface-variant uppercase tracking-wider mb-3">
                  현재 날씨 · 대기질
                </h3>
                <div className="grid grid-cols-2 gap-3 bg-surface-container-low p-4 rounded-xl">
                  {ENV_ROWS.map((row) => {
                    const value = row.get(environment)
                    if (!value) return null
                    return (
                      <div key={row.label} className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">{row.icon}</span>
                        <div>
                          <p className="text-label-sm text-on-surface-variant">{row.label}</p>
                          <p className="text-sm font-bold">{value}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </aside>
  )
}
