// 최소 서비스워커 — 오프라인 캐싱은 의도적으로 안 함(실시간 데이터 앱이라
// 옛날 캐시 값을 "지금 상황"처럼 보여주면 오히려 위험, harness/DECISIONS.md 참고).
// Chrome/Android는 설치 프롬프트(beforeinstallprompt)가 뜨려면 fetch 핸들러가
// 있는 서비스워커 등록 자체를 installability 조건으로 요구해서, 그 조건만
// 만족시키는 순수 네트워크 통과 핸들러만 둔다.
self.addEventListener("install", () => {
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener("fetch", (event) => {
  event.respondWith(fetch(event.request))
})
