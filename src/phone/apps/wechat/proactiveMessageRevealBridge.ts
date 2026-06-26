import { persistProactiveRevealPayload } from './proactiveBubbleRevealPersistence'
import type { WeChatMusicSyncInvitePayload } from './newFriendsPersona/types'

export type ProactiveMessageRevealBubble = {
  id: string
  content: string
  thinking?: string
  timestamp: number
  musicSync?: WeChatMusicSyncInvitePayload
}

export type ProactiveMessageRevealPayload = {
  conversationKey: string
  characterId: string
  playerIdentityId: string
  playerDisplayName: string
  notifyPeerTitle: string
  bubbles: ProactiveMessageRevealBubble[]
}

type ProactiveMessageRevealHandler = (payload: ProactiveMessageRevealPayload) => boolean

const revealHandlers = new Map<string, ProactiveMessageRevealHandler>()
/** 聊天页尚未挂载时的短暂窗口：供 register 后逐条动画；同时会立刻落库 */
const pendingReveals = new Map<string, ProactiveMessageRevealPayload>()

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
  return handler(payload)
}

/** 聊天页未挂载：立刻落库（历史时间戳），并暂存供稍后进入会话时动画（若尚未被读入列表）。 */
export function stashProactiveMessageReveal(payload: ProactiveMessageRevealPayload): void {
  const k = payload.conversationKey.trim()
  if (!k) return
  pendingReveals.set(k, payload)
  void persistProactiveRevealPayload(payload, false).catch(() => {})
}

/** 页面隐藏/卸载前：确保尚未接管的主动消息已全部落库 */
export function flushPendingProactiveMessageReveals(): void {
  if (pendingReveals.size === 0) return
  const batch = [...pendingReveals.values()]
  pendingReveals.clear()
  for (const payload of batch) {
    void persistProactiveRevealPayload(payload, false).catch(() => {})
  }
}

let lifecycleInstalled = false

export function installProactiveMessageRevealLifecycle(): void {
  if (lifecycleInstalled) return
  lifecycleInstalled = true
  const flush = () => flushPendingProactiveMessageReveals()
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
  window.addEventListener('pagehide', flush)
}
