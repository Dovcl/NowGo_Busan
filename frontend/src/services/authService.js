// 로그인 상태 확인 + 소셜 로그인/로그아웃. 세션은 httpOnly 쿠키라 credentials:
// 'include'를 매번 넣어야 브라우저가 쿠키를 같이 보낸다.

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:8000"

export function goToKakaoLogin() {
  window.location.href = `${API_BASE_URL}/auth/kakao/login`
}

export function goToGoogleLogin() {
  window.location.href = `${API_BASE_URL}/auth/google/login`
}

// 로그인 안 된 상태(401)는 에러가 아니라 정상 케이스라 null을 반환한다.
export async function fetchMe() {
  const res = await fetch(`${API_BASE_URL}/auth/me`, { credentials: "include" })
  if (res.status === 401) return null
  if (!res.ok) throw new Error(`fetchMe failed: ${res.status}`)
  return res.json()
}

export async function logout() {
  await fetch(`${API_BASE_URL}/auth/logout`, { method: "POST", credentials: "include" })
}

// 실패 시(이메일/비번 불일치) 401이 오는데, 에러 메시지는 서버가 이미
// "이메일 또는 비밀번호가 올바르지 않습니다"로 통일해뒀으므로 그대로 올린다.
export async function adminLogin(email, password) {
  const res = await fetch(`${API_BASE_URL}/auth/admin/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? "로그인에 실패했습니다")
  }
  return res.json()
}
