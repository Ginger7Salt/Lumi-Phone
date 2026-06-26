import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useState } from 'react'

import { phoneNumStyle } from '../../types'

const EASE = [0.22, 1, 0.36, 1] as const
const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

type Props = {
  open: boolean
  amountLabel: string
  storeName?: string
  onFinished: () => void
}

/** 支付成功仪式：铂金圆环描边、勾选路径、金额确认 */
export function PaymentSuccessCeremony({ open, amountLabel, storeName, onFinished }: Props) {
  const [phase, setPhase] = useState<'in' | 'hold' | 'out'>('in')

  useEffect(() => {
    if (!open) {
      setPhase('in')
      return
    }
    setPhase('in')
    const t1 = window.setTimeout(() => setPhase('hold'), 520)
    const t2 = window.setTimeout(() => setPhase('out'), 2100)
    const t3 = window.setTimeout(() => onFinished(), 2700)
    return () => {
      window.clearTimeout(t1)
      window.clearTimeout(t2)
      window.clearTimeout(t3)
    }
  }, [open, onFinished])

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          key="payment-success-ceremony"
          className="absolute inset-0 z-[90] flex items-center justify-center overflow-hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: phase === 'out' ? 0 : 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: phase === 'out' ? 0.55 : 0.4, ease: EASE }}
        >
          <motion.div
            className="absolute inset-0 bg-white/92 backdrop-blur-xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, ease: EASE }}
          />

          <motion.div
            className="pointer-events-none absolute size-[min(72vw,280px)] rounded-full bg-[#D4AF37]/[0.07]"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={{
              scale: phase === 'out' ? 1.15 : [0.85, 1.05, 0.95, 1],
              opacity: phase === 'out' ? 0 : [0, 0.55, 0.35, 0.45],
            }}
            transition={{
              duration: phase === 'out' ? 0.5 : 2.2,
              ease: 'easeInOut',
              repeat: phase === 'out' ? 0 : Infinity,
              repeatType: 'reverse',
            }}
            aria-hidden
          />

          <motion.div
            className="relative z-10 flex flex-col items-center px-8"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: phase === 'out' ? 0 : 1, y: phase === 'out' ? -12 : 0 }}
            transition={{ duration: 0.55, ease: EASE }}
          >
            <div className="relative flex size-[108px] items-center justify-center">
              <motion.span
                className="absolute inset-0 rounded-full border border-[#D4AF37]/20"
                initial={{ scale: 0.88, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.5, ease: EASE }}
                aria-hidden
              />
              <svg width="108" height="108" viewBox="0 0 100 100" className="relative" aria-hidden>
                <motion.circle
                  cx="50"
                  cy="50"
                  r="44"
                  fill="none"
                  stroke="#D4AF37"
                  strokeWidth="1.2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0.35 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.85, ease: EASE }}
                />
                <motion.path
                  d="M32 50 L44 62 L68 38"
                  fill="none"
                  stroke="#1C1C1E"
                  strokeWidth="2.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ duration: 0.42, delay: 0.62, ease: EASE }}
                />
              </svg>
            </div>

            <motion.p
              className="mt-7 text-[13px] tracking-[0.22em] text-[#D4AF37]"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.75, ease: EASE }}
            >
              支付成功
            </motion.p>

            <motion.p
              className="mt-4 text-[28px] leading-none text-[#1C1C1E]"
              style={phoneNumStyle}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.88, ease: EASE }}
            >
              {amountLabel}
            </motion.p>

            {storeName ? (
              <motion.p
                className="mt-2 max-w-[min(88vw,18rem)] truncate text-center text-[11px] tracking-[0.08em] text-neutral-400"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.4, delay: 1.02, ease: EASE }}
              >
                {storeName}
              </motion.p>
            ) : null}

            <motion.div
              className="mt-8 flex flex-col items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: phase === 'hold' || phase === 'out' ? 1 : 0 }}
              transition={{ duration: 0.45, delay: 0.15, ease: EASE }}
            >
              <span className="h-px w-10 bg-gradient-to-r from-transparent via-[#D4AF37]/50 to-transparent" />
              <p className="text-[11px] tracking-[0.14em] text-neutral-400" style={{ fontFamily: SERIF }}>
                正在为您安排配送
              </p>
              <motion.span
                className="size-1 rounded-full bg-[#D4AF37]"
                animate={{ opacity: [0.25, 1, 0.25], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 1.4, repeat: Infinity, ease: 'easeInOut' }}
                aria-hidden
              />
            </motion.div>
          </motion.div>

          {phase === 'out' ? (
            <motion.div
              className="absolute inset-0 bg-[#FAFAFA]"
              initial={{ y: '100%' }}
              animate={{ y: '-100%' }}
              transition={{ duration: 0.65, ease: EASE }}
              aria-hidden
            />
          ) : null}
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
