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
