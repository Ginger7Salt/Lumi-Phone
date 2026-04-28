import { apiTheme } from '../theme'

export function ToggleSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (next: boolean) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="relative h-7 w-16 rounded-full transition-all duration-200 ease-out"
      style={{ background: checked ? apiTheme.accent : apiTheme.subText }}
      aria-pressed={checked}
    >
      <span
        className="absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all duration-200 ease-out"
        style={{ left: 2, transform: `translateX(${checked ? 36 : 0}px)` }}
      />
    </button>
  )
}

