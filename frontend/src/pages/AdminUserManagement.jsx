// 회원 관리 — 관리자 전용. require_admin이 실제 보안 경계(routers/admin_users.py),
// 여기 role 체크는 UX일 뿐(AdminEventReview.jsx와 같은 패턴).
import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "../context/AuthContext"
import {
  fetchAdminUsers,
  fetchAdminUserStats,
  createAdminUser,
  updateUsersRole,
  withdrawUsers,
  restoreUsers,
  adminUsersExportUrl,
} from "../services/adminService"

const PAGE_SIZE = 10
const SOURCE_LABEL = { kakao: "Kakao", google: "Google", email: "Email" }

export default function AdminUserManagement() {
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  const [stats, setStats] = useState(null)
  const [items, setItems] = useState(null)
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState("")
  const [status, setStatus] = useState("")
  const [dateFrom, setDateFrom] = useState("")
  const [dateTo, setDateTo] = useState("")
  const [selected, setSelected] = useState([])
  const [busy, setBusy] = useState(false)
  const [showAddModal, setShowAddModal] = useState(false)

  useEffect(() => {
    if (!authLoading && user?.role !== "admin") navigate("/", { replace: true })
  }, [authLoading, user, navigate])

  useEffect(() => {
    if (user?.role === "admin") fetchAdminUserStats().then(setStats)
  }, [user])

  const isAdmin = user?.role === "admin"

  useEffect(() => {
    if (!isAdmin) return
    fetchAdminUsers({ search, status, dateFrom, dateTo, page, pageSize: PAGE_SIZE }).then((res) => {
      setItems(res.items)
      setTotal(res.total)
      setSelected([])
    })
  }, [isAdmin, search, status, dateFrom, dateTo, page])

  if (authLoading || !isAdmin) return null

  function reload() {
    fetchAdminUsers({ search, status, dateFrom, dateTo, page, pageSize: PAGE_SIZE }).then((res) => {
      setItems(res.items)
      setTotal(res.total)
    })
    fetchAdminUserStats().then(setStats)
  }

  function toggleSelect(id) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]))
  }

  function toggleSelectAll() {
    setSelected((prev) => (prev.length === items.length ? [] : items.map((u) => u.id)))
  }

  async function runBulk(action) {
    if (selected.length === 0) return
    setBusy(true)
    try {
      if (action === "role-tourist") await updateUsersRole(selected, "tourist")
      if (action === "role-admin") await updateUsersRole(selected, "admin")
      if (action === "withdraw") await withdrawUsers(selected)
      if (action === "restore") await restoreUsers(selected)
      setSelected([])
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleRole(u) {
    setBusy(true)
    try {
      await updateUsersRole([u.id], u.role === "admin" ? "tourist" : "admin")
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  async function toggleWithdraw(u) {
    setBusy(true)
    try {
      if (u.is_withdrawn) await restoreUsers([u.id])
      else await withdrawUsers([u.id])
      reload()
    } catch (err) {
      alert(err.message)
    } finally {
      setBusy(false)
    }
  }

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-container-margin py-6 pb-24 md:pb-8 max-w-6xl mx-auto w-full flex flex-col gap-gutter">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-bold text-on-surface">
              회원 관리
            </h1>
            <p className="font-body-md text-body-md text-on-surface-variant mt-1">회원 계정과 권한을 관리해요.</p>
          </div>
          <div className="flex gap-2 shrink-0">
            <a
              href={adminUsersExportUrl()}
              className="flex items-center gap-2 border border-outline-variant rounded-lg px-4 py-2 font-label-sm text-[13px] font-bold text-on-surface hover:bg-surface-container-low transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">download</span>
              CSV 내보내기
            </a>
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-2 bg-primary text-on-primary rounded-lg px-4 py-2 font-label-sm text-[13px] font-bold hover:bg-primary/90 transition-colors"
            >
              <span className="material-symbols-outlined text-[18px]">add</span>
              계정 추가
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-gutter">
          <StatCard label="전체 회원" value={stats?.total_users} icon="group" />
          <StatCard label="오늘 가입" value={stats?.new_today} icon="person_add" />
        </div>

        <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4 flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value=""
              disabled={selected.length === 0 || busy}
              onChange={(e) => runBulk(e.target.value)}
              className="border border-outline-variant rounded-lg px-3 py-2 font-label-sm text-[13px] bg-surface-container-lowest disabled:opacity-40"
            >
              <option value="" disabled>
                일괄 처리 ({selected.length})
              </option>
              <option value="role-admin">관리자로 변경</option>
              <option value="role-tourist">일반으로 변경</option>
              <option value="withdraw">탈퇴 처리</option>
              <option value="restore">복구</option>
            </select>

            <select
              value={status}
              onChange={(e) => {
                setStatus(e.target.value)
                setPage(1)
              }}
              className="border border-outline-variant rounded-lg px-3 py-2 font-label-sm text-[13px] bg-surface-container-lowest"
            >
              <option value="">상태: 전체</option>
              <option value="active">활성</option>
              <option value="withdrawn">탈퇴</option>
            </select>

            <div className="flex items-center gap-1 font-label-sm text-[13px] text-on-surface-variant">
              가입일
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => {
                  setDateFrom(e.target.value)
                  setPage(1)
                }}
                className="[color-scheme:light] bg-surface-container-lowest text-on-surface border border-outline-variant rounded-lg px-2 py-1.5 font-label-sm text-[12px]"
              />
              ~
              <input
                type="date"
                value={dateTo}
                onChange={(e) => {
                  setDateTo(e.target.value)
                  setPage(1)
                }}
                className="[color-scheme:light] bg-surface-container-lowest text-on-surface border border-outline-variant rounded-lg px-2 py-1.5 font-label-sm text-[12px]"
              />
            </div>

            <div className="relative flex-1 min-w-[200px]">
              <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-outline text-[18px]">
                search
              </span>
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="이름 또는 이메일 검색"
                className="w-full bg-surface-container border border-outline-variant rounded-full pl-9 pr-3 py-2 font-label-sm text-[13px] outline-none focus:border-primary transition-colors"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-outline-variant/30">
                  <th className="py-2 pr-2 w-8">
                    <input
                      type="checkbox"
                      checked={items?.length > 0 && selected.length === items.length}
                      onChange={toggleSelectAll}
                      className="accent-primary"
                    />
                  </th>
                  <Th>회원</Th>
                  <Th>가입 경로</Th>
                  <Th>가입일</Th>
                  <Th>상태</Th>
                  <Th className="text-right">액션</Th>
                </tr>
              </thead>
              <tbody>
                {items === null ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center font-label-sm text-on-surface-variant">
                      불러오는 중...
                    </td>
                  </tr>
                ) : items.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center font-label-sm text-on-surface-variant">
                      조건에 맞는 회원이 없어요.
                    </td>
                  </tr>
                ) : (
                  items.map((u) => (
                    <UserRow
                      key={u.id}
                      u={u}
                      checked={selected.includes(u.id)}
                      onToggle={() => toggleSelect(u.id)}
                      onToggleRole={() => toggleRole(u)}
                      onToggleWithdraw={() => toggleWithdraw(u)}
                      busy={busy}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between pt-2">
            <span className="font-label-sm text-[12px] text-on-surface-variant">
              전체 {total}명 중 {items ? (page - 1) * PAGE_SIZE + 1 : 0}-{items ? (page - 1) * PAGE_SIZE + items.length : 0}
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
        </div>
      </div>

      {showAddModal && (
        <AddUserModal
          onClose={() => setShowAddModal(false)}
          onCreated={() => {
            setShowAddModal(false)
            reload()
          }}
        />
      )}
    </div>
  )
}

function Th({ children, className = "" }) {
  return <th className={`py-2 px-2 font-label-sm text-[11px] text-on-surface-variant uppercase ${className}`}>{children}</th>
}

function StatCard({ label, value, icon }) {
  return (
    <div className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-card-padding flex items-center justify-between">
      <div>
        <span className="font-label-sm text-[12px] text-on-surface-variant">{label}</span>
        <p className="font-score-display text-2xl font-bold text-on-surface mt-1">{value ?? "-"}</p>
      </div>
      <div className="bg-surface-container-low p-2 rounded-full text-primary">
        <span className="material-symbols-outlined">{icon}</span>
      </div>
    </div>
  )
}

function UserRow({ u, checked, onToggle, onToggleRole, onToggleWithdraw, busy }) {
  return (
    <tr className={`border-b border-outline-variant/10 ${u.is_withdrawn ? "opacity-50" : ""}`}>
      <td className="py-3 pr-2">
        <input type="checkbox" checked={checked} onChange={onToggle} className="accent-primary" />
      </td>
      <td className="py-3 px-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary-container/30 flex items-center justify-center text-primary font-bold text-[12px] shrink-0">
            {u.nickname?.slice(0, 1) ?? "?"}
          </div>
          <div className="flex flex-col min-w-0">
            <span className="font-body-md text-[13.5px] font-bold text-on-surface truncate">{u.nickname}</span>
            {u.email && <span className="font-label-sm text-[11px] text-on-surface-variant truncate">{u.email}</span>}
          </div>
        </div>
      </td>
      <td className="py-3 px-2">
        <span className="font-label-sm text-[11px] bg-surface-container-low text-on-surface-variant px-2 py-1 rounded-full">
          {SOURCE_LABEL[u.signup_source] ?? u.signup_source}
        </span>
        {u.role === "admin" && (
          <span className="ml-1 font-label-sm text-[11px] bg-primary/10 text-primary px-2 py-1 rounded-full">관리자</span>
        )}
      </td>
      <td className="py-3 px-2 font-label-sm text-[12px] text-on-surface-variant">
        {new Date(u.created_at).toLocaleDateString("ko-KR")}
      </td>
      <td className="py-3 px-2">
        <span className={`font-label-sm text-[12px] flex items-center gap-1 ${u.is_withdrawn ? "text-outline" : "text-secondary"}`}>
          <span className="material-symbols-outlined text-[10px] filled-icon">circle</span>
          {u.is_withdrawn ? "탈퇴" : "활성"}
        </span>
      </td>
      <td className="py-3 px-2 text-right whitespace-nowrap">
        <button
          type="button"
          disabled={busy}
          onClick={onToggleRole}
          className="font-label-sm text-[12px] font-bold text-primary border border-primary/30 rounded-lg px-3 py-1.5 mr-1.5 hover:bg-primary/5 transition-colors disabled:opacity-40"
        >
          {u.role === "admin" ? "일반으로 변경" : "관리자로 변경"}
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={onToggleWithdraw}
          className={`font-label-sm text-[12px] font-bold border rounded-lg px-3 py-1.5 transition-colors disabled:opacity-40 ${
            u.is_withdrawn
              ? "text-secondary border-secondary/30 hover:bg-secondary/5"
              : "text-error border-error/30 hover:bg-error-container/20"
          }`}
        >
          {u.is_withdrawn ? "복구" : "탈퇴 처리"}
        </button>
      </td>
    </tr>
  )
}

function AddUserModal({ onClose, onCreated }) {
  const [nickname, setNickname] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [isAdminAccount, setIsAdminAccount] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await createAdminUser({ nickname, email, password, role: isAdminAccount ? "admin" : "tourist" })
      onCreated()
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-surface-dim/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-surface-container-lowest rounded-xl shadow-xl w-full max-w-[400px] p-card-padding relative flex flex-col gap-4">
        <button type="button" onClick={onClose} className="absolute top-4 right-4 text-on-surface-variant hover:text-on-surface">
          <span className="material-symbols-outlined">close</span>
        </button>

        <div>
          <h2 className="font-headline-lg-mobile text-lg font-bold text-on-surface">NowGo ID 계정 추가</h2>
          <p className="font-label-sm text-[12px] text-on-surface-variant mt-1">
            카카오/구글 로그인이 안 되는 상황을 대비한 이메일/비밀번호 계정입니다.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            required
            placeholder="닉네임"
            className="w-full h-11 px-4 bg-surface-container-low rounded-lg font-body-md text-[13.5px] border border-outline-variant focus:border-primary outline-none transition-colors"
          />
          <input
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="NowGo ID(이메일)"
            className="w-full h-11 px-4 bg-surface-container-low rounded-lg font-body-md text-[13.5px] border border-outline-variant focus:border-primary outline-none transition-colors"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="비밀번호"
            className="w-full h-11 px-4 bg-surface-container-low rounded-lg font-body-md text-[13.5px] border border-outline-variant focus:border-primary outline-none transition-colors"
          />

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isAdminAccount}
              onChange={(e) => setIsAdminAccount(e.target.checked)}
              className="accent-primary"
            />
            <span className="font-body-md text-[13px] text-on-surface">관리자 권한 부여</span>
          </label>

          {error && <p className="font-label-sm text-[12px] text-error">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-11 bg-primary text-on-primary rounded-lg font-label-sm text-[13px] font-bold hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {loading ? "생성 중..." : "계정 생성"}
          </button>
        </form>
      </div>
    </div>
  )
}
