import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'

const CEREMONY_LINES = [
  '正在同步思维网络...',
  '正在解析近期记忆...',
  '正在潜入潜意识层...',
  '正在书写不可告人的独白...',
]

export function DiaryGenerateOverlay({ open }: { open: boolean }) {
  const [lineIndex, setLineIndex] = useState(0)

  useEffect(() => {
    if (!open) return
    const id = window.setInterval(() => {
      setLineIndex((v) => (v + 1) % CEREMONY_LINES.length)
    }, 920)
    return () => window.clearInterval(id)
  }, [open])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[1500] flex items-center justify-center bg-black/28 backdrop-blur-[2px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <div className="w-[min(320px,calc(100vw-2rem))] rounded-2xl border border-black/8 bg-white/92 p-5 shadow-[0_8px_32px_rgba(0,0,0,0.06)]">
            <div className="text-center text-[11px] tracking-[0.22em] text-gray-500">思维同步中</div>
            <motion.div
              className="mx-auto mt-4 h-px w-full max-w-[200px] bg-gray-900"
              animate={{ opacity: [0.15, 0.85, 0.15], scaleX: [0.92, 1, 0.92] }}
              transition={{ duration: 1.35, repeat: Infinity, ease: 'easeInOut' }}
            />
            <AnimatePresence mode="wait">
              <motion.div
                key={lineIndex}
                className="mt-5 h-5 text-center font-mono text-[12px] text-gray-700"
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                transition={{ duration: 0.28 }}
              >
                {CEREMONY_LINES[lineIndex]}
              </motion.div>
            </AnimatePresence>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
