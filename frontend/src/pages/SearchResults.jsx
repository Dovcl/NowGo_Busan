import { useEffect, useMemo, useState } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { fetchPlaces } from "../services/placesService"
import { STATUS, scoreToStatus } from "../lib/status"
import { matchRank } from "../lib/placeSearch"

const ENV_GROUPS = ["해변", "산", "도심", "실내"]
const PAGE_SIZE = 20

export default function SearchResults() {
  const [searchParams, setSearchParams] = useSearchParams()
  const q = searchParams.get("q") ?? ""
  const [input, setInput] = useState(q)
  const [places, setPlaces] = useState([])
  const [loading, setLoading] = useState(true)
  const [envFilter, setEnvFilter] = useState([]) // 비어있으면 전체
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE)

  useEffect(() => {
    fetchPlaces().then((data) => {
      setPlaces(data)
      setLoading(false)
    })
  }, [])

  useEffect(() => setInput(q), [q])

  const query = q.trim().toLowerCase()
  const filtered = useMemo(() => {
    let result = places
    if (query) {
      result = result
        .map((p) => ({ p, rank: matchRank(p, query) }))
        .filter(({ rank }) => rank !== null)
        .sort((a, b) => a.rank - b.rank)
        .map(({ p }) => p)
    }
    if (envFilter.length > 0) {
      result = result.filter((p) => envFilter.includes(p.envGroup4))
    }
    return result
  }, [places, query, envFilter])

  // 검색어나 필터가 바뀌면 "더보기"로 늘려뒀던 개수를 처음으로 되돌린다.
  useEffect(() => setVisibleCount(PAGE_SIZE), [query, envFilter])

  const visible = filtered.slice(0, visibleCount)

  function handleSubmit(e) {
    e.preventDefault()
    const next = input.trim()
    setSearchParams(next ? { q: next } : {})
  }

  function toggleEnv(group) {
    setEnvFilter((prev) => (prev.includes(group) ? prev.filter((g) => g !== group) : [...prev, group]))
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-container-margin py-6 pb-24 md:pb-8 max-w-[1440px] mx-auto w-full flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface">검색 결과</h1>
            {!loading && (
              <p className="font-label-sm text-on-surface-variant mt-1">
                {query ? (
                  <>
                    “{q}” <span className="font-bold text-on-surface">{filtered.length}건</span>
                  </>
                ) : (
                  `${filtered.length}건`
                )}
              </p>
            )}
          </div>
          <form onSubmit={handleSubmit} className="relative w-full sm:w-80 shrink-0">
            <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
              search
            </span>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="관광지, 지역, 키워드 검색"
              className="w-full bg-surface-container border border-outline-variant rounded-full pl-9 pr-8 py-2.5 text-[13.5px] font-body-md text-on-surface placeholder:text-outline focus:outline-none focus:border-primary transition-colors"
            />
            {input && (
              <button
                type="button"
                onClick={() => {
                  setInput("")
                  setSearchParams({})
                }}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-[16px]">close</span>
              </button>
            )}
          </form>
        </div>

        <div className="flex flex-col lg:flex-row gap-6">
          <aside className="lg:w-56 shrink-0">
            <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="font-label-sm font-bold text-on-surface">유형</span>
                {envFilter.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEnvFilter([])}
                    className="font-label-sm text-[11px] text-primary"
                  >
                    초기화
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
                    <span className="font-body-md text-[13.5px] text-on-surface">{group}</span>
                  </label>
                ))}
              </div>
            </div>
          </aside>

          <div className="flex-1">
            {loading ? (
              <div className="py-20 text-center font-label-sm text-on-surface-variant">불러오는 중...</div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center gap-2 py-20 text-center">
                <span className="material-symbols-outlined text-3xl text-outline-variant">search_off</span>
                <p className="font-label-sm text-[13px] text-on-surface-variant">
                  {query ? `'${q}'에 대한 검색 결과가 없어요.` : "조건에 맞는 관광지가 없어요."}
                </p>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-gutter">
                  {visible.map((place) => (
                    <PlaceCard key={place.id} place={place} />
                  ))}
                </div>
                {visibleCount < filtered.length && (
                  <div className="flex justify-center mt-6">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
                      className="font-label-sm text-[13px] text-primary border border-primary/30 rounded-full px-5 py-2 hover:bg-primary/5 transition-colors"
                    >
                      더보기 ({visible.length}/{filtered.length})
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

function PlaceCard({ place }) {
  // score는 NowGo Score 알고리즘 확정 전까지 항상 null(placesService.js 참고) —
  // 값이 있을 때만 배지를 그려서 나중에 알고리즘이 붙어도 이 컴포넌트는 그대로 재사용된다.
  const status = place.score != null ? STATUS[place.status ?? scoreToStatus(place.score)] : null

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
      </div>
      <div className="p-4 flex flex-col gap-2 flex-1">
        <h3 className="font-body-md text-body-md font-bold text-on-surface truncate">{place.name}</h3>
        <p className="font-label-sm text-[11px] text-outline truncate">{place.addr}</p>
        <div className="flex items-center justify-between gap-2 mt-auto pt-1">
          {status ? (
            <div className="flex items-baseline gap-1">
              <span className={`font-score-display text-xl font-bold ${status.text}`}>{place.score}</span>
              <span className={`font-label-sm text-[10px] font-bold ${status.text}`}>({status.label})</span>
            </div>
          ) : (
            <span className="font-label-sm text-[10px] text-outline px-2 py-1 bg-surface-container rounded-full truncate">
              {place.envTag}
            </span>
          )}
          {place.category && (
            <span className="font-label-sm text-[10px] text-outline px-2 py-1 bg-surface-container rounded-full shrink-0">
              {place.category}
            </span>
          )}
        </div>
        {place.info?.usetime && (
          <p className="font-label-sm text-[11px] text-on-surface-variant pt-2 border-t border-outline-variant/20 truncate">
            이용시간 {place.info.usetime}
          </p>
        )}
      </div>
    </Link>
  )
}
