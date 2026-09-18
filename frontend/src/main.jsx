import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import './lib/i18n'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { LanguageProvider } from './context/LanguageContext.jsx'
import { WeatherWarningProvider } from './context/WeatherWarningContext.jsx'

// 개발 서버에서는 등록 안 함 — HMR 요청까지 서비스워커를 거치면서 생기는
// 캐시/새로고침 혼선을 피한다. 프로덕션 빌드에서만 installability 조건 충족용으로 등록.
// window 'load' 이벤트를 기다리는 흔한 패턴을 썼다가, 이 모듈 스크립트가 실행되는
// 시점엔 이미 load가 지나가 있어(readyState가 벌써 'complete') 리스너가 영영
// 안 불리는 경우를 실측으로 확인 — 그냥 바로 등록한다(등록 자체는 load를 기다릴
// 이유가 없음).
if ("serviceWorker" in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register("/sw.js")
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <LanguageProvider>
        <AuthProvider>
          <WeatherWarningProvider>
            <App />
          </WeatherWarningProvider>
        </AuthProvider>
      </LanguageProvider>
    </BrowserRouter>
  </StrictMode>,
)
