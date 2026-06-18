import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { formatLinkPreviewQuotaToastMessage } from '../../api/linkPreviewQuota'
import {
  LINK_PREVIEW_FAILURE_TOAST_EVENT,
  LINK_PREVIEW_QUOTA_TOAST_EVENT,
  type LinkPreviewFailureToastDetail,
  type LinkPreviewQuotaToastDetail,
} from '../../api/linkPreviewQuotaEvents'
import {
  LINK_PREVIEW_ACTION_LABEL,
  LINK_PREVIEW_FEATURE_TITLE,
  LINK_PREVIEW_TOAST_HEADER,
} from '../../api/linkPreviewDisplayLabels'

const AUTO_DISMISS_MS = 3200
const FAILURE_DISMISS_MS = 5200

type ToastState =
  | { kind: 'quota'; detail: LinkPreviewQuotaToastDetail }
  | { kind: 'failure'; message: string }

/** 聊天中链接解析消耗额度或失败时，居中展示提示 */
export function LinkPreviewQuotaToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    const onQuotaToast = (e: Event) => {
      try {
        const ce = e as CustomEvent<LinkPreviewQuotaToastDetail>
        if (!ce.detail?.snapshot?.lines?.length) return
        if (timerRef.current != null) window.clearTimeout(timerRef.current)
        setToast({ kind: 'quota', detail: ce.detail })
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null
          setToast(null)
        }, AUTO_DISMISS_MS)
      } catch {
        // ignore malformed toast payloads
      }
    }
    const onFailureToast = (e: Event) => {
      try {
        const ce = e as CustomEvent<LinkPreviewFailureToastDetail>
        const message = ce.detail?.message?.trim()
        if (!message) return
        if (timerRef.current != null) window.clearTimeout(timerRef.current)
        setToast({ kind: 'failure', message })
        timerRef.current = window.setTimeout(() => {
          timerRef.current = null
          setToast(null)
        }, FAILURE_DISMISS_MS)
      } catch {
        // ignore malformed toast payloads
      }
    }
    window.addEventListener(LINK_PREVIEW_QUOTA_TOAST_EVENT, onQuotaToast as EventListener)
    window.addEventListener(LINK_PREVIEW_FAILURE_TOAST_EVENT, onFailureToast as EventListener)
    return () => {
      window.removeEventListener(LINK_PREVIEW_QUOTA_TOAST_EVENT, onQuotaToast as EventListener)
      window.removeEventListener(LINK_PREVIEW_FAILURE_TOAST_EVENT, onFailureToast as EventListener)
      if (timerRef.current != null) window.clearTimeout(timerRef.current)
    }
  }, [])

  if (typeof document === 'undefined') return null

  let message = ''
  let subtitle = '按本设备统计，命中缓存或跨设备调用不计入此处'
  try {
    if (toast?.kind === 'quota') {
      message = formatLinkPreviewQuotaToastMessage(toast.detail.consumed, toast.detail.snapshot)
    } else if (toast?.kind === 'failure') {
      message = toast.message
      subtitle = `识别失败时角色会请截图或正文，并非未开启${LINK_PREVIEW_FEATURE_TITLE}`
    }
  } catch {
    message = toast ? `${LINK_PREVIEW_ACTION_LABEL}完成` : ''
  }

  return createPortal(
    <AnimatePresence>
      {toast ? (
        <motion.div
          key="link-preview-toast"
          role="status"
          aria-live="polite"
          className="pointer-events-none fixed inset-0 z-[10054] flex items-center justify-center px-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
            className="max-w-[min(100vw-3rem,360px)] rounded-[14px] bg-black/88 px-5 py-4 text-center text-white shadow-lg"
          >
            <p className="text-[11px] font-medium uppercase tracking-[0.18em] text-white/55">
              {toast.kind === 'failure' ? `${LINK_PREVIEW_ACTION_LABEL}失败` : LINK_PREVIEW_TOAST_HEADER}
            </p>
            <p className="mt-2 text-[14px] font-medium leading-relaxed">{message}</p>
            <p className="mt-2 text-[11px] leading-relaxed text-white/50">{subtitle}</p>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>,
    document.body,
  )
}
