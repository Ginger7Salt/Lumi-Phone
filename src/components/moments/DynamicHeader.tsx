import { ArrowLeft, Bell, Camera, SlidersHorizontal, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

import { MomentsSerifNumericText } from './ArchiveTimelineDateColumn'

type DynamicHeaderProps = {
  opacity: number
  onBack?: () => void
  goToPublish?: () => void
  onOpenSettings?: () => void
  onInstantGen?: () => void
  onOpenInteractionHistory?: () => void
  interactionUnreadCount?: number
}

export function DynamicHeader({
  opacity,
  onBack,
  goToPublish,
  onOpenSettings,
  onInstantGen,
  onOpenInteractionHistory,
  interactionUnreadCount = 0,
}: DynamicHeaderProps) {
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
            朋友圈
          </h1>
        </div>
      </div>

      <div
        className="pointer-events-auto absolute inset-x-0 top-0 px-3 pb-2"
        style={{ paddingTop: 'max(0px, env(safe-area-inset-top, 0px))' }}
      >
        <div className="relative flex min-h-[36px] items-center justify-between gap-2">
          <div className="relative z-[1] flex shrink-0 items-center gap-0.5">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={onBack}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full focus:outline-none ${actionBtnClass}`}
            aria-label="返回"
          >
            <ArrowLeft className="size-4" />
          </motion.button>
          {onInstantGen ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onInstantGen}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full focus:outline-none ${actionBtnClass}`}
              aria-label="瞬时降临"
            >
              <Sparkles className="size-4" strokeWidth={1.75} />
            </motion.button>
          ) : null}
        </div>
        <div className="relative z-[1] flex shrink-0 items-center gap-0.5">
          {onOpenInteractionHistory ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onOpenInteractionHistory}
              className={`relative inline-flex h-9 w-9 items-center justify-center rounded-full focus:outline-none ${actionBtnClass}`}
              aria-label={
                interactionUnreadCount > 0
                  ? `全部互动消息，${interactionUnreadCount} 条未读`
                  : '全部互动消息'
              }
            >
              <Bell className="size-4" strokeWidth={1.75} />
              {interactionUnreadCount > 0 ? (
                <span className="absolute right-1 top-1 flex min-h-[14px] min-w-[14px] items-center justify-center rounded-full bg-[#fa5151] px-0.5 text-[9px] font-semibold leading-none text-white">
                  <MomentsSerifNumericText
                    text={interactionUnreadCount > 99 ? '99+' : String(interactionUnreadCount)}
                  />
                </span>
              ) : null}
            </motion.button>
          ) : null}
          {onOpenSettings ? (
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              onClick={onOpenSettings}
              className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${actionBtnClass}`}
              aria-label="朋友圈设置"
            >
              <SlidersHorizontal className="size-4" strokeWidth={1.75} />
            </motion.button>
          ) : null}
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            onClick={goToPublish}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-full ${actionBtnClass}`}
            aria-label="发布"
          >
            <Camera className="size-4" />
          </motion.button>
        </div>
        </div>
      </div>
    </div>
  )
}
