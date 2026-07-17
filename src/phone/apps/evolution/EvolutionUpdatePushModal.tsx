import { AnimatePresence, motion } from 'framer-motion'
import { ArrowRight } from 'lucide-react'
import {
  dismissEvolutionPushForToday,
  dismissEvolutionPushThisSession,
} from './evolutionPushStorage'
import { getLatestEvolutionRecord } from './evolutionLogData'

type Props = {
  open: boolean
  onClose: () => void
  onOpenEvolution: () => void
}

export function EvolutionUpdatePushModal({ open, onClose, onOpenEvolution }: Props) {
  const latest = getLatestEvolutionRecord()
  const version = latest.version

  const handleView = () => {
    dismissEvolutionPushThisSession(version)
    onClose()
    onOpenEvolution()
  }

  const handleCloseSession = () => {
    dismissEvolutionPushThisSession(version)
    onClose()
  }

  const handleCloseToday = () => {
    dismissEvolutionPushForToday(version)
    dismissEvolutionPushThisSession(version)
    onClose()
  }

  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-[10002] flex items-center justify-center px-5 py-6 sm:px-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          role="dialog"
          aria-modal="true"
          aria-label="系统更新推送"
        >
          <div className="absolute inset-0 bg-black/45 backdrop-blur-[3px]" />
          <motion.div
            className="relative w-full max-w-[400px] overflow-hidden rounded-[22px] border border-black/10 bg-white text-[#1C1C1E] shadow-[0_24px_60px_rgba(28,28,30,0.22)]"
            initial={{ y: 16, scale: 0.97, opacity: 0 }}
            animate={{ y: 0, scale: 1, opacity: 1 }}
            exit={{ y: 10, scale: 0.99, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="border-b border-gray-100 bg-[#FAFAFA] px-5 py-5 sm:px-6">
              <p className="text-[10px] font-medium uppercase tracking-[0.28em] text-gray-400">
                System Update
              </p>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className="font-mono text-[32px] font-light leading-none tracking-tight text-[#1C1C1E]">
                  {latest.version}
                </p>
                <span className="mb-1 shrink-0 font-mono text-[11px] text-gray-400">
                  {latest.date}
                </span>
              </div>
              <h2 className="mt-3 font-serif text-[17px] font-semibold leading-snug tracking-wide text-[#1C1C1E]">
                {latest.title}
              </h2>
            </div>

            <div className="px-5 py-5 sm:px-6">
              <p className="text-[13px] leading-relaxed text-[#1C1C1E]/65 sm:text-[14px]">
                账号检测已完成。本版有新的系统演进内容，可前往「系统演进录」查看新增、优化与修复明细。
              </p>

              <button
                type="button"
                onClick={handleView}
                className="mt-5 flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-[#1C1C1E] text-[14px] font-medium text-white shadow-[0_12px_28px_rgba(28,28,30,0.2)] transition active:scale-[0.99]"
              >
                查看更新日志
                <ArrowRight className="size-4" strokeWidth={1.75} />
              </button>

              <div className="mt-3 grid grid-cols-2 gap-2.5">
                <button
                  type="button"
                  onClick={handleCloseToday}
                  className="h-10 rounded-[12px] border border-gray-200 bg-[#F9FAFB] text-[13px] font-medium text-[#1C1C1E]/75 transition hover:bg-gray-100"
                >
                  今日关闭
                </button>
                <button
                  type="button"
                  onClick={handleCloseSession}
                  className="h-10 rounded-[12px] border border-transparent text-[13px] font-medium text-gray-400 transition hover:text-[#1C1C1E]/70"
                >
                  关闭
                </button>
              </div>
              <p className="mt-3 text-center text-[11px] leading-relaxed text-gray-400">
                「关闭」仅本次；刷新网页后仍会提醒。选「今日关闭」则今天不再弹出。
              </p>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
