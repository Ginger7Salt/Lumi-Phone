import { getStoreById, resolveOrderItemImage } from '../../takeout/tasteCatalog'
import {
  buildWeChatTakeoutOrderOutputBlock,
  resolveMenuItemForOrder,
} from '../../takeout/tasteTakeoutAiCatalog'
import { computeOrderDeliveredAt } from '../../takeout/tasteOrderBridge'
import { sanitizeRecipientNickname } from '../../takeout/tasteDeliveryRecipient'
import type { TasteOrderPayload } from '../../takeout/types'
import type { WeChatTakeoutOrderPayload } from '../newFriendsPersona/types'

function readRecipientName(j: Record<string, unknown>): string | undefined {
  const raw =
    (typeof j.recipientName === 'string' ? j.recipientName.trim() : '') ||
    (typeof j.recipient === 'string' ? j.recipient.trim() : '') ||
    (typeof j.toName === 'string' ? j.toName.trim() : '')
  const name = sanitizeRecipientNickname(raw)
  return name || undefined
}

export type AiTakeoutOrderItem = {
  name: string
  quantity?: number
}

export type AiTakeoutOrderDirective = {
  storeId: string
  items: AiTakeoutOrderItem[]
  remark?: string
  /** 收货昵称（外卖单可见，如「某位可爱小朋友」；真实地址不变） */
  recipientName?: string
}

function readTakeoutOrderJson(raw: string): AiTakeoutOrderDirective | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    const storeId =
      (typeof j.storeId === 'string' ? j.storeId.trim() : '') ||
      (typeof j.store === 'string' ? j.store.trim() : '')
    if (!storeId) return null

    const rawItems = Array.isArray(j.items) ? j.items : []
    const items: AiTakeoutOrderItem[] = []
    for (const row of rawItems) {
      if (!row || typeof row !== 'object') continue
      const name =
        (typeof (row as { name?: unknown }).name === 'string'
          ? (row as { name: string }).name.trim()
          : '') ||
        (typeof (row as { dish?: unknown }).dish === 'string'
          ? (row as { dish: string }).dish.trim()
          : '')
      if (!name) continue
      const quantityRaw = (row as { quantity?: unknown }).quantity
      const quantity =
        typeof quantityRaw === 'number' && Number.isFinite(quantityRaw)
          ? Math.max(1, Math.round(quantityRaw))
          : 1
      items.push({ name: name.slice(0, 80), quantity })
    }
    if (items.length === 0) return null

    const remark =
      typeof j.remark === 'string'
        ? j.remark.trim().slice(0, 200)
        : typeof j.note === 'string'
          ? j.note.trim().slice(0, 200)
          : undefined

    const recipientName = readRecipientName(j)

    return { storeId, items, remark: remark || undefined, recipientName }
  } catch {
    return null
  }
}

export function parseTakeoutOrderDirective(raw: string): AiTakeoutOrderDirective | null {
  const line = String(raw ?? '').trim()
  const m = /^\[TAKEOUT_ORDER\]\s*(\{[\s\S]*\})$/i.exec(line)
  if (!m) return null
  return readTakeoutOrderJson(m[1]!)
}

