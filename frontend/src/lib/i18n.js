import i18n from "i18next"
import { initReactI18next } from "react-i18next"

import commonKo from "../locales/ko/common.json"
import homeKo from "../locales/ko/home.json"
import searchKo from "../locales/ko/search.json"
import placeDetailKo from "../locales/ko/placeDetail.json"
import mapKo from "../locales/ko/map.json"
import bumbimKo from "../locales/ko/bumbim.json"
import profileKo from "../locales/ko/profile.json"
import recommendKo from "../locales/ko/recommend.json"
import savedKo from "../locales/ko/saved.json"
import authKo from "../locales/ko/auth.json"
import adminKo from "../locales/ko/admin.json"

import commonEn from "../locales/en/common.json"
import homeEn from "../locales/en/home.json"
import searchEn from "../locales/en/search.json"
import placeDetailEn from "../locales/en/placeDetail.json"
import mapEn from "../locales/en/map.json"
import bumbimEn from "../locales/en/bumbim.json"
import profileEn from "../locales/en/profile.json"
import recommendEn from "../locales/en/recommend.json"
import savedEn from "../locales/en/saved.json"
import authEn from "../locales/en/auth.json"
import adminEn from "../locales/en/admin.json"

import commonZh from "../locales/zh/common.json"
import homeZh from "../locales/zh/home.json"
import searchZh from "../locales/zh/search.json"
import placeDetailZh from "../locales/zh/placeDetail.json"
import mapZh from "../locales/zh/map.json"
import bumbimZh from "../locales/zh/bumbim.json"
import profileZh from "../locales/zh/profile.json"
import recommendZh from "../locales/zh/recommend.json"
import savedZh from "../locales/zh/saved.json"
import authZh from "../locales/zh/auth.json"
import adminZh from "../locales/zh/admin.json"

export const SUPPORTED_LANGUAGES = ["ko", "en", "zh"]
export const STORAGE_KEY = "nowgo_lang"

function detectInitialLanguage() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (SUPPORTED_LANGUAGES.includes(stored)) return stored
  } catch {
    // localStorage 접근 불가(사파리 프라이빗 모드 등) 시 브라우저 언어로 폴백
  }
  const browserLang = navigator.language?.slice(0, 2)
  return SUPPORTED_LANGUAGES.includes(browserLang) ? browserLang : "ko"
}

i18n.use(initReactI18next).init({
  resources: {
    ko: { common: commonKo, home: homeKo, search: searchKo, placeDetail: placeDetailKo, map: mapKo, bumbim: bumbimKo, profile: profileKo, recommend: recommendKo, saved: savedKo, auth: authKo, admin: adminKo },
    en: { common: commonEn, home: homeEn, search: searchEn, placeDetail: placeDetailEn, map: mapEn, bumbim: bumbimEn, profile: profileEn, recommend: recommendEn, saved: savedEn, auth: authEn, admin: adminEn },
    zh: { common: commonZh, home: homeZh, search: searchZh, placeDetail: placeDetailZh, map: mapZh, bumbim: bumbimZh, profile: profileZh, recommend: recommendZh, saved: savedZh, auth: authZh, admin: adminZh },
  },
  lng: detectInitialLanguage(),
  fallbackLng: "ko",
  defaultNS: "common",
  interpolation: { escapeValue: false },
})

export default i18n
