import { AnimatePresence, motion } from 'framer-motion'
import { useEffect } from 'react'
import { Pressable } from '../../../../components/Pressable'
import { useSimulatorStore } from '../useSimulatorStore'
import { SimNum } from './SimNum'

const AUTO_DISMISS_MS = 3200

export function NewDayNoticeBar() {
  const notice = useSimulatorStore((s) => s.newDayNotice)
  const dismiss = useSimulatorStore((s) => s.dismissNewDayNotice)

  useEffect(() => {
    if (!notice) return
    const timer = window.setTimeout(dismiss, AUTO_DISMISS_MS)
    return () => window.clearTimeout(timer)
  }, [notice, dismiss])

  return (
    <AnimatePresence>
      {notice ? (
        <motion.div
          key={`${notice.gameYear}-${notice.gameMonth}-${notice.gameDay}`}
          initial={{ opacity: 0, y: -10, height: 0 }}
          animate={{ opacity: 1, y: 0, height: 'auto' }}
          exit={{ opacity: 0, y: -6, height: 0 }}
          transition={{ duration: 0.28, ease: [0.32, 0.72, 0, 1] }}
          className="relative z-[85] shrink-0 overflow-hidden px-4 pb-2 pt-1"
          aria-live="polite"
        >
          <Pressable
            onClick={dismiss}
            className="sm-new-day-notice flex w-full items-center justify-between gap-3 px-4 py-2.5"
            aria-label="关闭通知"
          >
            <div className="min-w-0 flex-1">
              <p className="sm-serif text-[13px] font-semibold text-rose-700">新的一天</p>
              <p className="mt-0.5 text-[12px] text-stone-600">
                第<SimNum>{notice.gameYear}</SimNum>年 · {notice.season} ·{' '}
                <SimNum>{notice.gameMonth}</SimNum>月<SimNum>{notice.gameDay}</SimNum>日 · 行动次数已重置
              </p>
            </div>
            <span className="shrink-0 text-[11px] text-rose-400/80">点击关闭</span>
          </Pressable>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
