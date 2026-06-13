import { ArrowLeft } from 'lucide-react'
import { motion } from 'framer-motion'
import type { ReactNode } from 'react'

type ArchiveMomentsHeaderProps = {
  title: string
  opacity: number
  onBack?: () => void
  rightSlot?: ReactNode
}

/** 与朋友圈浏览页 DynamicHeader 同构，仅保留返回与居中标题 */
export function ArchiveMomentsHeader({
  title,
  opacity,
  onBack,
  rightSlot,
}: ArchiveMomentsHeaderProps) {
  const onCover = opacity < 0.5
  const actionBtnClass = onCover
    ? 'text-white drop-shadow-[0_1px_4px_rgba(0,0,0,0.35)]'
    : 'text-[#111827]'

  return (
    <div className="pointer-events-none sticky inset-x-0 top-0 z-30 h-0">
      <div
        className="pointer-events-none absolute inset-x-0 top-0 border-b px-3 pb-2"
        style={{
          paddingTop: 'max(0px, env(safe-area-inset-top, 0px))',
          borderColor: 'var(--wx-border, rgba(0,0,0,0.08))',
          background: 'rgba(255,255,255,0.96)',
          backdropFilter: 'blur(8px)',
          opacity,
        }}
      >
        <div className="relative flex min-h-[36px] items-center justify-between">
          <h1 className="pointer-events-none absolute inset-x-0 text-center text-[17px] font-semibold tracking-[0.2px] text-[#111827]">
            {title}
          </h1>
        </div>
      </div>

      <div
        className="pointer-events-auto absolute inset-x-0 top-0 px-3 pb-2"
        style={{ paddingTop: 'max(0px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="relative flex min-h-[36px] items-center justify-between gap-2">
          <div className="relative z-[1] flex shrink-0 items-center">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onBack}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full focus:outline-none ${actionBtnClass}`}
              aria-label="返回"
            >
              <ArrowLeft className="size-4" />
            </motion.button>
          </div>
          {rightSlot ? (
            <div className={`relative z-[1] ml-auto flex shrink-0 items-center ${actionBtnClass}`}>
              {rightSlot}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  )
}
