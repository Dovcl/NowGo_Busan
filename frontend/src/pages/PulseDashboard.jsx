import { useEffect, useState } from "react"
import { fetchDistricts, fetchPulseDashboard } from "../services/scoreService"

const CIRCUMFERENCE = 2 * Math.PI * 40

export default function PulseDashboard() {
  const [districts, setDistricts] = useState([])
  const [selected, setSelected] = useState("수영구")
  const [data, setData] = useState(null)

  useEffect(() => {
    fetchDistricts().then(setDistricts)
  }, [])

  useEffect(() => {
    fetchPulseDashboard(selected).then(setData)
  }, [selected])

  const donutSegments = (data?.nationalityShare ?? []).reduce((acc, seg) => {
    const prevOffset = acc.length ? acc[acc.length - 1].nextOffset : 0
    const dash = (seg.pct / 100) * CIRCUMFERENCE
    acc.push({ ...seg, dash, offset: -prevOffset, nextOffset: prevOffset + dash })
    return acc
  }, [])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto w-full px-container-margin py-section-gap pb-24 md:pb-8 flex gap-gutter flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full md:w-64 flex-shrink-0">
          <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-card-padding">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface mb-stack-gap">지역 선택</h2>
            <ul className="space-y-1">
              {districts.map((d) => (
                <li key={d}>
                  <button
                    type="button"
                    onClick={() => setSelected(d)}
                    className={`w-full text-left block px-4 py-2 rounded-lg transition-colors ${
                      d === selected
                        ? "bg-surface-container-high text-primary font-bold"
                        : "text-on-surface-variant hover:bg-surface-container"
                    }`}
                  >
                    {d}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        {/* Content */}
        {data && (
          <div className="flex-1 flex flex-col gap-gutter">
            <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-card-padding">
              <div className="flex justify-between items-center mb-6">
                <h1 className="font-headline-lg text-headline-lg text-on-surface">
                  {data.district} 방문자 현황{" "}
                  <span className="text-label-sm font-label-sm text-outline ml-2 font-normal">({data.updatedLabel})</span>
                </h1>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-stack-gap">
                <Kpi icon="groups" iconClass="text-chart-1" label="외국인 방문자" value={data.kpis.foreign.count} deltaPct={data.kpis.foreign.deltaPct} />
                <Kpi icon="group" iconClass="text-chart-2" label="내국인 방문자" value={data.kpis.domestic.count} deltaPct={data.kpis.domestic.deltaPct} />
                <Kpi icon="public" iconClass="text-chart-3" label="전체 방문자" value={data.kpis.total.count} deltaPct={data.kpis.total.deltaPct} />
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-gutter">
              <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-card-padding lg:col-span-2">
                <h3 className="font-body-md text-on-surface font-bold mb-4">시간대별 방문자 추이</h3>
                <div className="relative h-[300px] w-full">
                  <svg className="w-full h-full text-outline-variant" viewBox="0 0 800 300">
                    <line stroke="currentColor" strokeDasharray="4" strokeWidth="1" x1="50" x2="750" y1="50" y2="50" />
                    <line stroke="currentColor" strokeDasharray="4" strokeWidth="1" x1="50" x2="750" y1="125" y2="125" />
                    <line stroke="currentColor" strokeDasharray="4" strokeWidth="1" x1="50" x2="750" y1="200" y2="200" />
                    <line stroke="currentColor" strokeWidth="1" x1="50" x2="750" y1="275" y2="275" />
                    <text className="text-xs fill-outline" textAnchor="end" x="30" y="55">15k</text>
                    <text className="text-xs fill-outline" textAnchor="end" x="30" y="130">10k</text>
                    <text className="text-xs fill-outline" textAnchor="end" x="30" y="205">5k</text>
                    <text className="text-xs fill-outline" textAnchor="end" x="30" y="280">0</text>
                    <text className="text-xs fill-outline" textAnchor="middle" x="50" y="295">00시</text>
                    <text className="text-xs fill-outline" textAnchor="middle" x="190" y="295">04시</text>
                    <text className="text-xs fill-outline" textAnchor="middle" x="330" y="295">08시</text>
                    <text className="text-xs fill-outline" textAnchor="middle" x="470" y="295">12시</text>
                    <text className="text-xs fill-outline" textAnchor="middle" x="610" y="295">16시</text>
                    <text className="text-xs fill-outline" textAnchor="middle" x="750" y="295">20시</text>
                    <polyline fill="none" points="50,250 120,230 190,260 260,200 330,120 400,100 470,140 540,160 610,130 680,180 750,210" stroke="#4F46E5" strokeWidth="3" />
                    <polyline fill="none" points="50,220 120,200 190,240 260,180 330,90 400,70 470,110 540,130 610,100 680,150 750,190" stroke="#10B981" strokeWidth="3" />
                    <circle cx="650" cy="20" fill="#4F46E5" r="4" />
                    <text className="text-xs fill-on-surface" x="660" y="24">외국인</text>
                    <circle cx="710" cy="20" fill="#10B981" r="4" />
                    <text className="text-xs fill-on-surface" x="720" y="24">내국인</text>
                  </svg>
                </div>
              </div>

              <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-card-padding">
                <h3 className="font-body-md text-on-surface font-bold mb-4">
                  외국인 국적 비율 <span className="text-outline text-sm font-normal">({data.district})</span>
                </h3>
                <div className="flex items-center justify-center h-64 gap-8">
                  <div className="relative w-48 h-48">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" fill="transparent" r="40" stroke="#E5E7EB" strokeWidth="20" />
                      {donutSegments.map((seg) => (
                        <circle
                          key={seg.label}
                          cx="50"
                          cy="50"
                          fill="transparent"
                          r="40"
                          stroke={seg.color}
                          strokeDasharray={`${seg.dash} ${CIRCUMFERENCE}`}
                          strokeDashoffset={seg.offset}
                          strokeWidth="20"
                        />
                      ))}
                    </svg>
                  </div>
                  <div className="flex flex-col gap-2">
                    {data.nationalityShare.map((seg) => (
                      <div key={seg.label} className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: seg.color }} />
                        <span className="text-sm">{seg.label}</span>
                        <span className="ml-auto font-bold text-sm">{seg.pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-outline text-center mt-4">※ SKT 로밍 데이터 기반 (추정)</p>
              </div>

              <div className="bg-surface-container-lowest rounded-xl shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-card-padding">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-body-md text-on-surface font-bold">주요 자치구별 외국인 방문객</h3>
                </div>
                <div className="flex flex-col gap-3 mt-4">
                  {data.districtForeignVisitors.map((row) => (
                    <div key={row.label}>
                      <div className="flex justify-between text-sm mb-1">
                        <span className={row.highlight ? "text-on-surface font-bold text-primary" : "text-on-surface"}>{row.label}</span>
                        <span className={`font-bold ${row.highlight ? "text-primary" : "text-on-surface"}`}>{row.count.toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-surface-container-low rounded-full h-2">
                        <div className="bg-primary h-2 rounded-full" style={{ width: `${row.widthPct}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function Kpi({ icon, iconClass, label, value, deltaPct }) {
  return (
    <div className="bg-surface-container-low rounded-lg p-4 flex flex-col justify-between">
      <div className="flex items-center gap-2 mb-2">
        <span className={`material-symbols-outlined filled-icon ${iconClass}`}>{icon}</span>
        <span className="font-body-md text-on-surface-variant">{label}</span>
      </div>
      <div>
        <div className="font-score-display text-score-display text-on-surface">
          {value.toLocaleString()}
          <span className="text-body-md">명</span>
        </div>
        <div className="text-secondary flex items-center text-sm mt-1">
          <span className="material-symbols-outlined text-sm">arrow_upward</span> {deltaPct}%{" "}
          <span className="text-outline ml-1">(전시간 대비)</span>
        </div>
      </div>
    </div>
  )
}
