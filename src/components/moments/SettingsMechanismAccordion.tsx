import { AnimatePresence, motion } from 'framer-motion'
import { useState } from 'react'

type Props = {
  triggerLabel: string
  body: string
}

export function SettingsMechanismAccordion({ triggerLabel, body }: Props) {
  const [open, setOpen] = useState(false)

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="text-[12px] tracking-wide text-[#9CA3AF] underline decoration-[#E5E7EB] underline-offset-4 transition-colors hover:text-[#6B7280]"
      >
        {triggerLabel}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
            className="overflow-hidden"
          >
            <p className="mt-3 rounded-2xl bg-gray-50/50 px-4 py-4 font-serif text-[13px] leading-relaxed text-[#6B7280]">
              {body}
            </p>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  )
}
