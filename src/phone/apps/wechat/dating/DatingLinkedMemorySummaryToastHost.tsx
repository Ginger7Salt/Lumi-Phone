import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  DATING_LINKED_MEMORY_SUMMARY_SUCCESS_EVENT,
  type DatingLinkedMemorySummarySuccessDetail,
} from './datingLinkedMemorySummarySuccessEvents'

const AUTO_DISMISS_MS = 3400

function formatNpcList(names: string[]): string {
  if (names.length <= 2) return names.map((n) => `「${n}」`).join('、')
  return `「${names[0]}」等 ${names.length} 位人脉`
}

/** 监听线下剧情关联记忆写入成功，居中弹窗提醒 */
export function DatingLinkedMemorySummaryToastHost() {
  const [message, setMessage] = useState<string | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const onSuccess = (e: Event) => {
      const ce = e as CustomEvent<DatingLinkedMemorySummarySuccessDetail>
      const names = (ce.detail?.npcNames ?? []).map((n) => String(n).trim()).filter(Boolean)
      if (!names.length) return
      const hero = ce.detail?.protagonistName?.trim()
      const npcPart = formatNpcList(names)
      const msg = hero
        ? `已为 ${npcPart} 写入关联记忆（来自与「${hero}」的线下剧情）`
        : `已为 ${npcPart} 写入关联记忆（来自线下剧情）`
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
      setMessage(msg)
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null
        setMessage(null)
      }, AUTO_DISMISS_MS)
    }
    window.addEventListener(
      DATING_LINKED_MEMORY_SUMMARY_SUCCESS_EVENT,
      onSuccess as EventListener,
    )
    return () => {
      window.removeEventListener(
        DATING_LINKED_MEMORY_SUMMARY_SUCCESS_EVENT,
        onSuccess as EventListener,
      )
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  if (typeof document === 'undefined') return null

  return createPortal(
    <AnimatePresence>
      {message ? (
        <motion.div
          key="dating-linked-memory-summary-success"
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-[10050] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="max-w-[min(100vw-3rem,360px)] rounded-[14px] bg-black/90 px-5 py-4 text-center text-white shadow-lg"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-white/55">
              关联记忆 · 已写入
            </p>
            <p className="mt-2 text-[14px] font-medium leading-relaxed">{message}</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
