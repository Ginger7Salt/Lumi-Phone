import { AnimatePresence, motion } from 'framer-motion'
import { ChevronLeft } from 'lucide-react'
import { useMemo } from 'react'

import { ListenNumericText } from '../../../../components/discoverListen/ListenNum'
import type { WeChatPersonaContact } from '../../../types'
import type { WeChatChatHistoryPayload } from '../newFriendsPersona/types'
import { chatHistoryMessageBlockSpacing, chatHistoryShowSenderHeader } from './chatHistoryViewerLayout'
import { formatChatHistoryDateRange } from './formatChatHistoryDateRange'
import { ChatHistoryMessageContent } from './ChatHistoryMessageContent'
import { useChatHistoryMaskedView } from './useChatHistoryMaskedView'
import { useChatHistorySenderLabels } from './useChatHistorySenderLabels'

type Props = {
  open: boolean
  data: WeChatChatHistoryPayload | null
  onClose: () => void
  participantAvatars?: Record<string, string | undefined>
  avatarRadiusPx?: number
  recipientCharacterId?: string
  userDisplayName?: string
  personaContacts?: readonly WeChatPersonaContact[]
  cardSenderCharacterId?: string
}

function formatHistoryTime(ts?: number): string {
  if (!ts || !Number.isFinite(ts)) return ''
  const d = new Date(ts)
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

function HistoryAvatar({
  url,
  radiusPx,
}: {
  url?: string
  radiusPx: number
}) {
  if (url?.trim()) {
    return (
      <img
        src={url.trim()}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 object-cover"
        style={{
          borderRadius: `${radiusPx}px`,
          border: '1px solid rgba(0,0,0,0.06)',
        }}
      />
    )
  }
  return (
    <div
      className="h-10 w-10 shrink-0"
      style={{ borderRadius: `${radiusPx}px`, background: 'rgba(0,0,0,0.06)', border: '1px solid rgba(0,0,0,0.06)' }}
      aria-hidden
    />
  )
}

function HistorySenderName({
  label,
  fallbackName,
}: {
  label?: { remarkName: string; wechatNickname?: string }
  fallbackName: string
}) {
  const remark = label?.remarkName.trim() || fallbackName
  const nick = label?.wechatNickname?.trim()
  return (
    <span className="min-w-0 truncate">
      <span className="text-[11px] text-gray-400">{remark}</span>
      {nick && nick !== remark ? <span className="ml-1.5 text-[10px] text-gray-300">{nick}</span> : null}
    </span>
  )
}

function HistorySenderMetaRow({
  visible,
  label,
  fallbackName,
  timeLabel,
}: {
  visible: boolean
  label?: { remarkName: string; wechatNickname?: string }
  fallbackName: string
  timeLabel: string
}) {
  return (
    <div
      className="flex min-h-[17px] items-baseline justify-between gap-3 pb-1"
      aria-hidden={!visible}
    >
      {visible ? (
        <>
          <HistorySenderName label={label} fallbackName={fallbackName} />
          {timeLabel ? (
            <span className="shrink-0 text-[10px] text-gray-300">
              <ListenNumericText text={timeLabel} />
            </span>
          ) : (
            <span className="shrink-0 text-[10px] opacity-0" aria-hidden>
              00:00
            </span>
          )}
        </>
      ) : null}
    </div>
  )
}

/** 全屏 · 合并转发聊天记录阅读器 */
export function ChatHistoryViewer({
  open,
  data,
  onClose,
  participantAvatars = {},
  avatarRadiusPx = 8,
  recipientCharacterId,
  userDisplayName,
  personaContacts,
  cardSenderCharacterId,
}: Props) {
  const masked = useChatHistoryMaskedView(data ?? { kind: 'chat_history', title: '', messages: [] }, {
    recipientCharacterId,
    userDisplayName,
    personaContacts,
    cardSenderCharacterId,
  })
  const title = masked.title.trim() || '聊天记录'
  const messages = masked.messages ?? []
  const dateRangeLabel = useMemo(() => formatChatHistoryDateRange(messages), [messages])
  const senderLabels = useChatHistorySenderLabels(messages, {
    userDisplayName,
    personaContacts,
    cardSenderCharacterId,
  })

  const rows = useMemo(() => {
    const rawMessages = data?.messages ?? []
    return messages.map((m, idx) => {
      const name = m.senderName.trim() || '未知'
      const origName = rawMessages[idx]?.senderName.trim()
      const rawRow = rawMessages[idx]
      const showHeader = chatHistoryShowSenderHeader(messages, idx)
      return {
        m,
        idx,
        showHeader,
        avatarUrl:
          rawRow?.senderAvatarUrl?.trim() ||
          participantAvatars[name] ||
          (origName ? participantAvatars[origName] : undefined),
      }
    })
  }, [messages, data?.messages, participantAvatars])

  return (
    <AnimatePresence>
      {open && data ? (
        <motion.div
          className="absolute inset-0 z-[270] flex flex-col bg-white"
          initial={{ y: '100%' }}
          animate={{ y: 0 }}
          exit={{ y: '100%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 34 }}
        >
          <div
            className="flex shrink-0 flex-col border-b border-gray-100"
            style={{ paddingTop: 'max(10px, env(safe-area-inset-top))' }}
          >
            <div className="flex items-center px-2 pb-1">
              <button
                type="button"
                aria-label="返回"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full text-gray-900 active:bg-gray-50"
              >
                <ChevronLeft className="size-5" strokeWidth={1.75} />
              </button>
              <h1 className="min-w-0 flex-1 truncate pr-10 text-center text-[15px] font-light text-gray-900">
                {title}
              </h1>
            </div>
            {dateRangeLabel ? (
              <p className="pb-2.5 text-center text-[11px] text-gray-400">
                <ListenNumericText text={dateRangeLabel} />
              </p>
            ) : (
              <div className="pb-2" aria-hidden />
            )}
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto py-4" style={{ filter: 'sepia(0.02)' }}>
            <ul>
              {rows.map(({ m, idx, showHeader, avatarUrl }) => {
                const name = m.senderName.trim() || '未知'
                const timeLabel = showHeader ? formatHistoryTime(m.timestamp) : ''
                const senderLabel = senderLabels.get(name)
                const isCharacterForgedView = !!cardSenderCharacterId?.trim()
                const isSelf =
                  !isCharacterForgedView &&
                  (m.senderKind === 'player' ||
                    (!m.senderKind &&
                      !!userDisplayName?.trim() &&
                      (name === userDisplayName.trim() || name === '我')))
                return (
                  <li
                    key={`${name}-${idx}`}
                    className={chatHistoryMessageBlockSpacing(messages, idx)}
                  >
                    <div className="ml-[24px] mr-[24px] flex max-w-full flex-row items-start gap-[12px]">
                      {showHeader ? (
                        <HistoryAvatar url={avatarUrl} radiusPx={avatarRadiusPx} />
                      ) : (
                        <div className="h-10 w-10 shrink-0" aria-hidden />
                      )}
                      <div className="min-w-0 flex-1">
                        <HistorySenderMetaRow
                          visible={showHeader}
                          label={senderLabel}
                          fallbackName={name}
                          timeLabel={timeLabel}
                        />
                        <ChatHistoryMessageContent message={m} isSelf={isSelf} />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  )
}
