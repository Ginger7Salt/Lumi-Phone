import { motion } from 'framer-motion'

export const CLUE_DISCOVERY_TOAST_MS = 1680

export type ClueDiscoveryToastProps = {
  clueCount?: number
}

function DiscoveryCompassMark() {
  return (
    <svg
      viewBox="0 0 72 72"
      className="jbs-clue-discovery-compass h-[52px] w-[52px]"
      aria-hidden
    >
      <circle cx="36" cy="36" r="30" fill="none" stroke="currentColor" strokeWidth="0.6" opacity="0.45" />
      <circle cx="36" cy="36" r="20" fill="none" stroke="currentColor" strokeWidth="0.35" opacity="0.35" />
      <path
        d="M36 12 L40 36 L36 60 L32 36 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
      />
      <path
        d="M12 36 L36 32 L60 36 L36 40 Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="0.75"
        opacity="0.85"
      />
      <circle cx="36" cy="36" r="2.5" fill="currentColor" />
    </svg>
  )
}

export function ClueDiscoveryToast({ clueCount = 1 }: ClueDiscoveryToastProps) {
  const title = clueCount > 1 ? `发现 ${clueCount} 条新线索` : '发现新线索'
  const subtitle = clueCount > 1 ? '物证已入库待勘 · 请逐张收纳' : '物证已入库待勘'

  return (
    <motion.div
      className="jbs-clue-discovery-scrim fixed inset-0 z-[71] flex items-center justify-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.32 }}
      role="status"
      aria-live="assertive"
      aria-label={title}
    >
      <motion.div
        className="jbs-clue-discovery-panel relative flex flex-col items-center"
        initial={{ opacity: 0, scale: 0.82, y: 18 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: -10 }}
        transition={{ duration: 0.48, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="jbs-clue-discovery-panel-glow" aria-hidden />
        <div className="jbs-clue-discovery-panel-frame">
          <span className="jbs-clue-discovery-corner jbs-clue-discovery-corner--tl" aria-hidden />
          <span className="jbs-clue-discovery-corner jbs-clue-discovery-corner--tr" aria-hidden />
          <span className="jbs-clue-discovery-corner jbs-clue-discovery-corner--bl" aria-hidden />
          <span className="jbs-clue-discovery-corner jbs-clue-discovery-corner--br" aria-hidden />

          <motion.div
            className="jbs-clue-discovery-icon-wrap"
            initial={{ opacity: 0, rotate: -18 }}
            animate={{ opacity: 1, rotate: 0 }}
            transition={{ delay: 0.12, duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
          >
            <DiscoveryCompassMark />
          </motion.div>

          <motion.p
            className="jbs-clue-discovery-eyebrow jbs-font-serif mt-5 text-[9px] tracking-[0.38em]"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2, duration: 0.4 }}
          >
            EVIDENCE UNLOCKED
          </motion.p>

          <motion.h2
            className="jbs-clue-discovery-title jbs-font-serif mt-2 text-[21px] font-normal tracking-[0.18em]"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.28, duration: 0.45 }}
          >
            {title}
          </motion.h2>

          <motion.p
            className="jbs-clue-discovery-sub jbs-font-serif mt-2.5 text-[10px] tracking-[0.22em]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.38, duration: 0.4 }}
          >
            {subtitle}
          </motion.p>

          <motion.div
            className="jbs-clue-discovery-rule mt-5"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.42, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
            aria-hidden
          />
        </div>
      </motion.div>
    </motion.div>
  )
}
