import { useEffect, useState } from "react"
import { Link, useNavigate, useParams } from "react-router-dom"
import { fetchPlaceById } from "../services/scoreService"
import { STATUS, scoreToStatus } from "../lib/status"

const SCORE_ROWS = [
  { key: "air", icon: "air", label: "대기질" },
  { key: "weather", icon: "sunny", label: "기상" },
  { key: "uv", icon: "wb_sunny", label: "자외선" },
  { key: "ripCurrentOrWater", icon: "waves", label: "이안류/수질" },
  { key: "crowd", icon: "groups", label: "혼잡도" },
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

  const status = STATUS[place.status ?? scoreToStatus(place.score)]

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
          <div className="lg:col-span-8 flex flex-col gap-gutter">
            {/* Hero */}
            <div className="relative w-full h-[300px] md:h-[400px] rounded-xl overflow-hidden shadow-sm">
              <img className="w-full h-full object-cover" src={place.image} alt={place.name} />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent flex flex-col justify-end p-6">
                <div className="flex justify-between items-end">
                  <div className="text-white">
                    <h1 className="hidden md:block font-headline-lg text-headline-lg mb-2">{place.name}</h1>
                    <p className="font-body-md text-white/90">{place.category}</p>
                  </div>
                  <div className="bg-white rounded-xl p-4 shadow-lg flex flex-col items-center min-w-[120px]">
                    <span className="font-label-sm text-label-sm text-on-surface-variant mb-1">NowGo Score</span>
                    <div className="flex items-baseline">
                      <span className={`font-score-display text-score-display mr-1 ${status.text}`}>{place.score}</span>
                      <span className="font-body-md text-on-surface-variant">/100</span>
                    </div>
                    <p className={`font-label-sm text-label-sm mt-2 text-center ${status.text}`}>
                      {place.status === "danger"
                        ? "지금은 방문을 피하는 게 좋아요"
                        : place.status === "caution"
                        ? "혼잡할 수 있어요, 참고하세요"
                        : "지금 방문하기 좋은 상태예요!"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Detailed scores */}
            <div className="bg-white rounded-xl p-card-padding shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/30">
              <h2 className="font-body-md text-body-md font-bold mb-4">
                세부 점수 <span className="font-label-sm text-label-sm text-on-surface-variant font-normal ml-2">변수별 점수가 높을수록 좋아요</span>
              </h2>
              <div className="space-y-4">
                {SCORE_ROWS.map((row) => {
                  const value = place.breakdown?.[row.key]
                  if (value == null) return null
                  const rowStatus = STATUS[scoreToStatus(value)]
                  return (
                    <div key={row.key} className="flex items-center justify-between">
                      <div className="flex items-center gap-2 w-32">
                        <span className="material-symbols-outlined text-outline">{row.icon}</span>
                        <span className="font-body-md">{row.label}</span>
                      </div>
                      <div className={`flex-grow mx-4 h-2 rounded-full overflow-hidden ${rowStatus.trackBg}`}>
                        <div className={`h-full rounded-full ${rowStatus.bg}`} style={{ width: `${value}%` }} />
                      </div>
                      <div className="w-16 text-right">
                        <span className="font-body-md font-bold text-on-surface">{value}</span>
                        <span className="font-label-sm text-on-surface-variant">/100</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* AI forecast */}
            {place.forecast24h && (
              <div className="bg-white rounded-xl p-card-padding shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/30 flex flex-col md:flex-row gap-8">
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="font-body-md text-body-md font-bold">AI 24시간 예측</h2>
                  </div>
                  <div className="flex justify-between items-end h-32 px-4 border-b border-outline-variant relative">
                    <svg className="absolute inset-0 w-full h-full p-4" preserveAspectRatio="none" viewBox="0 0 100 100">
                      <path d="M 10 20 L 35 30 L 60 40 L 90 70" fill="none" stroke="#c3c6d6" strokeDasharray="4" strokeWidth="2" />
                    </svg>
                    {place.forecast24h.map((point) => {
                      const pointStatus = STATUS[point.status]
                      return (
                        <div key={point.label} className="flex flex-col items-center relative z-10">
                          <span className={`font-body-md font-bold mb-2 ${pointStatus.text}`}>{point.score}</span>
                          <div className={`w-3 h-3 rounded-full border-2 border-white shadow-sm mb-2 ${pointStatus.bg}`} />
                          <span className="font-label-sm text-on-surface-variant">{point.label}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
                {place.forecastReasons && (
                  <div className="w-full md:w-1/3 bg-surface-container-low rounded-lg p-4">
                    <h3 className="font-label-sm text-label-sm font-bold text-on-surface mb-3 flex items-center gap-1">
                      <span className="material-symbols-outlined text-primary text-[16px]">info</span> 예측 이유
                    </h3>
                    <ul className="space-y-2 font-body-md text-[14px] text-on-surface-variant list-disc pl-4">
                      {place.forecastReasons.map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Alternatives */}
          {place.alternatives && (
            <div className="lg:col-span-4 flex flex-col gap-gutter">
              <div className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/30 h-full">
                <h2 className="font-body-md text-body-md font-bold mb-2">위험 시 대체 관광지 추천</h2>
                <p className="font-label-sm text-label-sm text-on-surface-variant mb-6 pb-4 border-b border-outline-variant/50">
                  현재 {place.name}의 24시간 후 환경 점수가 하락할 것으로 예상되어, 근처 실내 관광지를 추천합니다.
                </p>
                <h3 className="font-body-md font-bold text-on-surface mb-4">근처 실내 관광지 TOP 3</h3>
                <div className="space-y-4">
                  {place.alternatives.map((alt, i) => {
                    const altStatus = STATUS[alt.status]
                    return (
                      <div key={alt.id} className="flex gap-4 p-3 rounded-lg hover:bg-surface-container-low transition-colors border border-transparent hover:border-primary/20 cursor-pointer group">
                        <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 relative">
                          <img className="w-full h-full object-cover" src={alt.image} alt={alt.name} />
                          <div className="absolute top-1 left-1 w-6 h-6 bg-surface-dim text-on-surface rounded-full flex items-center justify-center font-label-sm font-bold shadow-sm">
                            {i + 1}
                          </div>
                        </div>
                        <div className="flex flex-col justify-between flex-grow">
                          <div>
                            <h4 className="font-body-md font-bold text-on-surface group-hover:text-primary transition-colors">{alt.name}</h4>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="font-label-sm text-on-surface-variant">NowGo</span>
                              <span className={`font-body-md font-bold ${altStatus.text}`}>{alt.score}</span>
                              <span className={`font-label-sm ${altStatus.text}`}>({altStatus.label})</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-3 text-on-surface-variant font-label-sm">
                            <span>{alt.category}</span>
                            <span className="flex items-center gap-1">
                              <span className="material-symbols-outlined text-[14px]">directions_car</span> {alt.distance}
                            </span>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <button type="button" className="w-full mt-6 bg-primary text-white font-body-md py-3 rounded-lg hover:bg-primary/90 transition-colors shadow-sm font-bold">
                  경로보기 (카카오맵)
                </button>
              </div>
            </div>
          )}
        </div>

        <Link to="/" className="inline-block mt-8 text-primary font-body-md hover:underline">
          ← 홈으로 돌아가기
        </Link>
      </div>
    </div>
  )
}
