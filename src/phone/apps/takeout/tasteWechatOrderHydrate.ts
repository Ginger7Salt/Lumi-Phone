import type { WeChatTakeoutOrderPayload } from '../wechat/newFriendsPersona/types'
import { getStoreById, resolveOrderItemImage } from './tasteCatalog'
import { buildSelfDeliveryAddress } from './tasteDeliveryRecipient'
import { computeOrderDeliveredAt } from './tasteOrderBridge'
import { resolveMenuItemForOrder } from './tasteTakeoutAiCatalog'
import type { TasteOrderPayload } from './types'

/** 从微信外卖卡片还原寻味订单（用于卡片跳转追踪页时本地尚无订单） */
export function buildTasteOrderPayloadFromWeChatCard(
  card: WeChatTakeoutOrderPayload,
  options?: { recipientName?: string },
): TasteOrderPayload {
  const store = getStoreById(card.storeId)
  const placedAt =
    typeof card.placedAt === 'number' && Number.isFinite(card.placedAt) && card.placedAt > 0
      ? card.placedAt
      : Date.now()

  const items = (card.items ?? []).map((item) => {
    const menuHit = store ? resolveMenuItemForOrder(store, item.name) : null
    return {
      id: menuHit?.id,
      name: item.name,
      quantity: Math.max(1, item.quantity ?? 1),
      price: menuHit?.price ?? 0,
      image: menuHit?.image ?? resolveOrderItemImage(card.storeId, { name: item.name }),
    }
  })

  const recipient =
    options?.recipientName?.trim() ||
    card.characterName?.trim() ||
    '我'

  return {
    orderId: card.orderId,
    storeId: card.storeId,
    storeName: card.storeName,
    total: card.total,
    itemCount: card.itemCount || items.reduce((n, i) => n + i.quantity, 0),
    deliveryAddress: buildSelfDeliveryAddress(recipient),
    remark: '',
    items,
    placedAt,
    deliveredAt: computeOrderDeliveredAt(card.storeId, placedAt),
    orderSource: 'character',
    orderSourceCharacterId: card.characterId,
    orderSourceCharacterName: card.characterName,
  }
}
