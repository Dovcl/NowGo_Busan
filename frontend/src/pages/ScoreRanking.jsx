// 홈 화면 TOP10의 "전체 보기" — 같은 데이터(fetchTopPlaces)를 자르지 않고 전부 보여준다.
// 실내/음식점 등 점수 없는 장소는 fetchTopPlaces 자체가 이미 걸러서 내려주므로 여기선
// 순위 목록으로 그리기만 하면 된다.
import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { fetchTopPlaces } from "../services/placesService"
import { STATUS } from "../lib/status"

const PAGE_SIZE = 20

export default function ScoreRanking() {
  const { t, i18n } = useTranslation("ranking")
  const { t: tCommon } = useTranslation("common")
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    setLoading(true)
    fetchTopPlaces(Infinity).then((data) => {
      setPlaces(data)
      setLoading(false)
    })
  }, [i18n.language])

  const visible = places.slice(0, visibleCount)

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-container-margin py-6 pb-24 md:pb-8 max-w-[1440px] mx-auto w-full flex flex-col gap-6">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface">{t("title")}</h1>
          <p className="font-label-sm text-on-surface-variant mt-1">
            {loading ? tCommon("actions.loading") : t("resultUnit", { count: places.length })}
          </p>
        </div>

        {loading ? (
          <div className="py-20 text-center font-label-sm text-on-surface-variant">{tCommon("actions.loading")}</div>
        ) : places.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-20 text-center">
            <span className="material-symbols-outlined text-3xl text-outline-variant">query_stats</span>
            <p className="font-label-sm text-[13px] text-on-surface-variant">{t("empty")}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-gutter">
              {visible.map((place) => (
                <RankedPlaceCard key={place.id} place={place} />
              ))}
            </div>
            {visibleCount < places.length && (
              <div className="flex justify-center mt-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                  className="font-label-sm text-[13px] text-primary border border-primary/30 rounded-full px-5 py-2 hover:bg-primary/5 transition-colors"
                >
                  {t("loadMore", { visible: visible.length, total: places.length })}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function RankedPlaceCard({ place }) {
  const { t: tCommon } = useTranslation("common")
  const status = STATUS[place.status]

  return (
    <Link
      to={`/place/${place.id}`}
      className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all cursor-pointer border border-outline-variant/10 group flex flex-col"
    >
      <div className="relative h-32 w-full bg-surface-container">
        {place.image && (
          <img
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            src={place.image}
            alt={place.name}
          />
        )}
        <div className="absolute top-2 left-2 bg-secondary-container text-on-secondary-fixed font-bold text-xs px-2 py-1 rounded-md shadow">
          {place.rank}
        </div>
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-body-md text-body-md font-bold text-on-surface truncate">{place.name}</h3>
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          <div className="flex items-baseline gap-1">
            <span className={`font-score-display text-xl font-bold ${status.text}`}>{place.score}</span>
            <span className={`font-label-sm text-[10px] font-bold ${status.text}`}>({tCommon(`status.${place.status}`)})</span>
          </div>
          {place.category && (
            <span className="font-label-sm text-[10px] text-outline px-2 py-1 bg-surface-container rounded-full shrink-0 truncate">
              {place.category}
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}
