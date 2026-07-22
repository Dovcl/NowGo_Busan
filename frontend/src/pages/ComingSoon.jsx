export default function ComingSoon({ title }) {
  return (
    <div className="h-full flex flex-col items-center justify-center gap-3 text-center px-4">
      <span className="material-symbols-outlined text-5xl text-outline-variant">construction</span>
      <h1 className="font-headline-lg-mobile text-headline-lg-mobile text-on-surface">{title}</h1>
      <p className="font-body-md text-on-surface-variant">준비 중인 화면이에요.</p>
    </div>
  )
}
