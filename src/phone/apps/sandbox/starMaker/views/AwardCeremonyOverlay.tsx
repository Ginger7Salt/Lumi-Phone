import { motion } from 'framer-motion'
import { useMemo } from 'react'
import { Pressable } from '../../../../components/Pressable'
import { SimNum } from '../components/SimNum'
import { computeAwardResults, useSimulatorStore } from '../useSimulatorStore'

export function AwardCeremonyOverlay() {
  const open = useSimulatorStore((s) => s.pendingQuarterlyAwards)
  const dismiss = useSimulatorStore((s) => s.dismissQuarterlyAwards)
  const artists = useSimulatorStore((s) => s.artists)
  const gameYear = useSimulatorStore((s) => s.gameYear)

  const results = useMemo(
    () => (open ? computeAwardResults(artists) : []),
    [artists, open],
  )

  if (!open) return null

  return (
    <motion.div
      className="absolute inset-0 z-[98] flex flex-col items-center justify-center bg-[#FFFBFB]/95 px-6 backdrop-blur-md"
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <motion.div
        animate={{ rotate: [0, 5, -5, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
        className="text-[48px]"
        aria-hidden
      >
        ✦
      </motion.div>
      <h2 className="sm-serif mt-4 text-[24px] font-semibold text-[#2D2422]">季度颁奖典礼</h2>
      <p className="mt-2 text-[13px] text-stone-500">
        第<SimNum>{gameYear}</SimNum>年 · 金话筒之夜
      </p>
      <div className="sm-card mt-8 w-full max-w-sm p-5">
        {results.map((r, i) => (
          <motion.div
            key={r.category}
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 + i * 0.15 }}
            className="flex items-center justify-between border-b border-rose-50 py-3 last:border-0"
          >
            <span className="text-[14px] text-stone-600">{r.category}</span>
            <span className="sm-serif text-[15px] font-medium text-rose-600">{r.artistName}</span>
          </motion.div>
        ))}
      </div>
      <Pressable onClick={dismiss} className="sm-btn-primary mt-8 w-full max-w-sm py-3.5 text-[15px]">
        礼成
      </Pressable>
    </motion.div>
  )
}
