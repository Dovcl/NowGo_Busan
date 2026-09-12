// Dual-thumb range slider (e.g. shopping-site price filter) for NowGo Score.
// Two overlapping <input type="range"> elements — no extra library needed.
export default function ScoreRangeSlider({ min, max, value, onChange }) {
  const [lo, hi] = value

  const handleLoChange = (e) => onChange([Math.min(Number(e.target.value), hi), hi])
  const handleHiChange = (e) => onChange([lo, Math.max(Number(e.target.value), lo)])

  const loPct = ((lo - min) / (max - min)) * 100
  const hiPct = ((hi - min) / (max - min)) * 100

  return (
    <div>
      <div className="relative h-5 flex items-center">
        <div className="absolute inset-x-0 h-1.5 rounded-full bg-surface-container-high" />
        <div className="absolute h-1.5 rounded-full bg-primary" style={{ left: `${loPct}%`, right: `${100 - hiPct}%` }} />
        <input
          type="range"
          min={min}
          max={max}
          value={lo}
          onChange={handleLoChange}
          className="range-thumb absolute inset-x-0 w-full appearance-none bg-transparent"
        />
        <input
          type="range"
          min={min}
          max={max}
          value={hi}
          onChange={handleHiChange}
          className="range-thumb absolute inset-x-0 w-full appearance-none bg-transparent"
        />
      </div>
      <div className="flex justify-between mt-1 font-label-sm text-label-sm text-on-surface-variant">
        <span>{lo}</span>
        <span>{hi}</span>
      </div>
    </div>
  )
}
