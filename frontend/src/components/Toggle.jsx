// Reusable switch. `activeClass` must be a complete literal Tailwind class
// (e.g. "peer-checked:bg-primary") — never build it from concatenated parts,
// Tailwind's content scanner only picks up whole class names it can see as text.
export default function Toggle({ checked, onChange, activeClass = "peer-checked:bg-primary" }) {
  return (
    <label className="relative inline-flex items-center cursor-pointer shrink-0">
      <input
        type="checkbox"
        className="sr-only peer"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <div
        className={`w-11 h-6 bg-outline-variant rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:border-gray-300 after:rounded-full after:h-5 after:w-5 after:transition-all transition-colors ${activeClass}`}
      />
    </label>
  )
}
