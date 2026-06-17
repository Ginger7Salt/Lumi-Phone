import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  WECHAT_MEMORY_SUMMARY_RESULT_EVENT,
  memorySummaryRetryKindLabel,
  type WechatMemorySummaryResultDetail,
} from './wechatMemorySummaryResultEvents'

const AUTO_DISMISS_MS = 3800

/** 监听合并自动总结成功/失败，居中展示临时提示 */
export function WechatMemorySummaryToastHost() {
  const [detail, setDetail] = useState<WechatMemorySummaryResultDetail | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const onResult = (e: Event) => {
      const ce = e as CustomEvent<WechatMemorySummaryResultDetail>
      if (!ce.detail) return
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      setDetail(ce.detail)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        setDetail(null)
      }, AUTO_DISMISS_MS)
    }
    window.addEventListener(WECHAT_MEMORY_SUMMARY_RESULT_EVENT, onResult as EventListener)
    return () => {
      window.removeEventListener(WECHAT_MEMORY_SUMMARY_RESULT_EVENT, onResult as EventListener)
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  if (typeof document === 'undefined') return null

  const name = detail?.displayName?.trim() || '对方'
  const kindLabel = detail ? memorySummaryRetryKindLabel(detail.kind) : ''
  const ok = detail?.ok === true

  return createPortal(
    <AnimatePresence>
      {detail ? (
        <motion.div
          key="wechat-memory-summary-result"
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-[10055] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className={`max-w-[min(100vw-3rem,360px)] rounded-[14px] px-5 py-4 text-center shadow-lg ${
              ok ? 'bg-black/90 text-white' : 'bg-white text-gray-900 ring-1 ring-rose-200/80'
            }`}
          >
            <p
              className={`text-[11px] font-medium uppercase tracking-[0.2em] ${
                ok ? 'text-white/55' : 'text-rose-500/80'
              }`}
            >
              {ok ? '记忆总结 · 已写入' : '记忆总结 · 未完成'}
            </p>
            <p className="mt-2 text-[14px] font-medium leading-relaxed">
              {ok
                ? `已为「${name}」写入${kindLabel}长期记忆`
                : `「${name}」的${kindLabel}总结未写入长期记忆`}
            </p>
            {!ok ? (
              <p className="mt-2 text-[12px] leading-relaxed text-gray-500">
                {detail.failureReason?.trim() || '请打开记忆档案馆 · 待补总结 手动补跑'}
              </p>
            ) : null}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
