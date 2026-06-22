import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, useRef } from 'react'

import { requestOpenWeChatPersonaChat } from '../../phone/apps/wechat/wechatFocusChatNavigation'
import {
  normalizeListenTogetherToast,
  type ListenTogetherToastInput,
} from './listenShareToast'

export const LISTEN_TOGETHER_TOAST_MS = 2200
export const LISTEN_TOGETHER_TOAST_WITH_ACTION_MS = 5600
/** @deprecated 使用 LISTEN_TOGETHER_TOAST_MS */
export const PLAY_MODE_TOAST_MS = LISTEN_TOGETHER_TOAST_MS

type Props = {
  message: ListenTogetherToastInput | null
  onClear: () => void
}

/** 听一听通用临时提示：屏幕居中；分享/共听成功时可选择跳转私聊 */
export function ListenTogetherActionToast({ message, onClear }: Props) {
  const onClearRef = useRef(onClear)
  onClearRef.current = onClear

  const payload = message ? normalizeListenTogetherToast(message) : null
  const chatCharacterId = payload?.chatCharacterId?.trim()
  const hasChatAction = Boolean(chatCharacterId)

  useEffect(() => {
    if (!message) return
    const ms = hasChatAction ? LISTEN_TOGETHER_TOAST_WITH_ACTION_MS : LISTEN_TOGETHER_TOAST_MS
    const timer = window.setTimeout(() => onClearRef.current(), ms)
    return () => window.clearTimeout(timer)
  }, [message, hasChatAction])

  const handleOpenChat = () => {
    if (chatCharacterId) requestOpenWeChatPersonaChat(chatCharacterId)
    onClearRef.current()
  }

  return (
    <AnimatePresence>
      {payload ? (
        <motion.div
          key={`${payload.message}:${chatCharacterId ?? ''}`}
          role="status"
          aria-live="polite"
          initial={{ opacity: 0, scale: 0.92, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -6 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          className={`fixed inset-0 z-[10035] flex items-center justify-center px-6 ${
            hasChatAction ? 'pointer-events-auto' : 'pointer-events-none'
          }`}
        >
          <div className="max-w-[min(88vw,20rem)] rounded-2xl bg-[#2D2422]/92 px-5 py-3 text-center text-[13px] font-medium tracking-wide text-white shadow-lg backdrop-blur-sm">
            <p>{payload.message}</p>
            {hasChatAction ? (
              <button
                type="button"
                onClick={handleOpenChat}
                className="mt-2.5 inline-flex min-h-9 items-center justify-center rounded-full bg-white/95 px-4 text-[12px] font-semibold text-[#2D2422] transition-transform active:scale-[0.98]"
              >
                {payload.chatActionLabel?.trim() || '去聊天'}
              </button>
            ) : null}
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
