// 수집 파이프라인 데이터 점검 — 관리자 전용. require_admin이 실제 보안 경계
// (routers/admin_data.py), 여기 role 체크는 UX일 뿐(AdminEventReview.jsx와 같은 패턴).
//
// 날씨/도로교통/공휴일 등 배치 ETL이 실제로 잘 쌓이고 있는지 테이블 그대로 눈으로
// 확인하기 위한 화면. 컬럼이 테이블마다 달라서 가공하지 않고 백엔드가 준 컬럼 순서
// 그대로 렌더링한다.
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { fetchAdminDataTables, fetchAdminTableRows } from "../services/adminService"

const PAGE_SIZE = 20

const TABLE_LABELS = {
  road_link_baseline: "도로 baseline (요일×시간대)",
  road_link_traffic_cache: "도로 실시간 스냅샷",
  road_link_traffic_history: "도로 이력(최근 48시간)",
  holiday_cache: "공휴일",
  district_visitor_baseline: "구·군 방문객 baseline",
  weather_cache: "날씨",
  uv_index_cache: "자외선지수",
  air_quality_cache: "대기질",
  rip_current_cache: "이안류",
}

// 9개 테이블 컬럼을 다 합친 매핑 — 테이블마다 컬럼이 다르지만 겹치는 이름(link_id,
// fetched_at 등)이 많아 하나로 관리한다. 매핑 없는 컬럼은 원래 이름을 그대로 씀.
const COLUMN_LABELS = {
  link_id: "링크 ID",
  dow: "요일",
  hour: "시간대",
  avg_speed: "평균 속도",
  avg_volume: "평균 교통량",
  sample_count: "표본 수",
  current_speed: "현재 속도",
  current_volume: "현재 교통량",
  observed_at: "관측 시각",
  fetched_at: "수집 시각",
  date: "날짜",
  name: "이름",
  sigungu_code: "구·군 코드",
  visitor_ratio: "방문객 비율",
  nx: "격자 X",
  ny: "격자 Y",
  temperature: "기온",
  humidity: "습도",
  wind_speed: "풍속",
  precipitation_prob: "강수확률",
  sky: "하늘상태",
  precipitation_type: "강수형태",
  forecast: "예보(6시간)",
  area_no: "지역 코드",
  uv_index: "자외선지수",
  station_name: "측정소명",
  pm10: "미세먼지",
  pm25: "초미세먼지",
  o3: "오존",
  pm10_grade: "미세먼지 등급",
  pm25_grade: "초미세먼지 등급",
  station_code: "관측소 코드",
  index_value: "이안류 지수",
  risk_level: "위험도",
  wave_height: "파고",
  water_temp: "수온",
}

// 테이블별로 "숫자가 왜 이렇게 나오는지" 헷갈릴 만한 것들만 짧게 설명한다.
// 컬럼 하나하나가 아니라 표 전체 기준으로 두는 게 항목별 툴팁보다 한눈에 들어옴.
const TABLE_NOTES = {
  road_link_baseline: [
    "요일(dow)은 0=월요일 ~ 6=일요일이에요.",
    "시간대(hour)는 0~23시, 그 시간 정각 기준이에요.",
    "표본 수(sample_count)가 3 미만이면 아직 신뢰할 수 없어서 실제 서비스 화면엔 안 써요 — 최소 3주 관측이 기준이에요.",
    "평균 교통량(avg_volume)은 원본 API 값을 저장만 하고 있고, 지금 혼잡도 계산엔 안 써요.",
  ],
  road_link_traffic_cache: [
    "링크마다 딱 1행만 있어요 — 매시간 최신 값으로 덮어쓰기 때문에 과거 값은 안 남아요.",
    "관측 시각(observed_at)은 API가 준 시각, 수집 시각(fetched_at)은 우리가 실제로 호출한 시각이에요. 몇 분 정도 차이나는 게 정상이에요.",
  ],
  road_link_traffic_history: [
    "최근 48시간치만 남아있고, 그보다 오래된 행은 매 수집 주기마다 자동으로 지워져요.",
    "'오늘 실측 혼잡도' 그래프를 그릴 때 쓰는 원본 데이터예요.",
  ],
  holiday_cache: [
    "관공서 공휴일 기준이라 대체공휴일도 별도 행으로 들어가요(예: '대체공휴일(광복절)').",
    "평일 공휴일은 baseline 계산할 때 그 요일 대신 일요일(dow=6) 패턴으로 대체해서 써요.",
  ],
  district_visitor_baseline: [
    "요일(dow)은 도로 baseline과 같은 인코딩(0=월~6=일)이에요.",
    "방문객 비율(visitor_ratio) 1.0 = 그 구의 평소 평균과 같은 요일, 1.5면 평소보다 50% 더 붐비는 요일이라는 뜻이에요.",
    "도로 baseline이 아직 3주만큼 안 쌓였을 때만 임시로 대신 쓰는 값이에요.",
  ],
  weather_cache: [
    "격자 X/Y(nx, ny)는 위도·경도가 아니라 기상청 자체 격자 좌표예요.",
    "하늘상태(sky)는 1=맑음, 3=구름많음, 4=흐림이에요.",
    "강수형태(precipitation_type)는 0=없음, 1=비, 2=비/눈, 3=눈, 4=소나기예요.",
    "강수확률(precipitation_prob)은 초단기예보 특성상 원본 API가 이 값을 안 줘서 항상 비어있는 게 정상이에요.",
  ],
  uv_index_cache: ["지역코드(area_no)는 지금 '2600000000'(부산 전체) 고정값 하나만 써요."],
  air_quality_cache: ["등급(pm10_grade/pm25_grade)은 환경부 공식 4단계예요 — 1=좋음, 2=보통, 3=나쁨, 4=매우나쁨."],
  rip_current_cache: [
    "관측소 코드(station_code)는 HAE=해운대, SONGJUNG=송정, IMRANG=임랑이에요.",
    "위험도(risk_level)는 관심 < 주의 < 경계 < 위험 순으로 심각해져요.",
    "해수욕장 개장 기간(6~9월)에만 값이 나오는 API라, 비시즌엔 테이블이 비어있는 게 정상이에요.",
  ],
}