export function isTakeoutOrderDirectiveArtifactLine(line: string): boolean {
  return /^\[TAKEOUT_ORDER\]\s*\{/i.test(String(line ?? '').trim())
}

export function takeoutOrderContentFallback(card: WeChatTakeoutOrderPayload): string {
  return `[外卖] ${card.storeName}`
}

export function parseWeChatTakeoutOrderPayloadFromDb(raw: unknown): WeChatTakeoutOrderPayload | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const orderId = typeof r.orderId === 'string' ? r.orderId.trim() : ''
  const storeId = typeof r.storeId === 'string' ? r.storeId.trim() : ''
  const storeName = typeof r.storeName === 'string' ? r.storeName.trim().slice(0, 80) : ''
  const storeLogoUrl = typeof r.storeLogoUrl === 'string' ? r.storeLogoUrl.trim().slice(0, 2000) : ''
  const characterId = typeof r.characterId === 'string' ? r.characterId.trim() : ''
  const characterName = typeof r.characterName === 'string' ? r.characterName.trim().slice(0, 64) : ''
  const placedAtRaw = typeof r.placedAt === 'number' ? r.placedAt : Number(r.placedAt)
  const totalRaw = typeof r.total === 'number' ? r.total : Number(r.total)
  const itemCountRaw = typeof r.itemCount === 'number' ? r.itemCount : Number(r.itemCount)
  if (!orderId || !storeId || !storeName || !characterId || !characterName) return undefined
  if (!Number.isFinite(placedAtRaw) || !Number.isFinite(totalRaw) || !Number.isFinite(itemCountRaw)) return undefined

  const rawItems = Array.isArray(r.items) ? r.items : []
  const items: WeChatTakeoutOrderPayload['items'] = []
  for (const row of rawItems) {
    if (!row || typeof row !== 'object') continue
    const name =
      typeof (row as { name?: unknown }).name === 'string'
        ? (row as { name: string }).name.trim().slice(0, 80)
        : ''
    if (!name) continue
    const quantityRaw = (row as { quantity?: unknown }).quantity
    const quantity =
      typeof quantityRaw === 'number' && Number.isFinite(quantityRaw)
        ? Math.max(1, Math.round(quantityRaw))
        : 1
    items.push({ name, quantity })
  }
  if (items.length === 0) return undefined

  return {
    orderId,
    storeId,
    storeName,
    storeLogoUrl,
    items,
    itemCount: Math.max(1, Math.floor(itemCountRaw)),
    total: Math.round(totalRaw * 100) / 100,
    characterId,
    characterName,
    placedAt: Math.floor(placedAtRaw),
  }
}

export function buildCharacterTakeoutOrderBundle(
  directive: AiTakeoutOrderDirective,
  ctx: {
    characterId: string
    characterName: string
    /** 未指定 recipientName 时的默认收货昵称 */
    defaultRecipientName: string
    /** @deprecated 请用 defaultRecipientName */
    userLabel?: string
  },
): { order: TasteOrderPayload; card: WeChatTakeoutOrderPayload } | null {
  const store = getStoreById(directive.storeId)
  if (!store) return null

  const orderItems: TasteOrderPayload['items'] = []
  for (const row of directive.items) {
    const qty = row.quantity ?? 1
    const menuHit = resolveMenuItemForOrder(store, row.name)
    if (!menuHit) return null
    orderItems.push({
      id: menuHit.id,
      name: menuHit.name,
      quantity: qty,
      price: menuHit.price,
      image: menuHit.image ?? resolveOrderItemImage(store.id, { name: menuHit.name }),
    })
  }

  const itemCount = orderItems.reduce((sum, item) => sum + item.quantity, 0)
  const total = Math.round(orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0) * 100) / 100
  const placedAt = Date.now()
  const orderId = `taste-char-${placedAt}-${Math.random().toString(36).slice(2, 8)}`
  const characterName = ctx.characterName.trim() || 'TA'
  const recipientNickname =
    sanitizeRecipientNickname(directive.recipientName ?? '') ||
    sanitizeRecipientNickname(ctx.defaultRecipientName ?? ctx.userLabel ?? '') ||
    '我'
  const realRecipientName =
    sanitizeRecipientNickname(ctx.defaultRecipientName ?? ctx.userLabel ?? '') || '我'

  const order: TasteOrderPayload = {
    orderId,
    storeId: store.id,
    storeName: store.name,
    total,
    itemCount,
    deliveryAddress: {
      id: 'addr-self',
      kind: 'self',
      label: recipientNickname,
      realRecipientName,
      detail: '',
    },
    remark: directive.remark?.trim() || '给你点了外卖，记得趁热吃～ (｡･ω･｡)',
    items: orderItems,
    placedAt,
    deliveredAt: computeOrderDeliveredAt(store.id, placedAt),
    orderSource: 'character',
    orderSourceCharacterId: ctx.characterId,
    orderSourceCharacterName: characterName,
  }

  const card: WeChatTakeoutOrderPayload = {
    orderId,
    storeId: store.id,
    storeName: store.name,
    storeLogoUrl: store.logoImage,
    items: orderItems.map((item) => ({ name: item.name, quantity: item.quantity })),
    itemCount,
    total,
    characterId: ctx.characterId,
    characterName,
    placedAt,
  }

  return { order, card }
}

export {
  buildTakeoutCatalogPromptBlock,
  buildWeChatTakeoutOrderOutputBlock,
} from '../../takeout/tasteTakeoutAiCatalog'

/** @deprecated 请改用 {@link buildWeChatTakeoutOrderOutputBlock}（动态同步菜单） */
export function getWeChatTakeoutOrderOutputBlock(): string {
  return buildWeChatTakeoutOrderOutputBlock()
}
