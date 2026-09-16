// 어떤 공공/외부 API를 쓰는지 정리한 정적 안내 페이지 — 관리자 전용.
// AdminDataInspector(실시간 DB 테이블 조회)와 달리 이 페이지는 백엔드 호출이 없는
// 순수 문서 페이지라, 보안 경계도 필요 없다(role 체크는 UX일 뿐).
import { useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuth } from "../context/AuthContext"

export default function AdminDataSources() {
  const { t } = useTranslation("admin")
  const { user, loading: authLoading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!authLoading && user?.role !== "admin") navigate("/", { replace: true })
  }, [authLoading, user, navigate])

  if (authLoading || user?.role !== "admin") return null

  const items = t("dataSources.items", { returnObjects: true })

  return (
    <div className="h-full overflow-y-auto">
      <div className="px-4 md:px-container-margin py-6 pb-24 md:pb-8 max-w-4xl mx-auto w-full flex flex-col gap-gutter">
        <div>
          <h1 className="font-headline-lg-mobile text-headline-lg-mobile md:font-headline-lg md:text-headline-lg font-bold text-on-surface">
            {t("dataSources.title")}
          </h1>
          <p className="font-body-md text-body-md text-on-surface-variant mt-1">{t("dataSources.subtitle")}</p>
        </div>

        <div className="flex flex-col gap-gutter">
          {items.map((item) => (
            <div
              key={item.name}
              className="bg-surface-container-lowest rounded-xl border border-outline-variant/20 p-4 flex flex-col gap-1"
            >
              <div className="flex items-baseline justify-between gap-4">
                <h3 className="font-body-md text-body-md font-bold text-on-surface">{item.name}</h3>
                <span className="font-label-sm text-[12px] text-on-surface-variant shrink-0">{item.provider}</span>
              </div>
              <p className="font-label-sm text-[13px] text-on-surface-variant">{item.usage}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
