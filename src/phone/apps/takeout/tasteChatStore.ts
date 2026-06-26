import { useCallback, useEffect, useState } from 'react'

import type { TasteChatMessage, TasteChatThread, TasteChatKind } from './types'
import { LUMI_TASTE_CHAT_EVENT } from './types'

function isCharacterObserverThreadKind(kind: TasteChatKind): boolean {
  return kind === 'character-merchant' || kind === 'character-courier'
}

type TasteChatSnapshot = {
  threads: TasteChatThread[]
  messagesByThread: Record<string, TasteChatMessage[]>
  /** 用户左滑删除或清空后隐藏，避免打开聊天时 resurrect 列表项 */
  hiddenThreadIds?: string[]
}

function isCharacterObserverThreadId(threadId: string): boolean {
  return threadId.endsWith(':character-merchant') || threadId.endsWith(':character-courier')
}

function storageKey(accountId: string): string {
  return `lumi-taste-chats-v1:${accountId.trim() || 'default'}`
}

function emptySnapshot(): TasteChatSnapshot {
  return { threads: [], messagesByThread: {}, hiddenThreadIds: [] }
}

function readSnapshot(accountId: string): TasteChatSnapshot {
  try {
    const raw = window.localStorage.getItem(storageKey(accountId))
    if (!raw) return emptySnapshot()
    const parsed = JSON.parse(raw) as TasteChatSnapshot
    if (!parsed || !Array.isArray(parsed.threads)) return emptySnapshot()
    return {
      threads: parsed.threads,
      messagesByThread: parsed.messagesByThread ?? {},
      hiddenThreadIds: Array.isArray(parsed.hiddenThreadIds) ? parsed.hiddenThreadIds : [],
    }
  } catch {
    return emptySnapshot()
  }
}

function writeSnapshot(accountId: string, snap: TasteChatSnapshot) {
  try {
    window.localStorage.setItem(storageKey(accountId), JSON.stringify(snap))
    window.dispatchEvent(new CustomEvent(LUMI_TASTE_CHAT_EVENT))
  } catch {
    /* ignore */
  }
}

export function emitTasteChatChanged() {
  window.dispatchEvent(new CustomEvent(LUMI_TASTE_CHAT_EVENT))
}

export function readTasteChatThreads(accountId: string): TasteChatThread[] {
  return readSnapshot(accountId).threads.sort((a, b) => b.updatedAt - a.updatedAt)
}

function readHiddenThreadIds(accountId: string): Set<string> {
  return new Set((readSnapshot(accountId).hiddenThreadIds ?? []).map((id) => id.trim()).filter(Boolean))
}

export function isTasteChatThreadHidden(accountId: string, threadId: string): boolean {
  return readHiddenThreadIds(accountId).has(threadId.trim())
}

export function hideTasteChatThreads(accountId: string, threadIds: readonly string[]) {
  const ids = threadIds.map((id) => id.trim()).filter(Boolean)
  if (ids.length === 0) return
  const snap = readSnapshot(accountId)
  const hidden = readHiddenThreadIds(accountId)
  for (const id of ids) hidden.add(id)
  writeSnapshot(accountId, { ...snap, hiddenThreadIds: [...hidden] })
}

export function unhideTasteChatThread(accountId: string, threadId: string) {
  const id = threadId.trim()
  if (!id) return
  const snap = readSnapshot(accountId)
  const hidden = readHiddenThreadIds(accountId)
  if (!hidden.has(id)) return
  hidden.delete(id)
  writeSnapshot(accountId, { ...snap, hiddenThreadIds: [...hidden] })
}

/** 打开已隐藏的旁观者聊天时，清掉可能残留的本地消息 */
export function purgeTasteChatThreadMessages(accountId: string, threadId: string) {
  const id = threadId.trim()
  if (!id) return
  const snap = readSnapshot(accountId)
  if (!snap.messagesByThread[id]?.length) return
  const restMessages = { ...snap.messagesByThread }
  delete restMessages[id]
  writeSnapshot(accountId, { ...snap, messagesByThread: restMessages })
}

export function readTasteInboxThreads(accountId: string): TasteChatThread[] {
  const hidden = readHiddenThreadIds(accountId)
  return readTasteChatThreads(accountId).filter((t) => {
    if (hidden.has(t.id)) return false
    if (isCharacterObserverThreadKind(t.kind)) return false
    if (t.kind === 'group') return true
    return readTasteChatMessages(accountId, t.id).some((m) => m.from === 'user')
  })
}

/** 角色与商家/骑手的旁观沟通记录（不含用户本人参与的会话） */
export function readTasteCharacterRecordThreads(accountId: string): TasteChatThread[] {
  const hidden = readHiddenThreadIds(accountId)
  return readTasteChatThreads(accountId).filter(
    (t) =>
      isCharacterObserverThreadKind(t.kind) &&
      !hidden.has(t.id) &&
      readTasteChatMessages(accountId, t.id).length > 0,
  )
}

export function readTasteChatThread(accountId: string, threadId: string): TasteChatThread | null {
  return readSnapshot(accountId).threads.find((t) => t.id === threadId) ?? null
}

export function readTasteChatMessages(accountId: string, threadId: string): TasteChatMessage[] {
  const list = readSnapshot(accountId).messagesByThread[threadId] ?? []
  return [...list].sort((a, b) => a.ts - b.ts)
}

