import { setBackgroundNotifyPendingWork } from '../backgroundNotify/backgroundNotifyPendingWork'
import { loadAccountsBundle, findAccountById, resolveAccountSessionIdentityId } from '../wechat/wechatAccountPersistence'
import {
  tryHandoffProactiveMessageReveal,
  stashProactiveMessageReveal,
  type ProactiveMessageRevealBubble,
} from '../wechat/proactiveMessageRevealBridge'
import { resolveOrderDeliveredAt } from './tasteOrderBridge'
import {
  listTasteOrderStorageAccountIds,
  markCharacterDeliveryNotified,
  needsCharacterDeliveryWechatNotify,
  readTasteOrders,
} from './tasteOrderBridge'
import { isUserGiftToCharacterOrder, LUMI_TASTE_ORDER_EVENT, LUMI_TASTE_ORDER_UPDATED_EVENT } from './types'
import {
  generateUserGiftDeliveryWechatMessages,
  resolveUserGiftDeliveryConversation,
} from './tasteUserGiftDeliveryNotifyAi'

const TICK_MS = 12_000
const inFlightOrderIds = new Set<string>()

let installed = false
let runningTick = false

function newMessageId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `wx-taste-gift-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

async function notifyCharacterDelivery(
  accountId: string,
  orderId: string,
): Promise<{ ok: boolean; error?: string }> {
  if (inFlightOrderIds.has(orderId)) return { ok: false }

  const orders = readTasteOrders(accountId)
  const order = orders.find((o) => o.orderId === orderId)
  if (!order) return { ok: false }
  if (!needsCharacterDeliveryWechatNotify(order)) return { ok: false }
  if (!isUserGiftToCharacterOrder(order)) return { ok: false }

  inFlightOrderIds.add(orderId)
  setBackgroundNotifyPendingWork({ wechatTyping: true })

  try {
    const bundle = await loadAccountsBundle()
    const account = bundle ? findAccountById(bundle, accountId) : null
    const appSessionPlayerIdentityId = account
      ? resolveAccountSessionIdentityId(account)
      : '__none__'

    const conv = await resolveUserGiftDeliveryConversation({
      order,
      wechatAccountId: accountId,
      appSessionPlayerIdentityId,
    })
    if (!conv) return { ok: false, error: '无法解析角色私聊会话' }

    const { messages } = await generateUserGiftDeliveryWechatMessages({
      order,
      wechatAccountId: accountId,
      sessionPlayerIdentityId: conv.sessionPlayerIdentityId,
      characterNameHint: conv.notifyPeerTitle,
    })

    const deliveredAt = resolveOrderDeliveredAt(order)
    let ts = Math.max(deliveredAt, Date.now() - 120_000)
    const bubbles: ProactiveMessageRevealBubble[] = messages.map((content, index) => {
      if (index > 0) ts += 900 + Math.floor(Math.random() * 1400)
      return {
        id: newMessageId(),
        content,
        timestamp: ts,
      }
    })

    const payload = {
      conversationKey: conv.conversationKey,
      characterId: conv.characterId,
      playerIdentityId: conv.sessionPlayerIdentityId,
      playerDisplayName: conv.playerDisplayName,
      notifyPeerTitle: conv.notifyPeerTitle,
      bubbles,
    }

    const handedOff = tryHandoffProactiveMessageReveal(payload)
    if (!handedOff) {
      stashProactiveMessageReveal(payload)
    }

    markCharacterDeliveryNotified(accountId, orderId)
    return { ok: true }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.warn('[tasteUserGiftDelivery]', msg)
    return { ok: false, error: msg }
  } finally {
    inFlightOrderIds.delete(orderId)
    setBackgroundNotifyPendingWork({ wechatTyping: false })
  }
}

async function tick(): Promise<void> {
  if (runningTick) return
  runningTick = true
  try {
    const accountIds = listTasteOrderStorageAccountIds()
    for (const accountId of accountIds) {
      const orders = readTasteOrders(accountId)
      for (const order of orders) {
        if (needsCharacterDeliveryWechatNotify(order)) {
          void notifyCharacterDelivery(accountId, order.orderId)
        }
      }
    }
  } finally {
    runningTick = false
  }
}

function onOrderEvent(ev: Event): void {
  const detail = (ev as CustomEvent<{ accountScope?: string; accountId?: string; orderId?: string }>).detail
  const accountId = detail?.accountScope?.trim() || detail?.accountId?.trim()
  const orderId = detail?.orderId?.trim()
  if (accountId && orderId) {
    void notifyCharacterDelivery(accountId, orderId)
    return
  }
  void tick()
}

export function installTasteUserGiftDeliveryEngine(): void {
  if (installed) return
  installed = true
  window.addEventListener(LUMI_TASTE_ORDER_EVENT, onOrderEvent)
  window.addEventListener(LUMI_TASTE_ORDER_UPDATED_EVENT, onOrderEvent)
  window.setInterval(() => void tick(), TICK_MS)
  void tick()
}
