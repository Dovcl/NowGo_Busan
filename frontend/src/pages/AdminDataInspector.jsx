// 수집 파이프라인 데이터 점검 — 관리자 전용. require_admin이 실제 보안 경계
// (routers/admin_data.py), 여기 role 체크는 UX일 뿐(AdminEventReview.jsx와 같은 패턴).
//
// 날씨/도로교통/공휴일 등 배치 ETL이 실제로 잘 쌓이고 있는지 테이블 그대로 눈으로
// 확인하기 위한 화면. 컬럼이 테이블마다 달라서 가공하지 않고 백엔드가 준 컬럼 순서
// 그대로 렌더링한다.
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "../context/AuthContext"
import { fetchAdminDataTables, fetchAdminTableRows } from "../services/adminService"

const PAGE_SIZE = 20

// 테이블명/컬럼명/설명 문구는 전부 t(`dataInspector.*`, {ns: "admin"})에서 조회.
const TABLE_KEYS = [
  "road_link_baseline",
  "road_link_traffic_cache",
  "road_link_traffic_history",
  "holiday_cache",
  "district_visitor_baseline",
  "weather_cache",
  "uv_index_cache",
  "air_quality_cache",
  "rip_current_cache",
]

export default function AdminDataInspector() {
  const { t } = useTranslation("admin")
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
            {t("dataInspector.title")}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            {t("dataInspector.subtitle")}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {tables === null
            ? [...Array(6)].map((_, i) => (
                <div key={i} className="h-9 w-40 rounded-full bg-surface-container-low animate-pulse" />
              ))
            : tables.map((row) => (
                <button
                  key={row.table}
                  type="button"
                  onClick={() => {
                    setSelected(row.table)
                    setPage(1)
                  }}
                  className={`flex items-center gap-2 rounded-full px-4 py-2 font-label-sm text-[13px] font-bold transition-colors ${
                    selected === row.table
                      ? "bg-primary text-on-primary"
                      : "bg-surface-container-lowest border border-outline-variant text-on-surface-variant hover:bg-surface-container-low"
                  }`}
                >
                  {t(`dataInspector.tableLabels.${row.table}`, { defaultValue: row.table })}
                  <span
                    className={`font-label-sm text-[11px] px-1.5 py-0.5 rounded-full ${
                      selected === row.table ? "bg-on-primary/20" : "bg-surface-container"
                    }`}
                  >
                    {row.row_count.toLocaleString()}
                  </span>
                </button>
              ))}
        </div>

        {selected && TABLE_KEYS.includes(selected) && (
          <div className="bg-primary-container/5 border border-primary/20 rounded-xl p-4 flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="material-symbols-outlined text-primary text-[18px]">info</span>
              <span className="font-label-sm text-[12px] font-bold text-primary">{t("dataInspector.readingGuide")}</span>
            </div>
            <ul className="list-disc pl-5 flex flex-col gap-0.5">
              {t(`dataInspector.tableNotes.${selected}`, { returnObjects: true }).map((note) => (
                <li key={note} className="font-label-sm text-[12px] text-on-surface-variant">
                  {note}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4 flex flex-col gap-3">
          {loadError ? (
            <p className="py-12 text-center font-label-sm text-error">{t("dataInspector.loadError")}</p>
          ) : data === null ? (
            <p className="py-12 text-center font-label-sm text-on-surface-variant">{t("dataInspector.loading")}</p>
          ) : data.rows.length === 0 ? (
            <p className="py-12 text-center font-label-sm text-on-surface-variant">{t("dataInspector.noData")}</p>
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
                              {t(`dataInspector.columnLabels.${col}`, { defaultValue: col })}
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
                  {t("dataInspector.totalCount", {
                    total: data.total.toLocaleString(),
                    from: (page - 1) * PAGE_SIZE + 1,
                    to: (page - 1) * PAGE_SIZE + data.rows.length,
                  })}
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
