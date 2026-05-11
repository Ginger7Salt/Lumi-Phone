import { motion } from 'framer-motion'

/** 胶囊滑动开关：开启黑轨白钮，关闭浅灰轨白钮 */
export function PlatinumSwitch({
  checked,
  onChange,
  className,
  'aria-label': ariaLabel,
}: {
  checked: boolean
  onChange: (next: boolean) => void
  className?: string
  'aria-label'?: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`relative inline-flex h-7 w-12 shrink-0 rounded-full outline-none transition-colors ${className ?? ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!checked)
      }}
    >
      <motion.span
        className="pointer-events-none absolute inset-0 rounded-full"
        initial={false}
        animate={{
          backgroundColor: checked ? '#000000' : '#e5e5e5',
          boxShadow: checked ? 'inset 0 1px 1px rgba(255,255,255,0.12)' : 'none',
        }}
        transition={{ type: 'spring', damping: 28, stiffness: 420 }}
      />
      <motion.span
        className="pointer-events-none absolute top-0.5 z-[1] h-6 w-6 rounded-full bg-white shadow-md ring-1 ring-black/5"
        initial={false}
        animate={{ left: checked ? 'calc(100% - 1.5rem - 2px)' : '2px' }}
        transition={{ type: 'spring', damping: 30, stiffness: 400 }}
      />
    </button>
  )
}
