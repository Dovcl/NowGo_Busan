import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { fetchPlaceById as fetchMockPlaceById } from "../services/scoreService"
import { fetchPlaceById as fetchRealPlaceById } from "../services/placesService"
import { STATUS, scoreToStatus } from "../lib/status"

// TOP10 목업 항목도 이제 실제 tour_spot.contentid를 id로 쓰므로(mock/places.js 참고),
// mock을 먼저 찾아서 큐레이션된 score/tips/forecast 등을 우선 쓴다. mock에 없는
// contentid(지도에서 클릭한 일반 관광지 등)는 실제 백엔드로 폴백 — 거긴 NowGo Score
// 알고리즘이 없어 score/breakdown 관련 섹션이 자연히 비게 된다.
async function fetchPlaceById(placeId) {
  const mockPlace = await fetchMockPlaceById(placeId)
  if (mockPlace) return mockPlace
  return /^\d+$/.test(placeId) ? fetchRealPlaceById(placeId) : null
}

const SCORE_ROWS = [
  { key: "air", label: "대기질" },
  { key: "weather", label: "기상" },
  { key: "uv", label: "자외선" },
  { key: "ripCurrentOrWater", label: "이안류/수질" },
  { key: "crowd", label: "혼잡도" },
]

const INFO_ROWS = [
  { key: "usetime", icon: "schedule", label: "이용시간" },
  { key: "restdate", icon: "event_busy", label: "휴무일" },
  { key: "parking", icon: "local_parking", label: "주차시설" },
  { key: "usefee", icon: "payments", label: "이용요금" },
]

export default function PlaceDetail() {
  const { placeId } = useParams()
  // Keying by placeId remounts this subtree on navigation between places,
  // so state naturally resets instead of needing a manual setState in an effect.
  return <PlaceDetailView key={placeId} placeId={placeId} />
}

