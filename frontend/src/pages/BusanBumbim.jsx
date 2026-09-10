import { useEffect, useRef, useState } from "react"
import { useTranslation } from "react-i18next"
import { fetchPlaces } from "../services/placesService"
import { fetchEnvironment, fetchTrafficHistory } from "../services/environmentService"
import { demoTrafficFor, demoHistoryCurveFor } from "../lib/bumbimDemoData"
import { useKakaoMap } from "../hooks/useKakaoMap"

// TourAPI sigungucode(부산 16개 구·군) — backend/etl/seed_data/tour_areaCode2_busan_sigungu.csv와 동일
// 이름은 t(`districts.${code}`, {ns: "bumbim"})로 조회.
const DISTRICTS = [
  { code: 12 },
  { code: 16 },
  { code: 15 },
  { code: 11 },
  { code: 5 },
  { code: 14 },
  { code: 7 },
  { code: 6 },
  { code: 4 },
  { code: 8 },
  { code: 10 },
  { code: 2 },
  { code: 1 },
  { code: 13 },
  { code: 9 },
  { code: 3 },
]

// s_traffic(0~1, 높을수록 원활) → "혼잡 지수"(0~100, 높을수록 혼잡)로 뒤집어 표시.
// 인구수가 아니라 도로 원활도 기반 지수라는 걸 문구로 항상 같이 알려준다.
// Tailwind는 빌드 시 소스에 리터럴로 등장하는 클래스명만 인식한다 — 런타임에
// `border-${tone}`처럼 조합하면 프로덕션 빌드에서 스타일이 통째로 빠지므로,
// 색상별로 필요한 클래스 전부를 미리 문자열로 박아둔다(status.js의 STATUS와 동일 패턴).
// label/adjective는 t(`trafficTier.label.${key}`)/t(`trafficTier.adjective.${key}`)로 조회.
const TRAFFIC_TIERS = [
  { max: 30, key: "light", text: "text-chart-2", bg: "bg-chart-2", bgSoft: "bg-chart-2/20", border: "border-chart-2" },
  { max: 60, key: "moderate", text: "text-chart-3", bg: "bg-chart-3", bgSoft: "bg-chart-3/20", border: "border-chart-3" },
  { max: 80, key: "busy", text: "text-chart-4", bg: "bg-chart-4", bgSoft: "bg-chart-4/20", border: "border-chart-4" },
  { max: 100, key: "veryBusy", text: "text-error", bg: "bg-error", bgSoft: "bg-error/20", border: "border-error" },
]

function congestionOf(env) {
  const sTraffic = env?.trafficCongestion?.sTraffic
  return sTraffic != null ? Math.round((1 - sTraffic) * 100) : null
}

function trafficTier(congestion) {
  if (congestion == null) return null
  return TRAFFIC_TIERS.find((t) => congestion <= t.max) ?? TRAFFIC_TIERS[TRAFFIC_TIERS.length - 1]
}

const MAX_SPOTS = 6

