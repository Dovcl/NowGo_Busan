// 축제·행사 dedup 검토 큐 — 관리자 전용. AUTO_MERGE(0.8) 문턱에 못 미치는 애매한
// 후보를 사람이 보고 같은 행사/다른 행사로 확정한다(harness/DECISIONS.md 2026-08-26).
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import { formatDateRange } from "../lib/events"
import { fetchDedupCandidates, resolveDedupCandidate } from "../services/adminService"

export default function AdminEventReview() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()
  const [candidates, setCandidates] = useState(null)
  const [resolvingId, setResolvingId] = useState(null)

  useEffect(() => {
    if (!authLoading && user?.role !== "admin") navigate("/", { replace: true })
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (user?.role === "admin") fetchDedupCandidates().then(setCandidates)
  }, [user])

  if (authLoading || user?.role !== "admin") return null

  async function resolve(id, decision) {
    setResolvingId(id)
    try {
      await resolveDedupCandidate(id, decision)
      setCandidates((prev) => prev.filter((c) => c.id !== id))
    } finally {
      setResolvingId(null)
    }
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-container-margin py-4 md:py-8 pb-24 md:pb-8 max-w-4xl mx-auto w-full flex flex-col gap-gutter">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">
            축제·행사 중복 검토
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">
            자동으로 판단하기 애매한 쌍. 같은 행사면 하나로 합치고, 다른 행사면 각자 그대로 두기.
          </p>
        </div>

        {candidates === null ? (
          <div className="flex justify-center py-12">
            <span className="material-symbols-outlined animate-spin text-primary">progress_activity</span>
          </div>
        ) : candidates.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-16 text-center">
            <span className="material-symbols-outlined text-4xl text-outline-variant">task_alt</span>
            <p className="font-body-md text-on-surface-variant">검토할 항목이 없어요.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <span className="font-label-sm text-[12px] text-outline">{candidates.length}건 대기 중</span>
            {candidates.map((c) => (
              <CandidateCard key={c.id} candidate={c} busy={resolvingId === c.id} onResolve={(decision) => resolve(c.id, decision)} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function CandidateCard({ candidate, busy, onResolve }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 shadow-[0_4px_20px_rgba(0,0,0,0.05)] p-4 flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="font-label-sm text-[11px] text-outline">
          유사도 {(candidate.total_score * 100).toFixed(0)}% (제목 {(candidate.title_score * 100).toFixed(0)} · 날짜{" "}
          {(candidate.date_score * 100).toFixed(0)} · 장소 {(candidate.venue_score * 100).toFixed(0)})
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <EventSide side={candidate.a} />
        <EventSide side={candidate.b} />
      </div>

      <div className="flex gap-2 pt-1 border-t border-outline-variant/20">
        <button
          type="button"
          disabled={busy}
          onClick={() => onResolve("DIFFERENT")}
          className="flex-1 py-2 rounded-lg border border-outline-variant text-on-surface-variant font-label-sm text-[13px] font-bold hover:bg-surface-container transition-colors disabled:opacity-40"
        >
          다른 행사예요
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onResolve("SAME")}
          className="flex-1 py-2 rounded-lg bg-primary text-on-primary font-label-sm text-[13px] font-bold hover:bg-primary/90 transition-colors disabled:opacity-40"
        >
          같은 행사예요
        </button>
      </div>
    </div>
  )
}

function EventSide({ side }) {
  return (
    <div className="flex gap-3 p-3 rounded-lg bg-surface border border-outline-variant/20">
      <div className="w-14 h-14 rounded-lg overflow-hidden shrink-0 bg-surface-container">
        {side.image_url && <img className="w-full h-full object-cover" src={side.image_url} alt={side.title} />}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <span className="font-label-sm text-[10px] font-bold text-outline uppercase">{side.source}</span>
        <span className="font-body-md text-[13.5px] font-bold text-on-surface truncate">{side.title}</span>
        {side.start_date && (
          <span className="font-label-sm text-[11px] text-on-surface-variant">{formatDateRange(side.start_date, side.end_date)}</span>
        )}
        {side.venue && <span className="font-label-sm text-[11px] text-on-surface-variant truncate">{side.venue}</span>}
      </div>
    </div>
  )
}
