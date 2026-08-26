// 축제·행사 dedup 검토 큐 — 관리자 전용. 백엔드가 role 체크로 실제 보안 경계를 맡고,
// 여기는 그냥 그 API를 호출만 한다(프론트 쪽 role 체크는 UX용일 뿐).
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8080"

export async function fetchDedupCandidates() {
  const res = await fetch(`${API_BASE_URL}/api/admin/dedup-candidates`, { credentials: "include" })
  if (!res.ok) throw new Error(`fetchDedupCandidates failed: ${res.status}`)
  return res.json()
}

export async function resolveDedupCandidate(id, decision) {
  const res = await fetch(`${API_BASE_URL}/api/admin/dedup-candidates/${id}/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ decision }),
  })
  if (!res.ok) throw new Error(`resolveDedupCandidate failed: ${res.status}`)
}
