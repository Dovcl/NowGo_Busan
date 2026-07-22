import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { fetchHomeSummary, fetchTopPlaces } from "../services/scoreService"
import { STATUS, scoreToStatus } from "../lib/status"

export default function Home() {
  const [summary, setSummary] = useState(null)
  const [places, setPlaces] = useState([])

  useEffect(() => {
    fetchHomeSummary().then(setSummary)
    fetchTopPlaces().then(setPlaces)
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
            <h1 className="font-display-lg text-display-lg text-white mb-4 drop-shadow-md">지금, 부산 어디로 갈까?</h1>
            <p className="font-body-md text-body-md text-white/90 mb-8 max-w-xl mx-auto drop-shadow">
              실시간 환경과 혼잡도를 분석하여
              <br />
              지금 가기 좋은 관광지를 추천해드려요.
            </p>
            <div className="w-full relative bg-surface rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.08)] flex items-center p-2 border border-outline-variant/30">
              <span className="material-symbols-outlined text-outline ml-3 mr-2">search</span>
              <input
                className="w-full bg-transparent border-none focus:ring-0 text-on-surface placeholder:text-outline-variant outline-none font-body-md"
                placeholder="관광지, 지역, 키워드 검색 (예: 해운대, 광안리, 감천문화마을)"
                type="text"
              />
              <button
                type="button"
                className="bg-primary hover:bg-primary/90 text-white rounded-full w-10 h-10 flex items-center justify-center ml-2 transition-colors flex-shrink-0"
              >
                <span className="material-symbols-outlined">search</span>
              </button>
            </div>
          </div>
        </section>

        {/* Status cards */}
        {summary && (
          <section className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-gutter">
            <StatCard label="현재 부산 날씨" icon="sunny" iconClass="text-tertiary-fixed-dim">
              <span className="font-score-display text-score-display text-on-surface leading-none">
                {summary.currentWeather.tempC}
                <span className="text-xl">°C</span>
              </span>
              <span className="font-label-sm text-label-sm text-on-surface-variant mt-1">
                {summary.currentWeather.condition}
              </span>
              <StatFooter
                left={[`체감 ${summary.currentWeather.feelsLikeC}°C`, `바람 ${summary.currentWeather.windMs}m/s`]}
                right={[`습도 ${summary.currentWeather.humidityPct}%`, `강수확률 ${summary.currentWeather.rainChancePct}%`]}
              />
            </StatCard>

            <StatCard label="대기질" sub="(부산 평균)" icon="sentiment_satisfied" iconClass="text-on-secondary-container">
              <span className="font-headline-lg-mobile text-headline-lg-mobile text-on-secondary-container leading-none mb-1">
                {summary.airQuality.level}
              </span>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-secondary-container" />
                <span className="font-label-sm text-[10px] text-outline">PM2.5 {summary.airQuality.pm25}μg/m³</span>
              </div>
              <StatFooter single={[`PM10 ${summary.airQuality.pm10}μg/m³`, `O3 ${summary.airQuality.o3}ppm`]} />
            </StatCard>

            <StatCard label="자외선 지수" icon="light_mode" iconClass="text-tertiary-container">
              <span className="font-headline-lg-mobile text-headline-lg-mobile text-tertiary-container leading-none mb-1">
                {summary.uvIndex.level}
              </span>
              <div className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-tertiary-fixed-dim" />
                <span className="font-label-sm text-[10px] text-outline">UV {summary.uvIndex.uv}</span>
              </div>
              <div className="mt-2 pt-2 border-t border-outline-variant/30">
                <span className="font-label-sm text-xs text-outline-variant">외출 시 선크림을 챙기세요!</span>
              </div>
            </StatCard>

            <StatCard label="이안류 위험" sub={`(${summary.ripCurrentRisk.area})`} icon="waves" iconClass="text-primary">
              <span className="font-headline-lg-mobile text-headline-lg-mobile text-primary leading-none mb-1">
                {summary.ripCurrentRisk.level}
              </span>
              <span className="w-2 h-2 rounded-full bg-primary inline-block" />
              <div className="mt-2 pt-2 border-t border-outline-variant/30">
                <span className="font-label-sm text-xs text-outline-variant">현재 이안류 발생 위험이 낮습니다.</span>
              </div>
            </StatCard>

            <StatCard
              label="혼잡도"
              sub={`(${summary.crowdLevel.area})`}
              icon="groups"
              iconClass="text-error"
              className="hidden lg:flex"
            >
              <span className="font-headline-lg-mobile text-headline-lg-mobile text-error leading-none mb-1">
                {summary.crowdLevel.level}
              </span>
              <span className="w-2 h-2 rounded-full bg-error-container inline-block" />
              <StatFooter left={[`외국인 ${summary.crowdLevel.foreign.toLocaleString()}명`]} right={[`내국인 ${summary.crowdLevel.domestic.toLocaleString()}명`]} />
            </StatCard>
          </section>
        )}

        {/* TOP 10 */}
        <section className="flex flex-col gap-4">
          <div className="flex justify-between items-end border-b border-outline-variant/30 pb-2">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface">
              지금 가기 좋은 부산 관광지 TOP 10
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
                        <span className={`font-label-sm text-[10px] font-bold ${status.text}`}>({status.label})</span>
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
