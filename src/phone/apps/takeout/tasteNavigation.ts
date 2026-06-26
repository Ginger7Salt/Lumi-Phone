import type { WeChatTakeoutOrderPayload } from '../wechat/newFriendsPersona/types'
import { buildTasteOrderPayloadFromWeChatCard } from './tasteWechatOrderHydrate'
import type { TasteOrderPayload } from './types'

/** 从微信卡片等外部入口打开寻味并定位到指定订单追踪页 */
let pendingTrackingOrderId: string | null = null
let pendingTrackingOrderSeed: TasteOrderPayload | null = null
/** 标记本次追踪由微信等外部入口打开，退出追踪时应回到来源应用而非送餐列表 */
let pendingTrackingReturnToWeChat = false

export function openTasteAppTracking(
  orderId: string,
  cardOrSeed?: WeChatTakeoutOrderPayload | TasteOrderPayload,
) {
  const id = orderId.trim()
  if (!id) return
  pendingTrackingOrderId = id
  pendingTrackingReturnToWeChat = true

  if (cardOrSeed && 'orderSource' in cardOrSeed && cardOrSeed.orderId === id) {
    pendingTrackingOrderSeed = cardOrSeed
  } else if (cardOrSeed && 'characterId' in cardOrSeed && cardOrSeed.orderId === id) {
    pendingTrackingOrderSeed = buildTasteOrderPayloadFromWeChatCard(cardOrSeed)
  } else {
    pendingTrackingOrderSeed = null
  }

  window.dispatchEvent(new CustomEvent('phone:open-app', { detail: { id: 'takeout' } }))
}

export function readPendingTasteTrackingOrderId(): string | null {
  return pendingTrackingOrderId
}

export function readPendingTasteTrackingOrderSeed(): TasteOrderPayload | null {
  return pendingTrackingOrderSeed
}

export function readPendingTasteTrackingReturnToWeChat(): boolean {
  return pendingTrackingReturnToWeChat
}

export function resetPendingTasteTrackingNavigation(): void {
  pendingTrackingOrderId = null
  pendingTrackingOrderSeed = null
  pendingTrackingReturnToWeChat = false
}

export function consumePendingTasteTrackingOrderId(): string | null {
  const id = pendingTrackingOrderId
  pendingTrackingOrderId = null
  return id
}

export function consumePendingTasteTrackingOrderSeed(): TasteOrderPayload | null {
  const seed = pendingTrackingOrderSeed
  pendingTrackingOrderSeed = null
  return seed
}

export function consumePendingTasteTrackingReturnToWeChat(): boolean {
  const should = pendingTrackingReturnToWeChat
  pendingTrackingReturnToWeChat = false
  return should
}
