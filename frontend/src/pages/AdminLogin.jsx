import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { adminLogin } from "../services/authService"
import { useAuth } from "../context/AuthContext"

export default function AdminLogin() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)
  const { refreshUser } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError("")
    setLoading(true)
    try {
      await adminLogin(email, password)
      await refreshUser()
      navigate("/")
    } catch (err) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex bg-surface">
      {/* Left: 시각적 배경 (모바일에서는 숨김) */}
      <section className="hidden md:flex md:w-3/5 relative overflow-hidden items-center justify-center">
        <div
          className="absolute inset-0 bg-cover bg-center"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAvE3-ty5SvU0W68v3HguORs_t3Ja3mrgXSVUXUGPltrTWV3rBSqL4vD5n2mt5b-MOdxjWhuQGYqokT0V54WlzBlpriGp6s7CwY3YSJlRZRtLLDui2VA8Fg_CQwcWcoaKOnZrr4aYWrST2au3gjV4SslMyg_3GwsexeRJsqq-ttN3KfBMmpnaKamo3PhWG1YAAUPnh-Ad-fZtDIskeW2nEQCQiwlQG8UfjohkWmuSzk1IaCliP-qV5S')",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-primary/80 via-primary/40 to-transparent" />
        <div className="relative z-10 p-16 text-on-primary max-w-2xl">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-md flex items-center justify-center">
              <span className="material-symbols-outlined text-white text-[28px]">explore</span>
            </div>
            <span className="font-display-lg text-headline-lg tracking-tight">NowGo Busan</span>
          </div>
          <h2 className="font-display-lg text-6xl leading-tight">
            지금, 부산
            <br />
            어디로 갈까?
          </h2>
        </div>
      </section>

      {/* Right: 로그인 폼 */}
      <section className="flex-1 flex items-center justify-center px-container-margin py-16">
        <form onSubmit={handleSubmit} className="w-full max-w-[420px] flex flex-col gap-6">
          <div className="md:hidden flex flex-col items-center mb-4">
            <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
              <span className="material-symbols-outlined text-primary text-[40px] filled-icon">explore</span>
            </div>
          </div>

          <div>
            <h1 className="font-headline-lg text-headline-lg text-on-surface mb-2">Administrator Portal</h1>
            <p className="font-body-md text-body-md text-on-surface-variant">
              Access limited to authorized personnel only.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              이메일 또는 아이디
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                mail
              </span>
              <input
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full h-14 pl-12 pr-4 bg-surface-container-lowest rounded-lg font-body-md text-on-surface border border-outline-variant focus:border-primary outline-none transition-colors"
                placeholder="example@nowgo.com"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2">
            <label className="font-label-sm text-label-sm text-on-surface-variant uppercase tracking-wider">
              비밀번호
            </label>
            <div className="relative">
              <span className="material-symbols-outlined absolute left-4 top-1/2 -translate-y-1/2 text-outline">
                lock
              </span>
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full h-14 pl-12 pr-12 bg-surface-container-lowest rounded-lg font-body-md text-on-surface border border-outline-variant focus:border-primary outline-none transition-colors"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-4 top-1/2 -translate-y-1/2 text-outline hover:text-on-surface-variant transition-colors"
              >
                <span className="material-symbols-outlined">{showPassword ? "visibility_off" : "visibility"}</span>
              </button>
            </div>
          </div>

          {error && <p className="font-label-sm text-label-sm text-error">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full h-14 bg-primary text-on-primary rounded-lg font-headline-lg-mobile transition-colors hover:bg-primary/90 disabled:opacity-60"
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </section>
    </div>
  )
}
