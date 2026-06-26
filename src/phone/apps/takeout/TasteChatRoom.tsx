import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { useCustomization } from '../../CustomizationContext'
import { formatTasteOrderTime } from './tasteOrderBridge'
import { isCharacterCourierChatUnlocked } from './tasteDeliveryTracking'
import {
  generateCharacterObserverChatHistory,
  isCharacterObserverChatKind,
  resolvePeerMessageAvatar,
  sendTasteChatMessage,
} from './tasteChatService'
import { readTasteChatThread, useTasteChatMessages } from './tasteChatStore'
import { TasteChatAvatar } from './TasteChatAvatar'
import { tasteNumStyle } from './tasteTypography'
import type { TasteChatMessage, TasteChatThread, TasteOrderPayload } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'
const AVATAR_RADIUS = 6

function sameSenderBlock(a: TasteChatMessage, b: TasteChatMessage): boolean {
  if (a.from !== b.from) return false
  if (a.from === 'user' || a.from === 'character') return true
  return (a.senderName ?? '').trim() === (b.senderName ?? '').trim()
}

function measureBubbleSingleLine(el: HTMLElement): boolean {
  const cs = getComputedStyle(el)
  const pt = parseFloat(cs.paddingTop) || 0
  const pb = parseFloat(cs.paddingBottom) || 0
  let lh = parseFloat(cs.lineHeight)
  if (!Number.isFinite(lh) || lh <= 0) {
    const fs = parseFloat(cs.fontSize) || 15
    lh = fs * 1.45
  }
  const textBlockHeight = el.scrollHeight - pt - pb
  return textBlockHeight <= lh * 1.35 + 0.5
}

function useBubbleSingleLine(text: string) {
  const ref = useRef<HTMLDivElement>(null)
  const [singleLine, setSingleLine] = useState(false)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const node = ref.current
      if (!node) return
      const next = measureBubbleSingleLine(node)
      setSingleLine((prev) => (prev === next ? prev : next))
    }
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [text])
  return { ref, singleLine }
}

function TasteChatBubbleRow({
  isRightSide,
  text,
  showAvatarVisual,
  avatarUrl,
  avatarFallback,
  showGroupNick,
  senderName,
}: {
  isRightSide: boolean
  text: string
  showAvatarVisual: boolean
  avatarUrl?: string
  avatarFallback: string
  showGroupNick: boolean
  senderName?: string
}) {
  const { ref: bubbleRef, singleLine } = useBubbleSingleLine(text)
  const rowAlign = singleLine ? 'items-center' : 'items-start'
  const peerRowAlign = showGroupNick ? 'items-start' : rowAlign

  const bubble = (
    <div
      ref={bubbleRef}
      className={`max-w-[min(260px,calc(100vw-24px-24px-40px-12px-16px))] rounded-[6px] px-3 py-2 text-[15px] leading-[1.45] ${
        isRightSide
          ? 'bg-[#1C1C1E] text-white'
          : 'border border-gray-100 bg-white text-[#1C1C1E] shadow-[0_1px_2px_rgba(0,0,0,0.04)]'
      }`}
    >
      {text}
    </div>
  )

  if (isRightSide) {
    return (
      <div className="flex w-full shrink-0 justify-end overflow-x-visible">
        <div className={`mr-[24px] ml-auto flex max-w-full flex-row ${rowAlign} gap-[12px]`}>
          {bubble}
          <ChatBubbleAvatar url={avatarUrl} fallback={avatarFallback} visible={showAvatarVisual} />
        </div>
      </div>
    )
  }

  return (
    <div className="w-full max-w-full shrink-0 overflow-x-visible">
      <div className={`ml-[24px] mr-auto flex max-w-full flex-row gap-[12px] ${peerRowAlign}`}>
        <ChatBubbleAvatar url={avatarUrl} fallback={avatarFallback} visible={showAvatarVisual} />
        <div className="flex min-w-0 flex-1 flex-col items-start gap-[3px]">
          {showGroupNick && senderName?.trim() ? (
            <span className="max-w-[min(200px,calc(100vw-24px-24px-40px-12px))] truncate text-[11px] leading-snug text-neutral-500">
              {senderName}
            </span>
          ) : null}
          {bubble}
        </div>
      </div>
    </div>
  )
}