function PlaceDetailView({ placeId }) {
  const navigate = useNavigate()
  const [place, setPlace] = useState(undefined)

  useEffect(() => {
    fetchPlaceById(placeId).then(setPlace)
  }, [placeId])

  if (place === undefined) return null
  if (place === null) {
    return (
      <div className="h-full overflow-y-auto flex items-center justify-center">
        <p className="font-body-md text-on-surface-variant">해당 관광지를 찾을 수 없어요.</p>
      </div>
    )
  }

  const hasScore = place.score != null
  const status = hasScore ? STATUS[place.status ?? scoreToStatus(place.score)] : null
  const stars = (place.score ?? 0) / 20

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full px-4 md:px-container-margin py-8 pb-24 md:pb-8">
        <div className="md:hidden flex items-center mb-6">
          <button type="button" onClick={() => navigate(-1)} className="mr-4">
            <span className="material-symbols-outlined text-on-surface">arrow_back_ios</span>
          </button>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{place.name}</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-gutter">
          {/* Left column: hero, tips, nearby food */}
          <div className="lg:col-span-7 flex flex-col gap-gutter">
            {/* Hero */}
            <div className="relative w-full h-[300px] md:h-[400px] rounded-xl overflow-hidden shadow-sm">
              <img className="w-full h-full object-cover" src={place.image} alt={place.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6">
                <div className="flex justify-between items-end">
                  <div className="text-white">
                    <h1 className="hidden md:block font-headline-lg text-headline-lg mb-2">{place.name}</h1>
                    <p className="font-body-md text-white/90">{place.category}</p>
                    {place.envTag && (
                      <div className="mt-2 flex gap-2">
                        <span className="bg-primary/20 backdrop-blur-md text-white text-[12px] px-2 py-0.5 rounded-full border border-white/30">
                          {place.envTag}
                        </span>
                      </div>
                    )}
                  </div>
                  {hasScore && (
                    <div className="bg-white rounded-xl p-4 shadow-lg flex flex-col items-center min-w-[120px]">
                      <span className="font-label-sm text-label-sm text-on-surface-variant mb-1">NowGo Score</span>
                      <div className="flex items-baseline">
                        <span className={`font-score-display text-score-display mr-1 ${status.text}`}>{place.score}</span>
                        <span className="font-body-md text-on-surface-variant">/100</span>
                      </div>
                      <div className={`flex gap-1 mt-1 ${status.text}`}>
                        {[0, 1, 2, 3, 4].map((i) => {
                          const diff = stars - i
                          const filled = diff >= 1
                          const icon = diff >= 0.5 ? (filled ? "star" : "star_half") : "star"
                          return (
                            <span
                              key={i}
                              className="material-symbols-outlined text-[16px]"
                              style={filled ? { fontVariationSettings: "'FILL' 1" } : undefined}
                            >
                              {icon}
                            </span>
                          )
                        })}
                      </div>
                      <p className={`font-label-sm text-label-sm mt-2 text-center ${status.text}`}>
                        {place.status === "danger"
                          ? "지금은 방문을 피하는 게 좋아요"
                          : place.status === "caution"
                          ? "혼잡할 수 있어요, 참고하세요"
                          : "지금 방문하기 좋은 상태예요!"}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Visitor tips */}
            {place.tips && (
              <section className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/30">
                <h2 className="font-body-md font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">tips_and_updates</span>
                  방문객 팁 &amp; 리뷰
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {place.tips.map((tip) => (
                    <div key={tip.label} className="p-4 rounded-lg bg-primary-container/20 border border-primary/20">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="material-symbols-outlined text-primary text-[20px]">{tip.icon}</span>
                        <span className="font-label-sm text-primary">{tip.label}</span>
                      </div>
                      <p className="text-sm text-on-surface">{tip.text}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Nearby food */}
            {place.nearbyFood && (
              <section className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/30">
                <h2 className="font-body-md font-bold mb-4 flex items-center gap-2">
                  <span className="material-symbols-outlined text-primary">restaurant</span>
                  주변 추천 맛집 &amp; 카페
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {place.nearbyFood.map((food) => (
                    <div key={food.name} className="group cursor-pointer">
                      <div className="w-full h-32 rounded-lg bg-surface-dim mb-2 overflow-hidden">
                        {food.image ? (
                          <img className="w-full h-full object-cover" src={food.image} alt={food.name} />
                        ) : (
                          <div className="w-full h-full bg-primary/10 flex items-center justify-center">
                            <span className="material-symbols-outlined text-primary/40">image</span>
                          </div>
                        )}
                      </div>
                      <p className="text-sm font-bold group-hover:text-primary transition-colors">{food.name}</p>
                      <p className="text-[12px] text-on-surface-variant">{food.distance}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* Right column: place info, env indicators, forecast, alternatives */}
          <div className="lg:col-span-5 flex flex-col gap-gutter">
            <div className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/30">
              <div className="space-y-6">
                {place.info && (
                  <section>
                    <h2 className="font-headline-lg-mobile text-on-surface mb-4">관광지 정보</h2>
                    <div className="grid grid-cols-1 gap-3 bg-surface-container-low p-4 rounded-xl">
                      {INFO_ROWS.map((row) => {
                        const value = place.info[row.key]
                        if (!value) return null
                        return (
                          <div key={row.key} className="flex items-start gap-3">
                            <span className="material-symbols-outlined text-primary">{row.icon}</span>
                            <div>
                              <p className="text-label-sm text-on-surface-variant">{row.label}</p>
                              <p className="text-body-md font-bold">{value}</p>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {place.breakdown && (
                  <section className="border-t border-outline-variant/30 pt-6">
                    <h2 className="font-body-md font-bold mb-4">실시간 환경 지표</h2>
                    <div className="space-y-3">
                      {SCORE_ROWS.map((row) => {
                        const value = place.breakdown?.[row.key]
                        if (value == null) return null
                        const rowStatus = STATUS[scoreToStatus(value)]
                        return (
                          <div key={row.key} className="flex items-center justify-between">
                            <span className="text-sm">{row.label}</span>
                            <div className={`flex-grow mx-3 h-1.5 rounded-full ${rowStatus.trackBg}`}>
                              <div className={`h-full rounded-full ${rowStatus.bg}`} style={{ width: `${value}%` }} />
                            </div>
                            <span className="text-sm font-bold">{value}</span>
                          </div>
                        )
                      })}
                    </div>
                  </section>
                )}

                {place.forecast24h && (
                  <section className="border-t border-outline-variant/30 pt-6">
                    <h2 className="font-body-md font-bold mb-2">AI 24시간 예측</h2>
                    <p className="text-label-sm text-on-surface-variant mb-4">혼잡도 및 안전 지수 통합 예측</p>
                    <div className="bg-white border border-outline-variant/30 rounded-lg p-4">
                      <div className="flex justify-between items-end h-20 relative">
                        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none" viewBox="0 0 100 100">
                          <path d="M 10 20 L 40 35 L 70 50 L 90 80" fill="none" stroke="#00328a" strokeDasharray="4" strokeWidth="2" />
                        </svg>
                        {place.forecast24h.map((point) => {
                          const pointStatus = STATUS[point.status]
                          return (
                            <div key={point.label} className="flex flex-col items-center z-10">
                              <div className={`w-2 h-2 rounded-full mb-1 ${pointStatus.bg}`} />
                              <span className="text-[10px]">{point.label}</span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  </section>
                )}

                <button type="button" className="w-full bg-primary text-white font-bold py-3 rounded-lg hover:bg-primary/90 transition-all">
                  경로보기 (카카오맵)
                </button>
              </div>
            </div>

            {place.alternatives && (
              <div className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/30">
                <h2 className="font-body-md font-bold mb-4">위험 시 대체 관광지</h2>
                <div className="space-y-3">
                  {place.alternatives.map((alt) => {
                    const altStatus = STATUS[alt.status]
                    return (
                      <div key={alt.id} className="flex gap-3 p-2 rounded-lg hover:bg-surface-container-low cursor-pointer">
                        <div className="w-12 h-12 rounded bg-surface-dim shrink-0 overflow-hidden">
                          {alt.image && <img className="w-full h-full object-cover" src={alt.image} alt={alt.name} />}
                        </div>
                        <div className="flex-grow">
                          <p className="text-sm font-bold">{alt.name}</p>
                          <p className={`text-[12px] ${altStatus.text}`}>
                            NowGo {alt.score} ({altStatus.label})
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        <Link to="/" className="inline-block mt-8 text-primary font-body-md hover:underline">
          ← 홈으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
