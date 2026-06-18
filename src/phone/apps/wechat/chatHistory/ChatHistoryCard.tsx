import { motion } from 'framer-motion'

import type { WeChatChatHistoryPayload } from '../newFriendsPersona/types'
import { chatHistoryPreviewLines } from './buildChatHistoryPayload'
import { useChatHistoryMaskedView } from './useChatHistoryMaskedView'
import type { WeChatPersonaContact } from '../../../types'

const CARD_MOTION = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.42, ease: [0.22, 1, 0.36, 1] as const },
}

type Props = {
  data: WeChatChatHistoryPayload
  onOpen?: () => void
  recipientCharacterId?: string
  userDisplayName?: string
  personaContacts?: readonly WeChatPersonaContact[]
  cardSenderCharacterId?: string
}

/** 聊天流 · 合并转发聊天记录卡片 */
export function ChatHistoryCard({
  data,
  onOpen,
  recipientCharacterId,
  userDisplayName,
  personaContacts,
  cardSenderCharacterId,
}: Props) {
  const masked = useChatHistoryMaskedView(data, {
    recipientCharacterId,
    userDisplayName,
    personaContacts,
    cardSenderCharacterId,
  })
  const title = masked.title.trim() || '聊天记录'
  const previewLines = chatHistoryPreviewLines(masked, 4)

  return (
    <motion.button
      type="button"
      onClick={onOpen}
      className="w-[min(280px,calc(100vw-120px))] overflow-hidden rounded-[14px] border border-gray-200/60 bg-gray-50 text-left shadow-[0_2px_16px_rgba(0,0,0,0.03)]"
      {...CARD_MOTION}
    >
      <div className="px-4 py-3.5">
        <p className="text-[9px] font-medium uppercase tracking-[0.22em] text-gray-400">CHAT HISTORY</p>
        <p className="mt-1.5 text-[13px] font-light text-gray-900">{title}</p>

        <div className="mt-2.5 space-y-1">
          {previewLines.length ? (
            previewLines.map((line, idx) => (
              <p key={idx} className="truncate text-[10px] leading-relaxed text-gray-500">
                {line}
              </p>
            ))
          ) : (
            <p className="text-[10px] text-gray-400">暂无摘要</p>
          )}
        </div>

        <div className="mt-3 border-t border-gray-200/50 pt-2.5">
          <p className="text-[10px] tracking-wide text-gray-400">点击查看完整记录 (Tap to view full history)</p>
        </div>
      </div>
    </motion.button>
  )
}
