import { AnimatePresence, motion } from 'framer-motion'
import { Loader2 } from 'lucide-react'
import { createPortal } from 'react-dom'

type Props = {
  open: boolean
  stageLabel: string
  characterName?: string
  batchIndex?: number
  batchTotal?: number
}

export function MomentGeneratingOverlay({
  open,
  stageLabel,
  characterName,
  batchIndex,
  batchTotal,
}: Props) {
  const showBatch = batchTotal != null && batchTotal > 1 && batchIndex != null
  const label = stageLabel.trim() || '正在启动生成…'

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-white/80 px-6 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          role="dialog"
          aria-modal="true"
          aria-busy="true"
          aria-label="正在生成朋友圈"
        >
          <motion.div
            className="w-full max-w-[300px] rounded-3xl border border-black/[0.06] bg-white px-6 py-8 text-center shadow-[0_16px_48px_rgba(0,0,0,0.08)]"
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          >
            <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-[#FAFAFA]">
              <Loader2 className="size-6 animate-spin text-[#111827]" strokeWidth={1.75} />
            </div>
            <p className="mt-5 text-[10px] font-medium uppercase tracking-[0.22em] text-[#9CA3AF]">
              Generating
            </p>
            <h3 className="mt-1 text-[17px] font-semibold text-[#111827]">正在生成朋友圈</h3>
            {showBatch ? (
              <p className="mt-1 text-[12px] tabular-nums text-[#9CA3AF]">
                {batchIndex} / {batchTotal}
              </p>
            ) : null}
            {characterName ? (
              <p className="mt-1 text-[13px] text-[#6B7280]">{characterName}</p>
            ) : null}
            <p className="mt-4 text-[12px] leading-relaxed text-[#9CA3AF]">{label}</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
