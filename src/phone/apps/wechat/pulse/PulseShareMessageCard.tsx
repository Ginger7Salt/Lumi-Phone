import { motion } from 'framer-motion'
import type { WeChatPulseSharePayload } from '../newFriendsPersona/types'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.38, ease: [0.22, 1, 0.36, 1] as const },
}

type Props = {
  data: WeChatPulseSharePayload
  compact?: boolean
  onOpen?: () => void
}

export function PulseShareMessageCard({ data, compact = false, onOpen }: Props) {
  const summary = data.excerpt?.trim() || data.content.trim()
  const clipped = summary.length > 96 ? `${summary.slice(0, 96)}…` : summary
  const hint = '点击查看微博动态'

  return (
    <motion.button
      type="button"
      onClick={(e) => {
        e.stopPropagation()
        onOpen?.()
      }}
      aria-label={hint}
      title={hint}
      className={`overflow-hidden rounded-[12px] border-[0.5px] border-gray-200 bg-[#F9FAFB] text-left shadow-[0_2px_15px_rgba(0,0,0,0.03)] transition-transform active:scale-[0.98] ${
        compact ? 'w-full' : 'w-[min(280px,calc(100vw-120px))]'
      }`}
      style={{ borderLeft: '2px solid #9CA3AF' }}
      {...CARD_MOTION}
    >
      <div className="px-3.5 py-2.5">
        <p className="text-[9px] font-medium uppercase tracking-[0.28em] text-neutral-400">
          LUMI PULSE | 微博动态分享
        </p>
        <p className="mt-2 text-[13px] font-medium text-[#1C1C1E]">{data.authorName}</p>
        <p className="mt-1.5 font-serif text-[12px] leading-[1.65] text-neutral-600">{clipped}</p>
        {data.trendingTitle ? (
          <p className="mt-2 text-[10px] tracking-[0.06em] text-neutral-400">{data.trendingTitle}</p>
        ) : null}
        {onOpen ? (
          <p className="mt-2 text-[10px] font-medium tracking-[0.04em] text-neutral-400">点击查看动态 →</p>
        ) : null}
      </div>
    </motion.button>
  )
}
