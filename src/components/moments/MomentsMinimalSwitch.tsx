import { motion } from 'framer-motion'

type Props = {
  checked: boolean
  onChange: (next: boolean) => void
  label?: string
}

export function MomentsMinimalSwitch({ checked, onChange, label }: Props) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 shrink-0 rounded-full transition-colors duration-200 ${
        checked ? 'bg-[#1C1C1E]' : 'bg-gray-200'
      }`}
    >
      <motion.span
        layout
        transition={{ type: 'spring', stiffness: 520, damping: 34 }}
        className="absolute top-0.5 block size-6 rounded-full bg-white shadow-[0_1px_4px_rgba(0,0,0,0.12)]"
        style={{ left: checked ? '22px' : '2px' }}
      />
    </button>
  )
}
