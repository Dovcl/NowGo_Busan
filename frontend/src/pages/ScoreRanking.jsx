// 홈 화면 TOP10의 "전체 보기" — 같은 데이터(fetchTopPlaces)를 자르지 않고 전부 보여준다.
// 실내/음식점 등 점수 없는 장소는 fetchTopPlaces 자체가 이미 걸러서 내려주므로, 유형
// 필터도 실제로 나오는 값(해변/산/도심)만 둔다 — 실내를 넣어봤자 항상 0건이라 장식이 됨.
import { useEffect, useMemo, useState } from "react"
import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { fetchTopPlaces } from "../services/placesService"
import { STATUS } from "../lib/status"

const PAGE_SIZE = 20
const ENV_GROUPS = ["해변", "산", "도심"]

export default function ScoreRanking() {
  const { t, i18n } = useTranslation("ranking")
  const { t: tCommon } = useTranslation("common")
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [envFilter, setEnvFilter] = useState([]) // 비어있으면 전체
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    setLoading(true)
    fetchTopPlaces(Infinity).then((data) => {
      setPlaces(data)
      setLoading(false)
    })
  }, [i18n.language])

  // 필터를 바꾸면 이전 필터 기준으로 늘려둔 "더 보기" 페이지 수를 초기화한다.
  useEffect(() => setVisibleCount(PAGE_SIZE), [envFilter])

  // 순위(place.rank)는 필터와 무관하게 항상 "전체 210곳 중 몇 위"를 그대로 보여준다 —
  // 필터링해도 다시 1위부터 매기면 실제 순위와 어긋나 오해를 줄 수 있어서.
  const filtered = useMemo(
    () => (envFilter.length === 0 ? places : places.filter((p) => envFilter.includes(p.envGroup4))),
    [places, envFilter]
  )
  const visible = filtered.slice(0, visibleCount)

  function toggleEnv(group) {
    setEnvFilter((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]))
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-container-margin py-6 pb-24 md:pb-8 max-w-[1440px] mx-auto w-full flex flex-col gap-6">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface">{t("title")}</h1>
          <p className="font-label-sm text-on-surface-variant mt-1">
            {loading ? tCommon("actions.loading") : t("resultUnit", { count: filtered.length })}
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-56 shrink-0">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-label-sm font-bold text-on-surface">{t("typeLabel")}</span>
                {envFilter.length > 0 && (
                  <button type="button" onClick={() => setEnvFilter([])} className="font-label-sm text-[11px] text-primary">
                    {t("resetLabel")}
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-2">
                {ENV_GROUPS.map((group) => (
                  <label key={group} className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={envFilter.includes(group)}
                      onChange={() => toggleEnv(group)}
                      className="accent-primary"
                    />
                    <span className="font-body-md text-[13.5px] text-on-surface">{tCommon(`envGroup.${group}`)}</span>
                  </label>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1">
            {loading ? (
              <div className="py-20 text-center font-label-sm text-on-surface-variant">{tCommon("actions.loading")}</div>
            ) : filtered.length === 0 ? (
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
                {visibleCount < filtered.length && (
                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="font-label-sm text-[13px] text-primary border border-primary/30 rounded-full px-5 py-2 hover:bg-primary/5 transition-colors"
                    >
                      {t("loadMore", { visible: visible.length, total: filtered.length })}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
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
            <span className={`font-label-sm text-[10px] font-bold whitespace-nowrap ${status.text}`}>({tCommon(`status.${place.status}`)})</span>
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