export function upsertTasteChatThread(accountId: string, thread: TasteChatThread) {
  const snap = readSnapshot(accountId)
  const next = snap.threads.filter((t) => t.id !== thread.id)
  next.unshift(thread)
  writeSnapshot(accountId, { ...snap, threads: next, hiddenThreadIds: snap.hiddenThreadIds ?? [] })
}

export function appendTasteChatMessages(accountId: string, threadId: string, messages: TasteChatMessage[]) {
  if (!messages.length) return
  const snap = readSnapshot(accountId)
  const prev = snap.messagesByThread[threadId] ?? []
  const merged = [...prev, ...messages]
  const thread = snap.threads.find((t) => t.id === threadId)
  const lastTs = messages[messages.length - 1]?.ts ?? Date.now()
  const threads = thread
    ? snap.threads.map((t) => (t.id === threadId ? { ...t, updatedAt: lastTs } : t))
    : snap.threads
  writeSnapshot(accountId, {
    ...snap,
    threads,
    messagesByThread: { ...snap.messagesByThread, [threadId]: merged },
  })
}

export function replaceTasteChatMessages(
  accountId: string,
  threadId: string,
  messages: TasteChatMessage[],
  threadPatch?: Partial<TasteChatThread>,
) {
  const snap = readSnapshot(accountId)
  const lastTs = messages[messages.length - 1]?.ts ?? Date.now()
  const threads = snap.threads.map((t) =>
    t.id === threadId ? { ...t, ...threadPatch, updatedAt: lastTs } : t,
  )
  writeSnapshot(accountId, {
    ...snap,
    threads,
    messagesByThread: { ...snap.messagesByThread, [threadId]: messages },
  })
}

export function deleteTasteChatThread(accountId: string, threadId: string): boolean {
  return deleteTasteChatThreads(accountId, [threadId]) > 0
}

export function deleteTasteChatThreads(accountId: string, threadIds: readonly string[]): number {
  const ids = new Set(threadIds.map((id) => id.trim()).filter(Boolean))
  if (ids.size === 0) return 0
  const snap = readSnapshot(accountId)
  const hidden = readHiddenThreadIds(accountId)
  for (const id of ids) hidden.add(id)

  const restMessages = { ...snap.messagesByThread }
  let removedMessages = 0
  for (const id of ids) {
    if (restMessages[id]) {
      delete restMessages[id]
      removedMessages += 1
    }
  }

  const nextThreads = snap.threads.filter((t) => !ids.has(t.id))
  const removedThreads = snap.threads.length - nextThreads.length

  writeSnapshot(accountId, {
    ...snap,
    threads: nextThreads,
    messagesByThread: restMessages,
    hiddenThreadIds: [...hidden],
  })
  return Math.max(removedThreads, removedMessages, ids.size > 0 ? 1 : 0)
}

/** 清空角色记录 Tab：删除并隐藏所有旁观者线程（含可能残留的消息键） */
export function clearTasteCharacterRecordThreads(accountId: string): number {
  const snap = readSnapshot(accountId)
  const hidden = readHiddenThreadIds(accountId)
  const restMessages = { ...snap.messagesByThread }
  let cleared = 0

  for (const t of snap.threads) {
    if (!isCharacterObserverThreadKind(t.kind)) continue
    hidden.add(t.id)
    delete restMessages[t.id]
    cleared += 1
  }
  for (const threadId of Object.keys(restMessages)) {
    if (!isCharacterObserverThreadId(threadId)) continue
    hidden.add(threadId)
    delete restMessages[threadId]
    cleared += 1
  }

  writeSnapshot(accountId, {
    ...snap,
    threads: snap.threads.filter((t) => !isCharacterObserverThreadKind(t.kind)),
    messagesByThread: restMessages,
    hiddenThreadIds: [...hidden],
  })
  return cleared
}

export function useTasteInboxThreads(accountId: string | null | undefined) {
  const [threads, setThreads] = useState<TasteChatThread[]>([])

  const refresh = useCallback(() => {
    if (!accountId) {
      setThreads([])
      return
    }
    setThreads(readTasteInboxThreads(accountId))
  }, [accountId])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(LUMI_TASTE_CHAT_EVENT, onChange)
    return () => window.removeEventListener(LUMI_TASTE_CHAT_EVENT, onChange)
  }, [refresh])

  return threads
}

export function useTasteCharacterRecordThreads(accountId: string | null | undefined) {
  const [threads, setThreads] = useState<TasteChatThread[]>([])

  const refresh = useCallback(() => {
    if (!accountId) {
      setThreads([])
      return
    }
    setThreads(readTasteCharacterRecordThreads(accountId))
  }, [accountId])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(LUMI_TASTE_CHAT_EVENT, onChange)
    return () => window.removeEventListener(LUMI_TASTE_CHAT_EVENT, onChange)
  }, [refresh])

  return threads
}

export function useTasteChatMessages(accountId: string | null | undefined, threadId: string | null) {
  const [messages, setMessages] = useState<TasteChatMessage[]>([])

  const refresh = useCallback(() => {
    if (!accountId || !threadId) {
      setMessages([])
      return
    }
    setMessages(readTasteChatMessages(accountId, threadId))
  }, [accountId, threadId])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(LUMI_TASTE_CHAT_EVENT, onChange)
    return () => window.removeEventListener(LUMI_TASTE_CHAT_EVENT, onChange)
  }, [refresh])

  return messages
}