function ChatBubbleAvatar({
  url,
  fallback,
  visible,
}: {
  url?: string
  fallback: string
  visible: boolean
}) {
  if (!visible) {
    return <div className="h-10 w-10 shrink-0" aria-hidden />
  }
  if (url) {
    return (
      <img
        src={url}
        alt=""
        width={40}
        height={40}
        className="h-10 w-10 shrink-0 object-cover"
        style={{
          borderRadius: AVATAR_RADIUS,
          border: '1px solid rgba(0,0,0,0.08)',
        }}
        draggable={false}
      />
    )
  }
  return (
    <div
      className="flex h-10 w-10 shrink-0 items-center justify-center text-[13px] text-neutral-500"
      style={{
        borderRadius: AVATAR_RADIUS,
        background: 'rgba(0,0,0,0.06)',
        border: '1px solid rgba(0,0,0,0.08)',
        fontFamily: SERIF,
      }}
      aria-hidden
    >
      {fallback.slice(0, 1)}
    </div>
  )
}

export function TasteChatRoom({
  thread,
  order,
  accountId,
  onBack,
  characterName,
  characterAvatarUrl,
  deliveryMinutes = 35,
  onToast,
}: {
  thread: TasteChatThread
  order: TasteOrderPayload
  accountId: string
  onBack: () => void
  characterName?: string
  characterAvatarUrl?: string
  deliveryMinutes?: number
  onToast?: (msg: string) => void
}) {
  const { state } = useCustomization()
  const messages = useTasteChatMessages(accountId, thread.id)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [threadMeta, setThreadMeta] = useState(thread)
  const scrollRef = useRef<HTMLDivElement>(null)
  const playerName = state.profile.displayName?.trim() || '我'
  const playerAvatar = state.profile.avatarImageUrl?.trim()

  const isObserver = isCharacterObserverChatKind(thread.kind)
  const charLabel = characterName?.trim() || thread.characterObserverName?.trim() || 'TA'
  const courierUnlocked = isCharacterCourierChatUnlocked(order, deliveryMinutes)
  const canGenerate =
    isObserver &&
    (thread.kind === 'character-merchant' || (thread.kind === 'character-courier' && courierUnlocked))

  useEffect(() => {
    setThreadMeta(thread)
  }, [thread])

  useEffect(() => {
    const stored = readTasteChatThread(accountId, thread.id)
    if (stored) setThreadMeta(stored)
  }, [accountId, messages.length, thread.id])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages.length, thread.id])

  const subtitle = useMemo(() => {
    if (isObserver) return `仅查看 · ${thread.subtitle}`
    if (thread.kind === 'group') return '商家 · 配送专员 · 您'
    return thread.subtitle
  }, [isObserver, thread.kind, thread.subtitle])

  const submit = useCallback(() => {
    const text = draft.trim()
    if (!text || sending || isObserver) return
    setSending(true)
    sendTasteChatMessage({ accountId, order, threadId: thread.id, text })
    setDraft('')
    window.setTimeout(() => setSending(false), 400)
  }, [accountId, draft, isObserver, order, sending, thread.id])

  const handleGenerate = useCallback(async () => {
    if (!canGenerate || generating) return
    if (thread.kind === 'character-courier' && !courierUnlocked) {
      onToast?.('骑手开始配送或送达后可查看')
      return
    }
    if (thread.kind !== 'character-merchant' && thread.kind !== 'character-courier') return
    setGenerating(true)
    try {
      await generateCharacterObserverChatHistory({
        accountId,
        order,
        kind: thread.kind,
        characterName: charLabel,
      })
      const stored = readTasteChatThread(accountId, thread.id)
      if (stored) setThreadMeta(stored)
      onToast?.(threadMeta.characterHistoryGenerated ? '已重新生成' : '聊天记录已生成')
    } catch (err) {
      const msg = err instanceof Error ? err.message : '生成失败，请重试'
      onToast?.(msg)
    } finally {
      window.setTimeout(() => setGenerating(false), 320)
    }
  }, [
    accountId,
    canGenerate,
    charLabel,
    courierUnlocked,
    generating,
    onToast,
    order,
    thread.id,
    thread.kind,
    threadMeta.characterHistoryGenerated,
  ])

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[#FAFAFA]/95">
      <header
        className="flex shrink-0 items-center gap-2 border-b border-gray-100/90 bg-white/90 px-4 py-3 backdrop-blur-md"
        style={{ paddingTop: 'max(8px, env(safe-area-inset-top, 0px))' }}
      >
        <Pressable type="button" onClick={onBack} className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#1C1C1E]" aria-label="返回">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35">
            <path d="M15 18l-6-6 6-6" strokeLinecap="round" />
          </svg>
        </Pressable>
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <TasteChatAvatar thread={thread} size="sm" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-medium text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
              {thread.title}
            </p>
            <p className="truncate text-[10px] text-neutral-400">{subtitle}</p>
          </div>
        </div>
        {isObserver ? (
          <Pressable
            type="button"
            onClick={() => void handleGenerate()}
            disabled={!canGenerate || generating}
            className="shrink-0 rounded-full border border-gray-200 bg-white px-2.5 py-1.5 text-[10px] tracking-[0.04em] text-[#1C1C1E] disabled:border-gray-100 disabled:text-neutral-300"
          >
            {generating ? 'AI 生成中…' : threadMeta.characterHistoryGenerated ? '重新生成' : 'AI 生成记录'}
          </Pressable>
        ) : null}
      </header>

      <div className="shrink-0 border-b border-gray-50 bg-white/70 px-4 py-2.5">
        <p className="text-[10px] text-neutral-400" style={tasteNumStyle}>
          {formatTasteOrderTime(order.placedAt)}
        </p>
        {isObserver && thread.kind === 'character-courier' && !courierUnlocked ? (
          <p className="mt-1 text-[10px] text-amber-700/90">骑手开始配送或送达后可查看沟通记录</p>
        ) : null}
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-2 overflow-y-auto py-3">
        {messages.length === 0 && isObserver ? (
          <div className="px-6 py-10 text-center">
            <p className="text-[13px] text-neutral-500" style={{ fontFamily: SERIF }}>
              {generating
                ? 'AI 正在还原角色沟通记录…'
                : canGenerate
                  ? '点击右上角「AI 生成记录」查看'
                  : '配送进度推进后将解锁记录'}
            </p>
            <p className="mt-2 text-[11px] leading-relaxed text-neutral-400">
              {thread.kind === 'character-merchant'
                ? '还原角色下单后与商家的确认沟通'
                : '还原角色与配送专员的对话'}
            </p>
            {canGenerate && !generating ? (
              <Pressable
                type="button"
                onClick={() => void handleGenerate()}
                className="mx-auto mt-5 border border-[#1C1C1E] bg-[#1C1C1E] px-5 py-2 text-[11px] tracking-[0.08em] text-white"
              >
                AI 生成记录
              </Pressable>
            ) : null}
          </div>
        ) : null}
        {messages.map((m, index) => {
          const isRightSide = m.from === 'user' || m.from === 'character'
          const prev = index > 0 ? messages[index - 1] : null
          const inBlock = prev ? sameSenderBlock(prev, m) : false
          const showAvatarVisual = !inBlock
          const peerAvatar = resolvePeerMessageAvatar(order, thread, m)
          const avatarUrl = isRightSide
            ? m.from === 'character'
              ? characterAvatarUrl
              : playerAvatar
            : peerAvatar
          const avatarFallback = isRightSide
            ? m.from === 'character'
              ? charLabel
              : playerName
            : m.senderName ?? thread.title
          const showGroupNick =
            !isRightSide && thread.kind === 'group' && showAvatarVisual && Boolean(m.senderName?.trim())

          return (
            <TasteChatBubbleRow
              key={m.id}
              isRightSide={isRightSide}
              text={m.text}
              showAvatarVisual={showAvatarVisual}
              avatarUrl={avatarUrl}
              avatarFallback={avatarFallback}
              showGroupNick={showGroupNick}
              senderName={m.senderName}
            />
          )
        })}
      </div>

      {isObserver ? (
        <div
          className="shrink-0 border-t border-gray-100 bg-[#FAFAFA] px-4 py-3 text-center"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
        >
          <p className="text-[11px] text-neutral-400">此为 {charLabel} 的聊天记录，仅供查看</p>
        </div>
      ) : (
        <div
          className="shrink-0 border-t border-gray-100 bg-white/92 px-4 py-3 backdrop-blur-md"
          style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom, 0px))' }}
        >
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="输入消息…"
              rows={1}
              className="max-h-24 min-h-[42px] flex-1 resize-none rounded-xl border border-gray-100 bg-[#FAFAFA] px-3 py-2.5 text-[14px] text-[#1C1C1E] outline-none placeholder:text-neutral-300"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  submit()
                }
              }}
            />
            <Pressable
              type="button"
              onClick={submit}
              disabled={!draft.trim() || sending}
              className="flex h-[42px] shrink-0 items-center justify-center rounded-xl bg-[#1C1C1E] px-4 text-[12px] tracking-[0.06em] text-white disabled:bg-neutral-200 disabled:text-neutral-400"
            >
              发送
            </Pressable>
          </div>
        </div>
      )}
    </div>
  )
}
