import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import Toggle from "../components/Toggle"
import { useAuth } from "../context/AuthContext"
import { fetchMyLists, fetchListItems } from "../services/listsService"
import { fetchPlaceById } from "../services/placesService"

const PERSONAS = ["20대", "30대", "40대+"]
const LANGUAGES = [
  { code: "ko", flag: "🇰🇷", label: "한국어" },
  { code: "en", flag: "🇺🇸", label: "English" },
  { code: "zh", flag: "🇨🇳", label: "中文" },
  { code: "ja", flag: "🇯🇵", label: "日本語" },
]

export default function Profile() {
  const { user, isLoggedIn, openLoginModal, logout } = useAuth()
  const [respiratoryMode, setRespiratoryMode] = useState(true)
  const [persona, setPersona] = useState("20대")
  const [withChildren, setWithChildren] = useState(false)
  const [language, setLanguage] = useState("ko")
  const [notifDanger, setNotifDanger] = useState(true)
  const [notifDaily, setNotifDaily] = useState(true)
  const [notifDust, setNotifDust] = useState(true)
  const [darkMode, setDarkMode] = useState(false)

  // 리스트별로 담긴 장소를 보여준다 ("즐겨찾기" 기본 리스트뿐 아니라 유저가
  // 직접 만든 리스트도 전부 — SaveToListModal에서 만든 리스트가 여기 안 보이면 안 됨).
  const [savedLists, setSavedLists] = useState([])

  useEffect(() => {
    if (!isLoggedIn) return setSavedLists([])
    fetchMyLists().then(async (lists) => {
      const withPlaces = await Promise.all(
        lists
          .filter((l) => l.itemCount > 0)
          .map(async (l) => {
            const contentids = await fetchListItems(l.id)
            const places = (await Promise.all(contentids.map(fetchPlaceById))).filter(Boolean)
            return { ...l, places }
          })
      )
      setSavedLists(withPlaces)
    })
  }, [isLoggedIn])

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-4xl mx-auto w-full px-4 md:px-container-margin pt-gutter md:pt-section-gap pb-24 md:pb-section-gap flex flex-col gap-section-gap">
        <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg text-on-surface">
          프로필 및 설정
        </h1>

        {/* Profile card */}
        <section className="bg-gradient-to-r from-primary-container to-primary rounded-xl p-card-padding shadow-[0_4px_20px_rgba(0,0,0,0.05)] text-on-primary relative overflow-hidden flex flex-col gap-stack-gap min-h-[192px] justify-center items-center">
          <div className="absolute -top-24 -right-24 w-64 h-64 bg-white/10 rounded-full blur-2xl" />
          <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-secondary-fixed-dim/20 rounded-full blur-xl" />
          {isLoggedIn ? (
            <div className="flex flex-col items-center gap-stack-gap relative z-10 w-full">
              <div className="w-20 h-20 rounded-full border-4 border-white shadow-lg overflow-hidden bg-surface shrink-0 flex items-center justify-center">
                <span className="material-symbols-outlined text-4xl text-primary">person</span>
              </div>
              <div className="text-center">
                <h2 className="font-headline-lg-mobile text-headline-lg-mobile">{user.nickname}</h2>
                <p className="font-body-md text-body-md text-on-primary-container">
                  {user.nickname}님, 안전한 부산 여행 하고 계세요!
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-stack-gap relative z-10 w-full">
              <h2 className="font-headline-lg-mobile text-headline-lg-mobile text-center">NowGo Busan 시작하기</h2>
              <p className="font-body-md text-body-md text-on-primary-container text-center mb-2">
                맞춤 안전 알림을 받고 관심 있는 관광지를 저장해보세요.
              </p>
              <button
                type="button"
                onClick={openLoginModal}
                className="bg-[#FEE500] text-black font-body-md text-body-md rounded-lg px-6 py-3 font-bold flex items-center gap-2 shadow-lg hover:bg-[#E5CD00] transition-colors"
              >
                <span className="material-symbols-outlined filled-icon">chat_bubble</span>
                로그인하기
              </button>
            </div>
          )}
        </section>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-gutter">
          {/* Column 1 */}
          <div className="flex flex-col gap-gutter">
            <SettingsCard icon="psychology" title="맞춤 설정">
              <div className="flex justify-between items-start gap-4">
                <div className="flex flex-col">
                  <span className="font-body-md text-body-md font-bold text-on-surface">호흡기 약자 모드</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">
                    대기질·자외선에 더 민감한 추천을 받아요.
                  </span>
                </div>
                <Toggle checked={respiratoryMode} onChange={setRespiratoryMode} activeClass="peer-checked:bg-primary" />
              </div>
              <Divider />
              <div className="flex flex-col gap-2">
                <span className="font-body-md text-body-md font-bold text-on-surface">내 페르소나</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant mb-2">
                  Recommend 탭 추천 필터에 반영돼요.
                </span>
                <div className="flex flex-wrap gap-2">
                  {PERSONAS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPersona(p)}
                      className={`px-4 py-2 rounded-full font-label-sm text-label-sm ${
                        p === persona
                          ? "border border-primary text-primary font-bold bg-primary-container/10"
                          : "border border-outline-variant text-on-surface-variant hover:bg-surface-container-low transition-colors"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                <div className="flex justify-between items-center mt-3 bg-surface-container-low p-3 rounded-lg border border-outline-variant/50">
                  <div className="flex items-center gap-2">
                    <span className="material-symbols-outlined text-primary">child_care</span>
                    <span className="font-body-md text-body-md">아이 동반</span>
                  </div>
                  <Toggle checked={withChildren} onChange={setWithChildren} activeClass="peer-checked:bg-primary" />
                </div>
              </div>
            </SettingsCard>

            <SettingsCard icon="translate" title="언어">
              <div className="flex flex-col gap-1">
                {LANGUAGES.map((lang) => (
                  <button
                    key={lang.code}
                    type="button"
                    onClick={() => setLanguage(lang.code)}
                    className={`flex justify-between items-center p-3 rounded-lg border transition-colors ${
                      lang.code === language
                        ? "bg-surface-container-low border-primary/20"
                        : "border-transparent hover:bg-surface-container-low"
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <span className="text-xl">{lang.flag}</span>
                      <span
                        className={`font-body-md text-body-md ${
                          lang.code === language ? "font-bold text-primary" : "text-on-surface-variant"
                        }`}
                      >
                        {lang.label}
                      </span>
                    </span>
                    {lang.code === language && <span className="material-symbols-outlined text-primary">check</span>}
                  </button>
                ))}
              </div>
            </SettingsCard>
          </div>

          {/* Column 2 */}
          <div className="flex flex-col gap-gutter">
            <SettingsCard icon="notifications_active" title="알림">
              <div className="flex justify-between items-center gap-4">
                <span className="font-body-md text-body-md text-on-surface">찜한 장소 위험 신호 알림</span>
                <Toggle checked={notifDanger} onChange={setNotifDanger} activeClass="peer-checked:bg-error" />
              </div>
              <Divider />
              <div className="flex justify-between items-center gap-4">
                <span className="font-body-md text-body-md text-on-surface">매일 아침 추천 코스 알림</span>
                <Toggle checked={notifDaily} onChange={setNotifDaily} activeClass="peer-checked:bg-primary" />
              </div>
              <Divider />
              <div className="flex justify-between items-center gap-4">
                <span className="font-body-md text-body-md text-on-surface">황사·폭염 특보 알림</span>
                <Toggle checked={notifDust} onChange={setNotifDust} activeClass="peer-checked:bg-tertiary-container" />
              </div>
            </SettingsCard>

            <SettingsCard icon="settings" title="일반">
              <div className="flex justify-between items-center gap-4">
                <div className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-on-surface-variant">dark_mode</span>
                  <span className="font-body-md text-body-md text-on-surface">다크 모드</span>
                </div>
                <Toggle checked={darkMode} onChange={setDarkMode} activeClass="peer-checked:bg-inverse-surface" />
              </div>
              <Divider />
              <div className="flex justify-between items-center gap-4 py-1">
                <div className="flex flex-col">
                  <span className="font-body-md text-body-md text-on-surface">데이터 출처</span>
                  <span className="font-label-sm text-label-sm text-on-surface-variant">TourAPI · 관광 빅데이터 기반</span>
                </div>
                <span className="material-symbols-outlined text-outline-variant">chevron_right</span>
              </div>
              <Divider />
              <div className="flex justify-between items-center gap-4 py-1">
                <span className="font-body-md text-body-md text-on-surface">앱 버전</span>
                <span className="font-label-sm text-label-sm text-on-surface-variant">v0.1.0 (최신 버전)</span>
              </div>
              <div className="mt-4 pt-4 border-t border-outline-variant/30 flex justify-center">
                <button
                  type="button"
                  onClick={logout}
                  className="font-body-md text-body-md text-error font-bold hover:bg-error-container/20 px-4 py-2 rounded-lg transition-colors"
                >
                  로그아웃
                </button>
              </div>
            </SettingsCard>
          </div>
        </div>

        {/* Saved places, grouped by list */}
        <section className="flex flex-col gap-section-gap">
          <div className="flex justify-between items-center">
            <h2 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-bold text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-error filled-icon">favorite</span>
              찜한 관광지
            </h2>
            {isLoggedIn && savedLists.length > 0 && (
              <Link to="/saved" className="font-body-md text-body-md text-primary font-bold hover:underline">
                보관함 전체보기
              </Link>
            )}
          </div>

          {!isLoggedIn && (
            <p className="font-body-md text-body-md text-on-surface-variant">로그인하면 저장한 관광지가 여기 모여요.</p>
          )}
          {isLoggedIn && savedLists.length === 0 && (
            <p className="font-body-md text-body-md text-on-surface-variant">
              아직 저장한 관광지가 없어요. 지도에서 마커를 눌러 저장해보세요.
            </p>
          )}

          {savedLists.map((list) => (
            <SavedListSection key={list.id} list={list} />
          ))}
        </section>
      </div>
    </div>
  )
}