export default function BusanBumbim() {
  const { t, i18n } = useTranslation("bumbim")
  const [districtCode, setDistrictCode] = useState(12)
  const [spots, setSpots] = useState([])
  const [spotEnvs, setSpotEnvs] = useState({})
  const [focalSpotId, setFocalSpotId] = useState(null)
  const [loadingSpots, setLoadingSpots] = useState(false)
  const [loadError, setLoadError] = useState(false)
  // 실제 관광지 이름·좌표는 그대로 쓰고 혼잡도 숫자만 가상으로 채우는 팀 데모용 모드.
  // baseline이 cold-start라 지금은 전부 district_fallback으로 똑같은 값만 나오는데,
  // baseline이 몇 주 쌓였을 때 화면이 어떻게 갈리는지 팀원들에게 미리 보여주기 위함.
  const [demoMode, setDemoMode] = useState(false)

  useEffect(() => {
    setLoadingSpots(true)
    setLoadError(false)
    setSpotEnvs({})
    setFocalSpotId(null)
    fetchPlaces({ sigungucode: districtCode })
      .then((places) => {
        const withCoords = places.filter((p) => p.lat != null && p.lng != null)
        // 실제 관광 목적 장소만 우선(음식점 등 제외) — 결과가 너무 적으면 전체로 폴백
        const curated = withCoords.filter((p) => p.isEnvTarget)
        setSpots((curated.length >= 2 ? curated : withCoords).slice(0, MAX_SPOTS))
        setLoadingSpots(false)
      })
      .catch(() => {
        // 백엔드가 꺼져있는 등 네트워크 실패 시 무한 "불러오는 중"에 갇히지 않도록
        setLoadingSpots(false)
        setLoadError(true)
      })
  }, [districtCode, i18n.language])

  useEffect(() => {
    if (spots.length === 0) return

    if (demoMode) {
      const map = {}
      spots.forEach((s) => {
        map[s.id] = { trafficCongestion: demoTrafficFor(s) }
      })
      setSpotEnvs(map)
      return
    }

    Promise.allSettled(spots.map((s) => fetchEnvironment(s.lat, s.lng))).then((results) => {
      const map = {}
      results.forEach((r, i) => {
        if (r.status === "fulfilled") map[spots[i].id] = r.value
      })
      setSpotEnvs(map)
    })
  }, [spots, demoMode])

  const focalSpot = spots.find((s) => s.id === focalSpotId) ?? spots[0] ?? null
  const focalEnv = focalSpot ? spotEnvs[focalSpot.id] : null
  const traffic = focalEnv?.trafficCongestion
  const congestion = congestionOf(focalEnv)
  const tier = trafficTier(congestion)
  const district = DISTRICTS.find((d) => d.code === districtCode)

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-container-margin py-4 md:py-8 pb-24 md:pb-8 max-w-[1440px] mx-auto w-full flex gap-gutter flex-col md:flex-row">
        {/* 지역 선택 */}
        <aside className="w-full md:w-56 flex-shrink-0">
          <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/20 p-4">
            <h2 className="font-label-sm text-label-sm text-on-surface-variant font-bold mb-3 px-2">{t("districtSelectTitle")}</h2>
            <ul className="space-y-1 text-sm max-h-[70vh] overflow-y-auto">
              {DISTRICTS.map((d) => (
                <li key={d.code}>
                  <button
                    type="button"
                    onClick={() => setDistrictCode(d.code)}
                    className={`w-full text-left px-3 py-2 rounded-lg transition-colors ${
                      d.code === districtCode
                        ? "bg-primary text-on-primary font-bold"
                        : "text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    {t(`districts.${d.code}`)}
                  </button>
                </li>
              ))}
            </ul>
            <p className="font-label-sm text-[10px] text-outline-variant px-2 mt-3">
              {t("sidebarNoteLine1")}
              <br />
              {t("sidebarNoteLine2")}
              <br />
              {t("sidebarNoteLine3")}
            </p>
          </div>
        </aside>

        {/* 메인 콘텐츠 */}
        <div className="flex-1 flex flex-col gap-4 min-w-0">
          <DemoModeBanner demoMode={demoMode} onToggle={() => setDemoMode((v) => !v)} />

          {loadError ? (
            <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-error/30 p-6 flex flex-col items-center gap-2 text-center">
              <span className="material-symbols-outlined text-error text-3xl">cloud_off</span>
              <p className="font-body-md text-on-surface font-bold">{t("backendErrorTitle")}</p>
              <p className="font-label-sm text-xs text-outline">{t("backendErrorBody")}</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <div className="lg:col-span-2 flex flex-col gap-4">
                  <FocalCard spot={focalSpot} district={district} congestion={congestion} tier={tier} traffic={traffic} loading={loadingSpots} />
                  <HistoryCard focalSpot={focalSpot} demoMode={demoMode} />
                </div>
                <div className="lg:col-span-1 flex flex-col gap-4">
                  <MapPanel spots={spots} spotEnvs={spotEnvs} focalSpot={focalSpot} onSelect={setFocalSpotId} />
                  <ChoiceList spots={spots} spotEnvs={spotEnvs} focalSpotId={focalSpot?.id} onSelect={setFocalSpotId} />
                </div>
              </div>

              <RecommendationCards spots={spots} spotEnvs={spotEnvs} onSelect={setFocalSpotId} />
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function FocalCard({ spot, district, congestion, tier, traffic, loading }) {
  const { t } = useTranslation("bumbim")
  if (loading || !spot) {
    return (
      <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/20 p-6 flex items-center justify-center h-64">
        <span className="font-body-md text-outline">{t("loading")}</span>
      </div>
    )
  }

  const isDistrictFallback = traffic?.status === "district_fallback"

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/20 p-6 flex flex-col md:flex-row gap-8 items-center">
      <div className="flex-1 w-full">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile font-bold text-on-surface mb-1">
          {tier ? (
            <>
              {t("focalTitlePrefix", { name: spot.name })}
              <span className={tier.text}>{t(`trafficTier.adjective.${tier.key}`)}</span>
              {t("focalTitleSuffix")}
            </>
          ) : (
            t("focalTitleCollecting", { name: spot.name })
          )}
        </h1>
        <p className="font-label-sm text-label-sm text-outline mb-4">
          {t("recentHourBasis", { district: district ? t(`districts.${district.code}`) : "" })}
          {isDistrictFallback && t("districtFallbackNote")}
        </p>
        {traffic?.nearbyEvent && (
          <div className="flex items-center gap-1 text-xs text-primary font-bold mb-4">
            <span className="material-symbols-outlined text-[16px]">celebration</span>
            {t("nearbyEvent", { event: traffic.nearbyEvent })}
          </div>
        )}

        {congestion != null ? (
          <>
            <Gauge congestion={congestion} tier={tier} />
            <p className="font-label-sm text-xs text-outline text-center mt-2">{t("gaugeNote")}</p>
          </>
        ) : (
          <p className="font-body-md text-body-md text-outline py-8 text-center">{t("noRoadData")}</p>
        )}
      </div>

      {!isDistrictFallback && congestion != null && (
        <div className="grid grid-cols-2 gap-3 flex-1 w-full">
          <InfoCard icon="trending_down" iconClass={tier?.text} label={t("infoCard.slowerThanUsual")} value={`+${congestion}%`} valueClass={tier?.text} sub={t("infoCard.vsBaseline")} />
          <InfoCard icon="speed" iconClass="text-primary" label={t("infoCard.currentSpeed")} value={fmtSpeed(traffic?.currentSpeed)} sub={t("infoCard.nearbyRoadAvg")} />
          <InfoCard icon="schedule" iconClass="text-outline" label={t("infoCard.usualSpeed")} value={fmtSpeed(traffic?.baselineSpeed)} sub={t("infoCard.dowHourBaseline")} />
          <InfoCard icon="traffic" iconClass="text-chart-4" label={t("infoCard.congestedSection")} value={traffic?.congestedRoadName ?? t("infoCard.noInfo")} valueClass="text-primary" sub={t("infoCard.lowestSpeedLink")} small />
        </div>
      )}
    </div>
  )
}

function fmtSpeed(v) {
  return v != null ? `${v.toFixed(1)}km/h` : "-"
}

function Gauge({ congestion, tier }) {
  const { t } = useTranslation("bumbim")
  const circumference = 283
  const offset = circumference - (circumference * congestion) / 100
  return (
    <div className="relative w-48 h-24 mx-auto overflow-hidden">
      <svg className="w-full h-full" viewBox="0 0 200 100">
        <path d="M 10 100 A 90 90 0 0 1 190 100" fill="none" stroke="#E5E7EB" strokeLinecap="round" strokeWidth="16" />
        <path
          d="M 10 100 A 90 90 0 0 1 190 100"
          fill="none"
          className={tier?.text}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          strokeWidth="16"
        />
      </svg>
      <div className="absolute bottom-0 left-0 w-full text-center">
        <div className={`font-bold text-xl mb-1 ${tier?.text}`}>{tier ? t(`trafficTier.label.${tier.key}`) : null}</div>
        <div className="text-on-surface flex items-baseline justify-center gap-1">
          <span className="text-sm text-outline">{t("indexLabel")}</span>
          <span className="font-score-display text-3xl font-bold">{congestion}</span>
          <span className="text-sm text-outline">/100</span>
        </div>
      </div>
    </div>
  )
}

function InfoCard({ icon, iconClass, label, value, valueClass = "text-on-surface", sub, small }) {
  return (
    <div className="border border-outline-variant/30 rounded-xl p-3 flex flex-col items-center justify-center text-center">
      <span className={`material-symbols-outlined mb-1 ${iconClass}`}>{icon}</span>
      <div className="font-label-sm text-xs font-bold text-on-surface mb-1">{label}</div>
      <div className={`font-bold ${small ? "text-sm" : "text-lg"} ${valueClass}`}>{value}</div>
      <div className="font-label-sm text-[10px] text-outline">{sub}</div>
    </div>
  )
}

function DemoModeBanner({ demoMode, onToggle }) {
  const { t } = useTranslation("bumbim")
  return (
    <div
      className={`rounded-xl border px-4 py-3 flex flex-wrap items-center justify-between gap-2 text-sm ${
        demoMode ? "bg-tertiary-fixed/30 border-tertiary" : "bg-surface-container-lowest border-outline-variant/20"
      }`}
    >
      <div className="flex items-center gap-2">
        <span className="material-symbols-outlined text-lg">{demoMode ? "science" : "verified"}</span>
        <span className="font-bold text-on-surface">{demoMode ? t("demoBanner.viewingDemoData") : t("demoBanner.realData")}</span>
        {demoMode && (
          <span className="font-label-sm text-xs text-on-surface-variant">{t("demoBanner.demoNote")}</span>
        )}
      </div>
      <button type="button" onClick={onToggle} className="font-label-sm text-xs font-bold text-primary underline">
        {demoMode ? t("demoBanner.viewRealData") : t("demoBanner.viewDemoData")}
      </button>
    </div>
  )
}

// baseline이 최소 2시간대 이상 신뢰 가능(sample_count>=3)해야 그래프를 그릴 의미가
// 있다고 판단 — 그 전엔 기존 "데이터 수집 중" 문구를 그대로 유지한다.
function hasEnoughRealHistory(hours) {
  return hours && hours.filter((h) => h.baselineSpeed != null).length >= 2
}

function HistoryCard({ focalSpot, demoMode }) {
  const { t } = useTranslation("bumbim")
  const [realHistory, setRealHistory] = useState(null)

  useEffect(() => {
    if (demoMode || !focalSpot) {
      setRealHistory(null)
      return
    }
    fetchTrafficHistory(focalSpot.lat, focalSpot.lng)
      .then(setRealHistory)
      .catch(() => setRealHistory(null))
  }, [demoMode, focalSpot])

  const demoCurve = demoMode && focalSpot ? demoHistoryCurveFor(focalSpot) : null
  const showReal = !demoMode && hasEnoughRealHistory(realHistory)

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/20 p-6">
      <h3 className="font-body-md text-on-surface font-bold mb-1">{t("historyTitle")}</h3>
      {demoCurve ? (
        <HistoryChart curve={demoCurve} />
      ) : showReal ? (
        <RealHistoryChart hours={realHistory} />
      ) : (
        <div className="flex flex-col items-center justify-center gap-2 h-40 border border-dashed border-outline-variant rounded-lg text-outline">
          <span className="material-symbols-outlined text-2xl">hourglass_top</span>
          <p className="font-label-sm text-xs text-center px-6">{t("collectingHistory")}</p>
        </div>
      )}
      <p className="font-label-sm text-[10px] text-outline mt-2">
        {t("historyFooter", { demoSuffix: demoCurve ? t("demoSuffix") : "" })}
      </p>
    </div>
  )
}

// 실측 그래프는 데모(0~100 혼잡 지수)와 달리 km/h 원본 속도 두 줄을 그대로 겹쳐 보여준다 —
// baseline을 그 자신과 비교한 지수는 의미가 없어서(항상 100%가 됨), 두 속도 차이 자체를
// 눈으로 보여주는 쪽이 더 정직하다. 관측 없는 시간대는 null이라 선을 끊어 그려야 해서
// 구간(segment)별로 나눠 폴리라인을 여러 개 그린다.
function RealHistoryChart({ hours }) {
  const { t } = useTranslation("bumbim")
  const speeds = hours.flatMap((h) => [h.currentSpeed, h.baselineSpeed]).filter((v) => v != null)
  const maxSpeed = Math.max(...speeds, 10)
  const x = (h) => 40 + (h / 23) * 760
  const y = (v) => 180 - (v / maxSpeed) * 160
  const nowHour = new Date().getHours()

  function segmentsFor(key) {
    const segments = []
    let current = []
    hours.forEach((h, i) => {
      const v = h[key]
      if (v == null) {
        if (current.length > 1) segments.push(current)
        current = []
      } else {
        current.push(`${x(i)},${y(v)}`)
      }
    })
    if (current.length > 1) segments.push(current)
    return segments
  }

  return (
    <div className="relative w-full">
      <svg className="block w-full h-[200px] text-outline-variant" viewBox="0 0 800 200" preserveAspectRatio="none">
        {[0, 0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1="40" x2="800" y1={y(maxSpeed * f)} y2={y(maxSpeed * f)} stroke="currentColor" strokeDasharray="4" strokeWidth="1" />
        ))}
        <line x1="40" x2="800" y1={y(0)} y2={y(0)} stroke="currentColor" strokeWidth="1" />
        {[0, 0.25, 0.5, 0.75, 1].map((f) => (
          <text key={f} className="text-xs fill-outline" textAnchor="end" x="30" y={y(maxSpeed * f) + 4}>
            {Math.round(maxSpeed * f)}
          </text>
        ))}
        {[0, 3, 6, 9, 12, 15, 18, 21, 23].map((h) => (
          <text key={h} className="text-xs fill-outline" textAnchor="middle" x={x(h)} y="195">
            {t("hourSuffix", { hour: h })}
          </text>
        ))}
        {segmentsFor("baselineSpeed").map((seg, i) => (
          <polyline key={`b${i}`} fill="none" points={seg.join(" ")} stroke="#8B5CF6" strokeDasharray="6 4" strokeWidth="2" />
        ))}
        {segmentsFor("currentSpeed").map((seg, i) => (
          <polyline key={`a${i}`} fill="none" points={seg.join(" ")} className="text-primary" stroke="currentColor" strokeWidth="2" />
        ))}
        <line x1={x(nowHour)} x2={x(nowHour)} y1="20" y2="180" stroke="#434653" strokeDasharray="2" strokeWidth="1" />
        <rect fill="#273143" height="20" rx="4" width="36" x={x(nowHour) - 18} y="0" />
        <text className="text-[10px] fill-white" textAnchor="middle" x={x(nowHour)} y="14">
          {t("nowLabel")}
        </text>
      </svg>
      <div className="flex items-center gap-4 mt-1 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 bg-primary inline-block" /> {t("actualSpeedLegend")}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 border-b-2 border-dashed border-[#8B5CF6] inline-block" /> {t("baselineSpeedLegend")}
        </span>
      </div>
    </div>
  )
}

function HistoryChart({ curve }) {
  const { t } = useTranslation("bumbim")
  const x = (h) => 40 + (h / 24) * 760
  const y = (v) => 180 - (v / 100) * 160
  const toPoints = (values) => curve.hours.map((h, i) => `${x(h)},${y(values[i])}`).join(" ")
  const nowHour = new Date().getHours()

  return (
    <div className="relative w-full">
      <svg className="block w-full h-[200px] text-outline-variant" viewBox="0 0 800 200" preserveAspectRatio="none">
        {[0, 25, 50, 75].map((v) => (
          <line key={v} x1="40" x2="800" y1={y(v)} y2={y(v)} stroke="currentColor" strokeDasharray="4" strokeWidth="1" />
        ))}
        <line x1="40" x2="800" y1={y(0)} y2={y(0)} stroke="currentColor" strokeWidth="1" />
        {[0, 25, 50, 75, 100].map((v) => (
          <text key={v} className="text-xs fill-outline" textAnchor="end" x="30" y={y(v) + 4}>
            {v}
          </text>
        ))}
        {[0, 3, 6, 9, 12, 15, 18, 21, 24].map((h) => (
          <text key={h} className="text-xs fill-outline" textAnchor="middle" x={x(h)} y="195">
            {t("hourSuffix", { hour: h })}
          </text>
        ))}
        <polyline fill="none" points={toPoints(curve.baseline)} stroke="#8B5CF6" strokeDasharray="6 4" strokeWidth="2" />
        <polyline fill="none" points={toPoints(curve.actual)} className="text-primary" stroke="currentColor" strokeWidth="2" />
        <line x1={x(nowHour)} x2={x(nowHour)} y1="20" y2="180" stroke="#434653" strokeDasharray="2" strokeWidth="1" />
        <rect fill="#273143" height="20" rx="4" width="36" x={x(nowHour) - 18} y="0" />
        <text className="text-[10px] fill-white" textAnchor="middle" x={x(nowHour)} y="14">
          {t("nowLabel")}
        </text>
      </svg>
      <div className="flex items-center gap-4 mt-1 text-xs text-on-surface-variant">
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 bg-primary inline-block" /> {t("actualDemoLegend")}
        </span>
        <span className="flex items-center gap-1">
          <span className="w-4 h-0.5 border-b-2 border-dashed border-[#8B5CF6] inline-block" /> {t("baselineDemoLegend")}
        </span>
      </div>
    </div>
  )
}

const BUSAN_CENTER = { lat: 35.1796, lng: 129.0756 }

function MapPanel({ spots, spotEnvs, focalSpot, onSelect }) {
  const { t } = useTranslation("bumbim")
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const overlaysRef = useRef([])
  const { kakao, error } = useKakaoMap()

  const withCoords = spots.filter((s) => spotEnvs[s.id] && congestionOf(spotEnvs[s.id]) != null)

  // 지도 인스턴스는 딱 한 번만 생성 — 리마운트 없이 이후엔 마커만 다시 그린다.
  useEffect(() => {
    if (!kakao || !containerRef.current || mapRef.current) return
    mapRef.current = new kakao.maps.Map(containerRef.current, {
      center: new kakao.maps.LatLng(BUSAN_CENTER.lat, BUSAN_CENTER.lng),
      level: 6,
    })
  }, [kakao])

  // 좌측 패널 열림/닫힘 등으로 컨테이너 너비가 바뀔 때 카카오맵이 자동으로 못 알아채서
  // relayout()을 직접 호출해야 한다(KakaoMap.jsx와 동일한 이유).
  useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver(() => mapRef.current?.relayout())
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [kakao])

  useEffect(() => {
    if (!kakao || !mapRef.current) return
    overlaysRef.current.forEach((o) => o.setMap(null))
    overlaysRef.current = []
    if (withCoords.length === 0) return

    const bounds = new kakao.maps.LatLngBounds()
    withCoords.forEach((s) => {
      const tier = trafficTier(congestionOf(spotEnvs[s.id]))
      const isFocal = s.id === focalSpot?.id
      const size = isFocal ? 56 : 40

      const content = document.createElement("div")
      content.className = `${tier.bg} rounded-full text-white font-bold text-center flex items-center justify-center shadow-lg border-2 border-white cursor-pointer hover:scale-105 transition-transform ${
        isFocal ? "ring-4 ring-primary" : ""
      }`
      content.style.width = `${size}px`
      content.style.height = `${size}px`
      content.style.fontSize = "10px"
      content.textContent = s.name.length > 5 ? `${s.name.slice(0, 4)}…` : s.name
      content.title = `${s.name} · ${t(`trafficTier.label.${tier.key}`)}`
      content.addEventListener("click", () => onSelect(s.id))

      const position = new kakao.maps.LatLng(s.lat, s.lng)
      const overlay = new kakao.maps.CustomOverlay({ map: mapRef.current, position, content, yAnchor: 0.5 })
      overlaysRef.current.push(overlay)
      bounds.extend(position)
    })
    mapRef.current.setBounds(bounds)
  }, [kakao, withCoords, spotEnvs, focalSpot, onSelect, t])

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/20 p-4 relative h-64 overflow-hidden">
      <div ref={containerRef} className="absolute inset-0" />
      {error && (
        <div className="absolute inset-0 flex items-center justify-center text-outline font-label-sm text-xs text-center px-6 bg-surface-container-low">
          {error}
        </div>
      )}
      {!error && withCoords.length === 0 && (
        <div className="absolute inset-0 flex items-center justify-center text-outline font-label-sm text-xs bg-surface-container-low/80">
          {t("noMapData")}
        </div>
      )}
      <div className="absolute bottom-2 left-2 right-2 bg-white/90 backdrop-blur rounded-lg p-2 flex flex-wrap justify-between gap-1 items-center text-[9px] border border-outline-variant shadow-sm">
        {TRAFFIC_TIERS.map((tier) => (
          <div key={tier.key} className="flex items-center gap-1">
            <div className={`w-2 h-2 rounded-full ${tier.bg}`} /> {t(`trafficTier.label.${tier.key}`)}
          </div>
        ))}
      </div>
    </div>
  )
}

function ChoiceList({ spots, spotEnvs, focalSpotId, onSelect }) {
  const { t } = useTranslation("bumbim")
  const rows = spots
    .map((s) => ({ spot: s, congestion: congestionOf(spotEnvs[s.id]) }))
    .sort((a, b) => (b.congestion ?? -1) - (a.congestion ?? -1))

  return (
    <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/20 p-4 flex-1">
      <h3 className="font-label-sm text-label-sm text-on-surface-variant font-bold mb-2">{t("choiceListTitle")}</h3>
      <ul className="flex flex-col divide-y divide-outline-variant/20">
        {rows.map(({ spot, congestion }) => {
          const tier = trafficTier(congestion)
          return (
            <li key={spot.id}>
              <button
                type="button"
                onClick={() => onSelect(spot.id)}
                className={`w-full flex items-center justify-between gap-2 py-2 text-left ${
                  spot.id === focalSpotId ? "font-bold text-primary" : "text-on-surface"
                }`}
              >
                <span className="text-sm truncate">{spot.name}</span>
                {tier ? (
                  <span className={`font-label-sm text-[10px] font-bold px-2 py-0.5 rounded-full ${tier.text} bg-surface-container`}>
                    {t(`trafficTier.label.${tier.key}`)}
                  </span>
                ) : (
                  <span className="font-label-sm text-[10px] text-outline">{t("collecting")}</span>
                )}
              </button>
            </li>
          )
        })}
        {rows.length === 0 && <li className="font-label-sm text-xs text-outline py-2">{t("loadingDistrictSpots")}</li>}
      </ul>
    </div>
  )
}

function RecommendationCards({ spots, spotEnvs, onSelect }) {
  const { t } = useTranslation("bumbim")
  const withData = spots
    .map((s) => ({ spot: s, congestion: congestionOf(spotEnvs[s.id]) }))
    .filter((r) => r.congestion != null)
    .sort((a, b) => a.congestion - b.congestion)

  if (withData.length < 2) return null

  const best = withData[0]
  const worst = withData[withData.length - 1]
  const mid = withData[Math.floor(withData.length / 2)]
  const picks = [
    { ...best, badgeKey: "goodNow", icon: "thumb_up" },
    ...(mid !== best && mid !== worst ? [{ ...mid, badgeKey: "moderate", icon: "directions_car" }] : []),
    { ...worst, badgeKey: "avoidPeak", icon: "warning" },
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {picks.map(({ spot, congestion, badgeKey, icon }) => {
        const tier = trafficTier(congestion)
        return (
          <button
            key={spot.id}
            type="button"
            onClick={() => onSelect(spot.id)}
            className={`bg-surface-container-lowest border ${tier.border} rounded-xl p-4 flex items-center justify-between text-left hover:shadow-md transition-shadow`}
          >
            <div>
              <div className={`flex items-center gap-1 ${tier.text} text-sm font-bold mb-1`}>
                {t(`badge.${badgeKey}`)} <span className="material-symbols-outlined text-[16px]">{icon}</span>
              </div>
              <h4 className="text-lg font-bold text-on-surface mb-1">{spot.name}</h4>
              <div className="text-xs text-outline">{t(`trafficTier.label.${tier.key}`)} · {t("congestionIndexValue", { value: congestion })}</div>
            </div>
            <div className={`w-12 h-12 rounded-full ${tier.bgSoft} flex items-center justify-center`}>
              <span className={`material-symbols-outlined ${tier.text}`}>{icon}</span>
            </div>
          </button>
        )
      })}
    </div>
  )
}
