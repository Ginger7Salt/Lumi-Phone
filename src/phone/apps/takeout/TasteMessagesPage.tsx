import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { Pressable } from '../../components/Pressable'
import { readTasteOrders } from './tasteOrderBridge'
import { ensureTasteOrderGroupThread } from './tasteChatService'
import {
  clearTasteCharacterRecordThreads,
  deleteTasteChatThread,
  deleteTasteChatThreads,
  readTasteChatMessages,
  useTasteCharacterRecordThreads,
  useTasteInboxThreads,
} from './tasteChatStore'
import { TasteChatAvatar } from './TasteChatAvatar'
import { TasteSwipeDeleteRow } from './TasteSwipeDeleteRow'
import { tasteNumStyle } from './tasteTypography'
import { useTasteWechatAccounts } from './useTasteWechatAccounts'
import type { TasteChatThread } from './types'

const SERIF = '"Cormorant Garamond", "Noto Serif SC", "Songti SC", serif'

export type TasteMessagesSegment = 'inbox' | 'character'

function formatListTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay =
    d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth() && d.getDate() === now.getDate()
  if (sameDay) return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

function ThreadRowContent({
  thread,
  preview,
  variant = 'default',
}: {
  thread: TasteChatThread
  preview: string
  variant?: 'default' | 'character'
}) {
  return (
    <div
      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left shadow-[0_4px_20px_rgba(0,0,0,0.03)] ${
        variant === 'character' ? 'border border-[#D4AF37]/20 bg-white' : 'border border-gray-100 bg-white'
      }`}
    >
      <TasteChatAvatar thread={thread} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-2">
          <p className="truncate text-[14px] font-medium text-[#1C1C1E]" style={{ fontFamily: SERIF }}>
            {thread.title}
          </p>
          <span className="shrink-0 text-[10px] text-neutral-400" style={tasteNumStyle}>
            {formatListTime(thread.updatedAt)}
          </span>
        </div>
        <p className="mt-1 truncate text-[12px] text-neutral-500">{preview}</p>
        <p className="mt-0.5 text-[10px] text-neutral-300">{thread.subtitle}</p>
      </div>
    </div>
  )
}

function SegmentTabs({
  active,
  onChange,
}: {
  active: TasteMessagesSegment
  onChange: (segment: TasteMessagesSegment) => void
}) {
  const tabs: { id: TasteMessagesSegment; label: string }[] = [
    { id: 'inbox', label: '订单沟通' },
    { id: 'character', label: '角色记录' },
  ]
  return (
    <div className="mx-4 flex rounded-full border border-gray-100 bg-white/80 p-1">
      {tabs.map((tab) => {
        const selected = active === tab.id
        return (
          <Pressable
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`flex-1 rounded-full py-2 text-center text-[11px] tracking-[0.06em] transition-colors ${
              selected ? 'bg-[#1C1C1E] text-white' : 'text-neutral-400'
            }`}
          >
            {tab.label}
          </Pressable>
        )
      })}
    </div>
  )
}

export function TasteMessagesPage({
  onOpenThread,
  segment,
  onSegmentChange,
}: {
  onOpenThread: (threadId: string) => void
  segment: TasteMessagesSegment
  onSegmentChange: (segment: TasteMessagesSegment) => void
}) {
  const { currentAccountId } = useTasteWechatAccounts()
  const [swipeOpenThreadId, setSwipeOpenThreadId] = useState<string | null>(null)
  const ensuredInboxKeyRef = useRef('')
  const inboxThreads = useTasteInboxThreads(currentAccountId)
  const characterThreads = useTasteCharacterRecordThreads(currentAccountId)
  const threads = segment === 'inbox' ? inboxThreads : characterThreads

  const previews = useMemo(() => {
    if (!currentAccountId) return {}
    const map: Record<string, string> = {}
    for (const t of threads) {
      const msgs = readTasteChatMessages(currentAccountId, t.id)
      const last = msgs[msgs.length - 1]
      map[t.id] = last?.text ?? '暂无消息'
    }
    return map
  }, [currentAccountId, threads])

  useEffect(() => {
    if (!currentAccountId || segment !== 'inbox') return
    const orders = readTasteOrders(currentAccountId)
    const inboxKey = `${currentAccountId}:${orders.map((o) => o.orderId).join('|')}`
    if (ensuredInboxKeyRef.current === inboxKey) return
    ensuredInboxKeyRef.current = inboxKey
    for (const order of orders) ensureTasteOrderGroupThread(currentAccountId, order)
  }, [currentAccountId, segment])

  useEffect(() => {
    if (!currentAccountId) ensuredInboxKeyRef.current = ''
  }, [currentAccountId])

  useEffect(() => {
    setSwipeOpenThreadId(null)
  }, [segment])

  useEffect(() => {
    if (!swipeOpenThreadId) return
    const onPointerDown = (e: PointerEvent) => {
      const el = e.target as HTMLElement | null
      if (!el?.closest('[data-swipe-row-root]')) setSwipeOpenThreadId(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [swipeOpenThreadId])

  const handleDelete = useCallback(
    (threadId: string) => {
      if (!currentAccountId) return
      deleteTasteChatThread(currentAccountId, threadId)
      setSwipeOpenThreadId((cur) => (cur === threadId ? null : cur))
    },
    [currentAccountId],
  )

  const handleClearAll = useCallback(() => {
    if (!currentAccountId || threads.length === 0) return
    const label = segment === 'inbox' ? '订单沟通' : '角色记录'
    if (!window.confirm(`确定清空当前「${label}」下的全部 ${threads.length} 条聊天卡片吗？`)) return
    if (segment === 'character') {
      clearTasteCharacterRecordThreads(currentAccountId)
    } else {
      deleteTasteChatThreads(
        currentAccountId,
        threads.map((t) => t.id),
      )
    }
    setSwipeOpenThreadId(null)
  }, [currentAccountId, segment, threads])

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-transparent pb-6 pt-4">
      <SegmentTabs active={segment} onChange={onSegmentChange} />

      {threads.length > 0 ? (
        <div className="mt-3 flex justify-end px-4">
          <Pressable
            type="button"
            onClick={handleClearAll}
            className="rounded-full border border-gray-200 bg-white px-3 py-1.5 text-[10px] tracking-[0.06em] text-neutral-500 active:bg-gray-50"
          >
            清空全部
          </Pressable>
        </div>
      ) : null}

      {threads.length === 0 ? (
        <div className="px-8 pt-12 text-center">
          <p className="text-[13px] text-neutral-400">
            {segment === 'inbox' ? '暂无消息' : '暂无角色记录'}
          </p>
          <p className="mt-2 text-[11px] leading-relaxed text-neutral-300">
            {segment === 'inbox'
              ? '下单后将自动创建配送群，可在此与商家、专员沟通'
              : '角色赠礼单的沟通记录在送餐追踪页生成后，会出现在这里'}
          </p>
        </div>
      ) : (
        <div className="mt-3 space-y-2.5 px-4">
          {threads.map((thread) => (
            <TasteSwipeDeleteRow
              key={thread.id}
              rowId={thread.id}
              swipeOpen={swipeOpenThreadId === thread.id}
              onSwipeOpenChange={(open) => setSwipeOpenThreadId(open ? thread.id : null)}
              onDelete={() => handleDelete(thread.id)}
            >
              <Pressable
                type="button"
                onClick={() => {
                  if (swipeOpenThreadId === thread.id) {
                    setSwipeOpenThreadId(null)
                    return
                  }
                  onOpenThread(thread.id)
                }}
                className="block w-full"
              >
                <ThreadRowContent
                  thread={thread}
                  preview={previews[thread.id] ?? '暂无消息'}
                  variant={segment === 'character' ? 'character' : 'default'}
                />
              </Pressable>
            </TasteSwipeDeleteRow>
          ))}
        </div>
      )}
    </div>
  )
}