const SAVED_PREVIEW_COUNT = 3

function SavedListSection({ list }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? list.places : list.places.slice(0, SAVED_PREVIEW_COUNT)
  const hiddenCount = list.places.length - SAVED_PREVIEW_COUNT

  return (
    <div className="flex flex-col gap-gutter">
      <h3 className="font-body-md text-body-md font-bold text-on-surface-variant flex items-center gap-2">
        <span className="material-symbols-outlined text-[18px]" style={list.isDefault ? { fontVariationSettings: "'FILL' 1" } : undefined}>
          {list.isDefault ? "favorite" : "list"}
        </span>
        {list.name}
        <span className="font-label-sm text-label-sm text-outline">{list.places.length}개</span>
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-gutter">
        {visible.map((place) => (
          <SavedPlaceCard key={place.id} place={place} />
        ))}
      </div>
      {hiddenCount > 0 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="self-start font-body-md text-body-md text-primary font-bold hover:underline"
        >
          {expanded ? "접기" : `더보기 (${hiddenCount}개 더)`}
        </button>
      )}
    </div>
  )
}

function SavedPlaceCard({ place }) {
  return (
    <Link
      to={`/place/${place.id}`}
      className="bg-surface-container-lowest rounded-xl overflow-hidden shadow-[0_4px_20px_rgba(0,0,0,0.05)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-all border border-outline-variant/30 group"
    >
      <div className="h-32 w-full relative">
        {place.image && (
          <img
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            src={place.image}
            alt={place.name}
          />
        )}
        <div className="absolute top-2 right-2 bg-white/80 backdrop-blur-sm p-1.5 rounded-full shadow-sm">
          <span className="material-symbols-outlined text-error text-sm filled-icon">favorite</span>
        </div>
      </div>
      <div className="p-4 flex flex-col gap-1">
        <h4 className="font-body-md text-body-md font-bold text-on-surface truncate">{place.name}</h4>
        <p className="font-label-sm text-label-sm text-on-surface-variant">{place.category}</p>
      </div>
    </Link>
  )
}

function SettingsCard({ icon, title, children }) {
  return (
    <section className="bg-surface-container-lowest rounded-xl p-card-padding shadow-[0_4px_20px_rgba(0,0,0,0.05)] border border-outline-variant/30 flex flex-col gap-stack-gap hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] transition-shadow">
      <div className="flex items-center gap-2 mb-2">
        <div className="bg-surface-container-low p-2 rounded-lg text-primary">
          <span className="material-symbols-outlined">{icon}</span>
        </div>
        <h3 className="font-body-md text-body-md font-bold">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function Divider() {
  return <div className="h-px bg-outline-variant/30 w-full" />
}
