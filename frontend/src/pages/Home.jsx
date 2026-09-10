import { useEffect, useState } from "react"
import { Link, useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { fetchHomeSummary, fetchTopPlaces } from "../services/scoreService"
import { fetchEnvironment } from "../services/environmentService"
import { STATUS, scoreToStatus, pmGradeToStatus, uvToLevel, ripLevelToStatus } from "../lib/status"
import { weatherCondition } from "../lib/weather"

// 부산시청 좌표 — 홈 화면 "지금 부산 날씨"는 관광지 하나가 아니라 도시 전체 요약이라
// 대표 지점 하나를 기준으로 조회한다(대기질은 이 근처 최근접 측정소로 매칭됨).
const BUSAN_CITY_HALL = { lat: 35.1796, lng: 129.0756 }

// 이안류 카드는 "부산 전체"가 아니라 원래부터 해운대 고정 표시라(mock도 그랬음),
// 부산시청 좌표로는 반경 5km 밖이라 안 잡혀서 해운대 좌표로 따로 조회한다.
const HAEUNDAE = { lat: 35.1587, lng: 129.1604 }

function fmt(value, unit = "") {
  return value != null ? `${value}${unit}` : "-"
}

export default function Home() {
  const { t } = useTranslation("home")
  const { t: tCommon } = useTranslation("common")
  const navigate = useNavigate()
  const [summary, setSummary] = useState(null)
  const [environment, setEnvironment] = useState(null)
  const [haeundae, setHaeundae] = useState(null)
  const [places, setPlaces] = useState([])
  const [searchInput, setSearchInput] = useState("")

  function handleSearch(e) {
    e.preventDefault()
    const q = searchInput.trim()
    if (q) navigate(`/search?q=${encodeURIComponent(q)}`)
  }

  useEffect(() => {
    fetchHomeSummary().then(setSummary)
    fetchTopPlaces().then(setPlaces)
    fetchEnvironment(BUSAN_CITY_HALL.lat, BUSAN_CITY_HALL.lng).then(setEnvironment)
    fetchEnvironment(HAEUNDAE.lat, HAEUNDAE.lng).then(setHaeundae)
  }, [])

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-container-margin py-4 md:py-8 pb-24 md:pb-8 max-w-[1440px] mx-auto w-full flex flex-col gap-section-gap">
        {/* Hero */}
        <section className="relative rounded-xl overflow-hidden h-[300px] md:h-[400px] flex items-center justify-center shadow-lg">
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage:
                "url('https://lh3.googleusercontent.com/aida-public/AB6AXuCXylYg2spQ4sjNX9875cNZwT8xkLaoAgY7tifTcIFAJTtSwiH9kQ7b-MPA8SjfOLIYtKQI1rXbPi1NvW-Ei72Z8Gc82-rrBG-JNc4e0JWo2XxUOFSa3cpOoSKUiaviLmuctM7Pu2wzTkZkvZFG4PNIl8Ta6con0MdAUPsVJf__Uc79P51vxZbDnS8RNYAYvwspaLhSXLl5hAtuUGyWJi1WBnyur53C2jpWvkX_hnt3a8lFiMoL3Hkm')",
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-primary/80 to-transparent" />
          <div className="relative z-10 flex flex-col items-center w-full max-w-3xl px-4 text-center mt-12">
            <h1 className="font-display-lg text-display-lg text-white mb-4 drop-shadow-md">{t("heroTitle")}</h1>
            <p className="font-body-md text-body-md text-white/90 mb-8 max-w-xl mx-auto drop-shadow">
              {t("heroSubtitleLine1")}
              <br />
              {t("heroSubtitleLine2")}
            </p>
            <form
              onSubmit={handleSearch}
              className="w-full relative bg-surface rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.08)] flex items-center p-2 border border-outline-variant/30"
            >
              <span className="material-symbols-outlined text-outline ml-3 mr-2">search</span>
              <input
                className="w-full bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-outline-variant outline-none font-body-md"
                placeholder={t("searchPlaceholder")}
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
              />
              <button
                type="submit"
                className="bg-primary hover:bg-primary/90 text-white rounded-full w-10 h-10 flex items-center justify-center ml-2 transition-colors flex-shrink-0"
              >
                <span className="material-symbols-outlined">search</span>
              </button>
            </form>
          </div>
        </section>

        {/* Status cards */}
        {summary && environment && (() => {
          const condition = weatherCondition(environment.weather?.sky, environment.weather?.precipitationType)
          const pmGrade = Math.max(environment.airQuality?.pm10Grade ?? 0, environment.airQuality?.pm25Grade ?? 0) || null
          const pmStatus = STATUS[pmGradeToStatus(pmGrade)]
          const uv = uvToLevel(environment.uvIndex)
          const uvStatus = STATUS[uv.status]
          // 비시즌(10~5월)엔 API 자체가 값을 안 줘서 rip가 null일 수 있음 — 그때는
          // 색상 없이 "정보 없음"으로 표시(멀쩡한 status를 억지로 끼워맞추지 않음).
          const rip = haeundae?.ripCurrent
          const ripStatus = rip ? STATUS[ripLevelToStatus(rip.riskLevel)] : null

          return (
          <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-gutter">
            <StatCard label={t("weatherLabel")} icon={condition.icon} iconClass={condition.color}>
              <span className="font-score-display text-score-display text-on-surface leading-none">
                {environment.weather?.temperature}
                <span className="text-xl">°C</span>
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">{tCommon(`weatherCondition.${condition.textKey}`)}</span>
              <StatFooter
                left={[t("feelsLike", { value: fmt(environment.weather?.feelsLike, "°C") }), t("windSpeed", { value: fmt(environment.weather?.windSpeed, "m/s") })]}
                right={[t("humidity", { value: fmt(environment.weather?.humidity, "%") }), tCommon(`weatherCondition.${condition.textKey}`)]}
              />
            </StatCard>

            <StatCard label={t("airQualityLabel")} sub={t("busanAverage")} icon="sentiment_satisfied" iconClass={pmStatus.text}>
              <span className={`font-headline-lg-mobile text-headline-lg-mobile leading-none mb-1 ${pmStatus.text}`}>
                {pmGrade != null ? tCommon(`pmGrade.${pmGrade}`) : "-"}
              </span>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${pmStatus.bg}`} />
                <span className="font-label-sm text-[10px] text-outline">{t("pm25", { value: environment.airQuality?.pm25 })}</span>
              </div>
              <StatFooter single={[t("pm10", { value: environment.airQuality?.pm10 }), t("o3", { value: environment.airQuality?.o3 })]} />
            </StatCard>

            <StatCard label={t("uvLabel")} icon="light_mode" iconClass="text-tertiary-container">
              <span className={`font-headline-lg-mobile text-headline-lg-mobile leading-none mb-1 ${uvStatus.text}`}>
                {tCommon(`uvLevel.${uv.levelKey}`)}
              </span>
              <div className="flex items-center gap-1">
                <span className={`w-2 h-2 rounded-full ${uvStatus.bg}`} />
                <span className="font-label-sm text-[10px] text-outline">UV {environment.uvIndex}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-outline-variant/30">
                <span className="font-label-sm text-xs text-outline-variant">{t("sunscreenTip")}</span>
              </div>
            </StatCard>

            <StatCard label={t("ripLabel")} sub={t("haeundae")} icon="waves" iconClass={ripStatus ? ripStatus.text : "text-primary"}>
              <span className={`font-headline-lg-mobile text-headline-lg-mobile leading-none mb-1 ${ripStatus ? ripStatus.text : "text-on-surface-variant"}`}>
                {rip ? tCommon(`ripLevel.${rip.riskLevel}`) : t("noInfo")}
              </span>
              {ripStatus && <span className={`w-2 h-2 rounded-full ${ripStatus.bg} inline-block`} />}
              <div className="mt-2 pt-2 border-t border-outline-variant/30">
                <span className="font-label-sm text-xs text-outline-variant">
                  {rip ? t("waveInfo", { height: rip.waveHeight, temp: rip.waterTemp }) : t("seasonOnly")}
                </span>
              </div>
            </StatCard>

            <StatCard
              label={t("crowdLabel")}
              sub={`(${summary.crowdLevel.area})`}
              icon="groups"
              iconClass="text-error"
              className="hidden lg:flex"
            >
              <span className="font-headline-lg-mobile text-headline-lg-mobile text-error leading-none mb-1">
                {summary.crowdLevel.level}
              </span>
              <span className="w-2 h-2 rounded-full bg-error-container inline-block" />
              <StatFooter
                left={[t("foreignCount", { count: summary.crowdLevel.foreign.toLocaleString() })]}
                right={[t("domesticCount", { count: summary.crowdLevel.domestic.toLocaleString() })]}
              />
            </StatCard>
          </section>
          )
        })()}

        {/* TOP 10 */}
        <section className="flex flex-col gap-4">
          <div className="flex justify-between items-end border-b border-outline-variant/30 pb-2">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface">
              {t("top10Title")}
            </h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-gutter">
            {places.map((place) => {
              const status = STATUS[place.status ?? scoreToStatus(place.score)]
              return (
                <Link
                  key={place.id}
                  to={`/place/${place.id}`}
                  className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all cursor-pointer border border-outline-variant/10 group"
                >
                  <div className="relative h-32 w-full">
                    <img
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      src={place.image}
                      alt={place.name}
                    />
                    <div className="absolute top-2 left-2 bg-secondary-container text-on-secondary-fixed font-bold text-xs px-2 py-1 rounded-md shadow">
                      {place.rank}
                    </div>
                  </div>
                  <div className="p-4 flex flex-col gap-2">
                    <h3 className="font-body-md text-body-md font-bold text-on-surface truncate">{place.name}</h3>
                    <div className="flex items-center justify-between">
                      <div className="flex items-baseline gap-1">
                        <span className={`font-score-display text-2xl font-bold ${status.text}`}>{place.score}</span>
                        <span className={`font-label-sm text-[10px] font-bold ${status.text}`}>({tCommon(`status.${place.status ?? scoreToStatus(place.score)}`)})</span>
                      </div>
                      <span className="font-label-sm text-[10px] text-outline px-2 py-1 bg-surface-container rounded-full">
                        {place.category}
                      </span>
                    </div>
                  </div>
                </Link>
              )
            })}
          </div>
        </section>
      </div>
    </div>
  )
}

function StatCard({ label, sub, icon, iconClass, children, className = "" }) {
  return (
    <div
      className={`bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-shadow border border-outline-variant/20 flex flex-col justify-between ${className}`}
    >
      <div className="flex justify-between items-start mb-2">
        <span className="font-label-sm text-label-sm text-on-surface-variant font-bold">
          {label} {sub && <span className="font-normal">{sub}</span>}
        </span>
      </div>
      <div className="flex items-center gap-3 my-2">
        <span className={`material-symbols-outlined text-4xl filled-icon ${iconClass}`}>{icon}</span>
        <div className="flex flex-col">{children}</div>
      </div>
    </div>
  )
}

function StatFooter({ left, right, single }) {
  if (single) {
    return (
      <div className="grid grid-cols-1 gap-1 mt-2 pt-2 border-t border-outline-variant/30">
        {single.map((line) => (
          <span key={line} className="font-label-sm text-xs text-outline">
            {line}
          </span>
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-outline-variant/30">
      <div className="flex flex-col">
        {left.map((line) => (
          <span key={line} className="font-label-sm text-xs text-outline">
            {line}
          </span>
        ))}
      </div>
      {right && (
        <div className="flex flex-col">
          {right.map((line) => (
            <span key={line} className="font-label-sm text-xs text-outline">
              {line}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
