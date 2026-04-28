import type { PhoneTheme } from '../types'

type Props = {
  options: string[]
  theme: PhoneTheme
  onChangeOption: (index: number, value: string) => void
}

export function WheelEditor({ options, theme, onChangeOption }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {options.map((option, index) => (
        <label key={`wheel-option-${index}`} className="block">
          <span
            className="mb-1 block text-[10px] uppercase tracking-[0.26em]"
            style={{ color: theme.textMuted }}
          >
            Option {String(index + 1).padStart(2, '0')}
          </span>
          <input
            value={option}
            onChange={(event) => onChangeOption(index, event.target.value)}
            className="w-full border-0 border-b bg-transparent px-0 py-2 text-[14px] outline-none"
            style={{
              borderBottom: `1px solid ${theme.border}`,
              color: theme.text,
            }}
            placeholder={`选项 ${index + 1}`}
          />
        </label>
      ))}
    </div>
  )
}
