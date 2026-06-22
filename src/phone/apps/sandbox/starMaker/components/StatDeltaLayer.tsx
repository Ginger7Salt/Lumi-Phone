import { AnimatePresence, motion } from 'framer-motion'
import { useSimulatorStore } from '../useSimulatorStore'
import { SimNumText } from './SimNum'

export function StatDeltaLayer() {
  const deltas = useSimulatorStore((s) => s.floatingDeltas)

  return (
    <div className="pointer-events-none absolute inset-x-0 top-[34%] z-[80] flex justify-center px-4">
      <div className="flex max-w-full flex-wrap items-center justify-center gap-2">
        <AnimatePresence mode="popLayout">
          {deltas.map((d, index) => (
            <motion.div
              key={d.id}
              layout
              initial={{ opacity: 0, y: 8, scale: 0.9 }}
              animate={{ opacity: 1, y: -6, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.92 }}
              transition={{
                duration: 0.35,
                delay: index * 0.06,
                ease: 'easeOut',
              }}
              className="shrink-0"
            >
              <span
                className={`sm-serif inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[13px] shadow-md backdrop-blur-sm ${
                  d.tone === 'gain'
                    ? 'bg-rose-100/95 text-rose-600'
                    : d.tone === 'loss'
                      ? 'bg-stone-200/95 text-stone-600'
                      : 'bg-white/95 text-stone-700'
                }`}
              >
                <span>{d.label}</span>
                <SimNumText text={d.value} />
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  )
}
