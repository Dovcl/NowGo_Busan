// Loads the Kakao Maps JS SDK once and exposes the `kakao` global when ready.
// Centralized here (per harness/skills/design-skill.md) so no component
// injects the script tag or touches `window.kakao` directly.
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import i18n from "../lib/i18n"

let loadPromise = null

function loadKakaoSdk(appKey) {
  if (window.kakao?.maps) return Promise.resolve(window.kakao)
  if (loadPromise) return loadPromise

  loadPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${appKey}&autoload=false`
    script.async = true
    script.onload = () => window.kakao.maps.load(() => resolve(window.kakao))
    script.onerror = () => reject(new Error(i18n.t("errors.kakaoMapLoadFailed", { ns: "common" })))
    document.head.appendChild(script)
  })
  return loadPromise
}

export function useKakaoMap() {
  const { t } = useTranslation("common")
  const [kakao, setKakao] = useState(window.kakao?.maps ? window.kakao : null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (kakao) return
    const appKey = import.meta.env.VITE_KAKAO_JS_API_KEY
    if (!appKey || appKey === "your_kakao_js_api_key_here") {
      setError(t("errors.kakaoMapKeyMissing"))
      return
    }
    loadKakaoSdk(appKey)
      .then(setKakao)
      .catch((err) => setError(err.message))
  }, [kakao, t])

  return { kakao, error }
}
