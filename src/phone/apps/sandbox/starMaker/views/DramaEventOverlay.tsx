import { motion } from 'framer-motion'
import { Pressable } from '../../../../components/Pressable'
import { useSimulatorStore } from '../useSimulatorStore'

export function DramaEventOverlay() {
  const drama = useSimulatorStore((s) => s.pendingDrama)
  const resolveDramaChoice = useSimulatorStore((s) => s.resolveDramaChoice)

  if (!drama) return null

  return (
    <motion.div
      className="absolute inset-0 z-[100] flex flex-col bg-gradient-to-b from-[#2D2422]/90 to-[#1a1412]/95 px-5 pb-8 pt-[max(20px,env(safe-area-inset-top,0px))] text-[#FFFBFB]"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
    >
      <p className="text-[12px] tracking-[0.25em] text-rose-300/80">抓马事件</p>
      <h2 className="sm-serif mt-3 text-[22px] font-semibold">{drama.title}</h2>
      <div className="mt-6 flex min-h-0 flex-1 flex-col justify-center gap-4">
        {drama.lines.map((line, i) => (
          <motion.p
            key={i}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.3 }}
            className="sm-serif text-[16px] leading-[1.9] text-rose-50/95"
          >
            {line}
          </motion.p>
        ))}
      </div>
      <div className="space-y-2">
        {drama.choices.map((c) => (
          <Pressable
            key={c.id}
            onClick={() => resolveDramaChoice(c.id)}
            className="w-full rounded-2xl border border-rose-200/30 bg-white/10 px-4 py-3.5 text-[15px] text-rose-50 backdrop-blur-sm"
          >
            {c.label}
          </Pressable>
        ))}
      </div>
    </motion.div>
  )
}