export default function AdminDataInspector() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [tables, setTables] = useState(null)
  const [selected, setSelected] = useState(null)
  const [data, setData] = useState(null)
  const [page, setPage] = useState(1)
  const [loadError, setLoadError] = useState(false)

  useEffect(() => {
    if (!authLoading && user?.role !== "admin") navigate("/", { replace: true })
  }, [authLoading, user, navigate])

  const isAdmin = user?.role === "admin"

  useEffect(() => {
    if (!isAdmin) return
    fetchAdminDataTables().then((rows) => {
      setTables(rows)
      setSelected((prev) => prev ?? rows[0]?.table ?? null)
    })
  }, [isAdmin])

  useEffect(() => {
    if (!isAdmin || !selected) return
    setData(null)
    setLoadError(false)
    fetchAdminTableRows(selected, { page, pageSize: PAGE_SIZE })
      .then(setData)
      .catch(() => setLoadError(true))
  }, [isAdmin, selected, page])

  if (authLoading || !isAdmin) return null

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-container-margin py-6 pb-24 md:pb-8 max-w-6xl mx-auto w-full flex flex-col gap-gutter">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-bold text-on-surface">
            수집 데이터 점검
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            배치 ETL이 실제로 데이터를 쌓고 있는지 테이블 그대로 확인해요.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tables === null
            ? [...Array(6)].map((_, i) => (
                <div key={i} className="h-9 w-40 rounded-full bg-surface-container-low animate-pulse" />
              ))
            : tables.map((t) => (
                <button
                  key={t.table}
                  type="button"
                  onClick={() => {
                    setSelected(t.table)
                    setPage(1)
                  }}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 font-label-sm text-[13px] font-bold transition-colors ${
                    selected === t.table
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  {TABLE_LABELS[t.table] ?? t.table}
                  <span
                    className={`font-label-sm text-[11px] px-1.5 py-0.5 rounded-full ${
                      selected === t.table ? "bg-on-primary/20" : "bg-surface-container"
                    }`}
                  >
                    {t.row_count.toLocaleString()}
                  </span>
                </button>
              ))}
        </div>

        {selected && TABLE_NOTES[selected] && (
          <div className="bg-primary-container/5 border border-primary/20 rounded-xl p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">info</span>
              <span className="font-label-sm text-[12px] font-bold text-primary">이 표 읽는 법</span>
            </div>
            <ul className="list-disc pl-5 flex flex-col gap-0.5">
              {TABLE_NOTES[selected].map((note) => (
                <li key={note} className="font-label-sm text-[12px] text-on-surface-variant">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4 flex flex-col gap-3">
          {loadError ? (
            <p className="py-12 text-center font-label-sm text-error">이 테이블을 불러오지 못했어요.</p>
          ) : data === null ? (
            <p className="py-12 text-center font-label-sm text-on-surface-variant">불러오는 중...</p>
          ) : data.rows.length === 0 ? (
            <p className="py-12 text-center font-label-sm text-on-surface-variant">아직 쌓인 데이터가 없어요.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="border-b border-outline-variant/30">
                      {data.columns.map((col) => (
                        <th key={col} className="py-2 px-2 whitespace-nowrap align-bottom">
                          <div className="flex flex-col gap-0.5">
                            <span className="font-label-sm text-[13px] font-bold text-on-surface normal-case">
                              {COLUMN_LABELS[col] ?? col}
                            </span>
                            <span className="font-label-sm text-[9px] text-outline-variant normal-case">({col})</span>
                          </div>
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {data.rows.map((row, i) => (
                      <tr key={i} className="border-b border-outline-variant/10">
                        {data.columns.map((col) => (
                          <td key={col} className="py-2 px-2 font-label-sm text-[12px] text-on-surface whitespace-nowrap">
                            {formatCell(row[col])}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <span className="font-label-sm text-[12px] text-on-surface-variant">
                  전체 {data.total.toLocaleString()}건 중 {(page - 1) * PAGE_SIZE + 1}-{(page - 1) * PAGE_SIZE + data.rows.length}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="p-1.5 rounded-lg border border-outline-variant disabled:opacity-30 hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_left</span>
                  </button>
                  <span className="font-label-sm text-[13px] px-2">
                    {page} / {totalPages}
                  </span>
                  <button
                    type="button"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                    className="p-1.5 rounded-lg border border-outline-variant disabled:opacity-30 hover:bg-surface-container-low transition-colors"
                  >
                    <span className="material-symbols-outlined text-[18px]">chevron_right</span>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function formatCell(value) {
  if (value == null) return <span className="text-outline-variant">-</span>
  if (typeof value === "number") return Number.isInteger(value) ? value : value.toFixed(2)
  return String(value)
}
