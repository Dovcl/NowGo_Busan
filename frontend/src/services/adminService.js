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

// 회원 관리 — 관리자 전용
export async function fetchAdminUsers({ search = "", status = "", dateFrom = "", dateTo = "", page = 1, pageSize = 10 } = {}) {
  const params = new URLSearchParams({ page, page_size: pageSize })
  if (search) params.set("search", search)
  if (status) params.set("status", status)
  if (dateFrom) params.set("date_from", dateFrom)
  if (dateTo) params.set("date_to", dateTo)
  const res = await fetch(`${API_BASE_URL}/api/admin/users?${params}`, { credentials: "include" })
  if (!res.ok) throw new Error(`fetchAdminUsers failed: ${res.status}`)
  return res.json()
}

export async function fetchAdminUserStats() {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/stats`, { credentials: "include" })
  if (!res.ok) throw new Error(`fetchAdminUserStats failed: ${res.status}`)
  return res.json()
}

// role: "tourist"(비상용 백업 계정) | "admin"(관리자 계정)
export async function createAdminUser({ nickname, email, password, role }) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ nickname, email, password, role }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? "계정 생성에 실패했습니다")
  }
  return res.json()
}

export async function updateUsersRole(ids, role) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/role`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ids, role }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? "권한 변경에 실패했습니다")
  }
}

export async function withdrawUsers(ids) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/withdraw`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? "탈퇴 처리에 실패했습니다")
  }
}

export async function restoreUsers(ids) {
  const res = await fetch(`${API_BASE_URL}/api/admin/users/restore`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ ids }),
  })
  if (!res.ok) throw new Error(`restoreUsers failed: ${res.status}`)
}

export function adminUsersExportUrl() {
  return `${API_BASE_URL}/api/admin/users/export`
}

// 수집 파이프라인 데이터 점검(날씨/도로교통/공휴일 등 ETL 테이블) — 관리자 전용
export async function fetchAdminDataTables() {
  const res = await fetch(`${API_BASE_URL}/api/admin/data/tables`, { credentials: "include" })
  if (!res.ok) throw new Error(`fetchAdminDataTables failed: ${res.status}`)
  return res.json()
}

export async function fetchAdminTableRows(table, { page = 1, pageSize = 20 } = {}) {
  const params = new URLSearchParams({ page, page_size: pageSize })
  const res = await fetch(`${API_BASE_URL}/api/admin/data/tables/${table}?${params}`, { credentials: "include" })
  if (!res.ok) throw new Error(`fetchAdminTableRows failed: ${res.status}`)
  return res.json()
}
