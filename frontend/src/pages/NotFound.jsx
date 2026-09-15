import { Link } from "react-router-dom"
import { useTranslation } from "react-i18next"

export default function NotFound() {
  const { t } = useTranslation("common")

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-4 px-container-margin py-20 text-center">
      <span className="material-symbols-outlined text-6xl text-outline-variant">explore_off</span>
      <h1 className="font-headline-lg text-headline-lg text-on-surface">{t("notFound.title")}</h1>
      <p className="font-body-md text-body-md text-on-surface-variant max-w-sm">{t("notFound.description")}</p>
      <Link
        to="/"
        className="mt-2 h-12 px-6 inline-flex items-center justify-center bg-primary text-on-primary rounded-lg font-headline-lg-mobile transition-colors hover:bg-primary/90"
      >
        {t("notFound.backHome")}
      </Link>
    </div>
  )
}
