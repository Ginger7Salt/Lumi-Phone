import { motion } from 'framer-motion'
import type { DayPeriod } from '../types'
import { useSimulatorStore } from '../useSimulatorStore'

const GRADIENTS: Record<DayPeriod, string> = {
  morning: 'linear-gradient(180deg, #FFFBFB 0%, #FFF5F7 55%, #FFE4EC 100%)',
  afternoon: 'linear-gradient(180deg, #FFF7F8 0%, #FFF0F3 50%, #FCE7F3 100%)',
  evening: 'linear-gradient(180deg, #F5EEF0 0%, #EDE4E8 45%, #E8DFE6 100%)',
}

export function PeriodBackdrop() {
  const actionsUsedToday = useSimulatorStore((s) => s.actionsUsedToday)
  const period: DayPeriod =
    actionsUsedToday < 2 ? 'morning' : actionsUsedToday < 4 ? 'afternoon' : 'evening'

  return (
    <motion.div
      className="pointer-events-none absolute inset-0 z-0"
      animate={{ background: GRADIENTS[period] }}
      transition={{ duration: 1.2, ease: [0.22, 1, 0.36, 1] }}
      aria-hidden
    />
  )
}
