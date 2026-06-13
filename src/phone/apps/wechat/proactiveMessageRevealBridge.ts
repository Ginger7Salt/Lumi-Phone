import { persistProactiveRevealPayload } from './proactiveBubbleRevealPersistence'

export type ProactiveMessageRevealBubble = {
  id: string
  content: string
  thinking?: string
  timestamp: number
}

export type ProactiveMessageRevealPayload = {
  conversationKey: string
  characterId: string
  playerIdentityId: string
  notifyPeerTitle: string
  bubbles: ProactiveMessageRevealBubble[]
}

type ProactiveMessageRevealHandler = (payload: ProactiveMessageRevealPayload) => boolean

const revealHandlers = new Map<string, ProactiveMessageRevealHandler>()
const pendingReveals = new Map<string, ProactiveMessageRevealPayload>()
const persistFallbackTimers = new Map<string, ReturnType<typeof setTimeout>>()

const PERSIST_FALLBACK_MS = 45_000

function clearPersistFallback(conversationKey: string): void {
  const k = conversationKey.trim()
  const timer = persistFallbackTimers.get(k)
  if (timer != null) {
    window.clearTimeout(timer)
    persistFallbackTimers.delete(k)
  }
}

function schedulePersistFallback(payload: ProactiveMessageRevealPayload): void {
  const k = payload.conversationKey.trim()
  if (!k) return
  clearPersistFallback(k)
  persistFallbackTimers.set(
    k,
    window.setTimeout(() => {
      persistFallbackTimers.delete(k)
      if (!pendingReveals.has(k)) return
      const pending = pendingReveals.get(k)
      pendingReveals.delete(k)
      if (!pending) return
      void persistProactiveRevealPayload(pending, false).catch(() => {})
    }, PERSIST_FALLBACK_MS),
  )
}

export function registerProactiveMessageRevealHandler(
  conversationKey: string,
  handler: ProactiveMessageRevealHandler | null,
): void {
  const k = conversationKey.trim()
  if (!k) return
  if (!handler) {
    revealHandlers.delete(k)
    return
  }
  revealHandlers.set(k, handler)
  const pending = pendingReveals.get(k)
  if (pending) {
    pendingReveals.delete(k)
    clearPersistFallback(k)
    handler(pending)
  }
}

/** 前台聊天室接管逐条露出；返回 true 表示已由 ChatRoom 入队，引擎侧勿再直接落库。 */
export function tryHandoffProactiveMessageReveal(payload: ProactiveMessageRevealPayload): boolean {
  const k = payload.conversationKey.trim()
  if (!k) return false
  const handler = revealHandlers.get(k)
  if (!handler) return false
  pendingReveals.delete(k)
  clearPersistFallback(k)
  return handler(payload)
}

/** 聊天页未挂载时暂存；进入会话后由 register 触发逐条露出。 */
export function stashProactiveMessageReveal(payload: ProactiveMessageRevealPayload): void {
  const k = payload.conversationKey.trim()
  if (!k) return
  pendingReveals.set(k, payload)
  schedulePersistFallback(payload)
}
