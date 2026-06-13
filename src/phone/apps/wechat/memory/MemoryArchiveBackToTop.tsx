import { AnimatePresence, motion } from 'framer-motion'
import { ChevronUp } from 'lucide-react'

type Props = {
  visible: boolean
  onClick: () => void
}

export function MemoryArchiveBackToTop({ visible, onClick }: Props) {
  return (
    <AnimatePresence>
      {visible ? (
        <motion.button
          type="button"
          initial={{ opacity: 0, y: 10, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 10, scale: 0.96 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          onClick={onClick}
          className="pointer-events-auto absolute right-5 top-1/2 z-30 flex size-11 -translate-y-1/2 items-center justify-center rounded-full border border-black/[0.06] bg-white text-gray-800 shadow-[0_8px_28px_rgba(0,0,0,0.08)] transition-transform hover:scale-[1.03] active:scale-[0.97] focus:outline-none focus-visible:ring-1 focus-visible:ring-gray-300"
          aria-label="回到顶部"
        >
          <ChevronUp className="size-5" strokeWidth={1.75} />
        </motion.button>
      ) : null}
    </AnimatePresence>
  )
}
