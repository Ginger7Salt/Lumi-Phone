import { useCallback, useEffect, useMemo, useState } from 'react'

import { useCustomization } from '../../CustomizationContext'
import { loadAccountsBundle } from '../wechat/wechatAccountPersistence'
import { getStoreById } from './tasteCatalog'
import type { DeliveryAddressOption, StoreReview, TasteOrderPayload, TasteOrderReview } from './types'
import { isCharacterGiftOrder, isUserGiftToCharacterOrder } from './types'
import { LUMI_TASTE_ORDER_EVENT, LUMI_TASTE_ORDER_UPDATED_EVENT } from './types'
import { appendUserStoreReview } from './tasteUserReviews'
import { ensureTasteOrderChatThreads } from './tasteChatService'
import {
  buildSelfDeliveryAddress,
} from './tasteDeliveryRecipient'

export { buildSelfDeliveryAddress, sanitizeRecipientNickname, buildDeliveryAddressFromSelection } from './tasteDeliveryRecipient'
export { resolveOrderRecipientNickname, resolveOrderRealRecipientName } from './tasteDeliveryRecipient'
const LEGACY_ORDERS_STORAGE_KEY = 'lumi-taste-orders-v1'
const LEGACY_LAST_ORDER_STORAGE_KEY = 'lumi-taste-last-order-v1'

function ordersStorageKey(accountId: string): string {
  return `lumi-taste-orders-v1:${accountId}`
}

function lastOrderStorageKey(accountId: string): string {
  return `lumi-taste-last-order-v1:${accountId}`
}

/** 下单默认配送目标（真实地址固定，仅昵称可改） */
export function useTasteDefaultDeliveryAddress(defaultNickname?: string): DeliveryAddressOption {
  const { state } = useCustomization()
  const fallback = defaultNickname?.trim() || state.profile.displayName.trim() || '我'
  return useMemo(() => buildSelfDeliveryAddress(fallback), [fallback])
}

/** 开发/资料页：含角色虚拟地址选项 */
export function useTasteDeliveryAddresses(): DeliveryAddressOption[] {
  const { state } = useCustomization()
  const profileName = state.profile.displayName.trim() || '我'

  return useMemo(() => {
    const selfReal = profileName
    const self: DeliveryAddressOption = {
      id: 'addr-self',
      kind: 'self',
      label: selfReal,
      realRecipientName: selfReal,
      detail: '',
    }
    const characterRows: DeliveryAddressOption[] = state.wechatPersonaContacts.map((c) => {
      const name = c.remarkName?.trim() || '角色'
      return {
        id: `addr-char-${c.characterId}`,
        kind: 'character',
        label: name,
        realRecipientName: name,
        detail: '',
        characterId: c.characterId,
      }
    })
    return [self, ...characterRows]
  }, [state.profile.displayName, state.wechatPersonaContacts])
}

function readOrdersFromStorage(accountId: string): TasteOrderPayload[] {
  try {
    const raw = window.localStorage.getItem(ordersStorageKey(accountId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as TasteOrderPayload[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeOrdersToStorage(accountId: string, orders: TasteOrderPayload[]) {
  try {
    window.localStorage.setItem(ordersStorageKey(accountId), JSON.stringify(orders))
  } catch {
    /* ignore */
  }
}

function readLegacyOrders(): TasteOrderPayload[] {
  try {
    const raw = window.localStorage.getItem(LEGACY_ORDERS_STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TasteOrderPayload[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function readLegacyLastOrder(): TasteOrderPayload | null {
  try {
    const raw = window.localStorage.getItem(LEGACY_LAST_ORDER_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as TasteOrderPayload
  } catch {
    return null
  }
}

function migrateLegacyOrdersIfNeeded(accountId: string) {
  const legacy = readLegacyOrders()
  const legacyLast = readLegacyLastOrder()
  const existing = readOrdersFromStorage(accountId)
  if (existing.length > 0) return

  const merged = [...legacy]
  if (legacyLast && !merged.some((o) => o.orderId === legacyLast.orderId)) {
    merged.unshift(legacyLast)
  }
  if (merged.length === 0) return

  writeOrdersToStorage(accountId, merged)
  try {
    window.localStorage.removeItem(LEGACY_ORDERS_STORAGE_KEY)
    window.localStorage.removeItem(LEGACY_LAST_ORDER_STORAGE_KEY)
  } catch {
    /* ignore */
  }
}

export function readTasteOrders(accountId: string): TasteOrderPayload[] {
  migrateLegacyOrdersIfNeeded(accountId)
  return readOrdersFromStorage(accountId)
    .map(normalizeTasteOrderDelivery)
    .sort((a, b) => b.placedAt - a.placedAt)
}

export async function emitTasteOrderPlaced(detail: TasteOrderPayload) {
  try {
    const bundle = await loadAccountsBundle()
    const accountId = bundle?.currentAccountId?.trim() || 'default'
    const normalized = normalizeTasteOrderDelivery(detail)
    window.localStorage.setItem(lastOrderStorageKey(accountId), JSON.stringify(normalized))
    const existing = readOrdersFromStorage(accountId)
    writeOrdersToStorage(accountId, [
      normalized,
      ...existing.filter((o) => o.orderId !== normalized.orderId),
    ])
    ensureTasteOrderChatThreads(accountId, normalized)
    window.dispatchEvent(
      new CustomEvent(LUMI_TASTE_ORDER_EVENT, { detail: { ...normalized, accountScope: accountId } }),
    )
  } catch {
    /* ignore */
  }
}

export function readLastTasteOrder(accountId: string): TasteOrderPayload | null {
  migrateLegacyOrdersIfNeeded(accountId)
  try {
    const raw = window.localStorage.getItem(lastOrderStorageKey(accountId))
    if (!raw) return null
    return JSON.parse(raw) as TasteOrderPayload
  } catch {
    return null
  }
}

/** 旧版固定 45 分钟窗口（无 deliveredAt 时的兜底） */
const LEGACY_DELIVERY_WINDOW_MS = 45 * 60 * 1000

export function computeOrderDeliveredAt(storeId: string, placedAt: number): number {
  const store = getStoreById(storeId)
  const minutes = Math.max(20, store?.deliveryMinutes ?? 35)
  return placedAt + minutes * 60 * 1000
}

export function resolveOrderDeliveredAt(order: TasteOrderPayload): number {
  if (typeof order.deliveredAt === 'number' && Number.isFinite(order.deliveredAt) && order.deliveredAt > 0) {
    return order.deliveredAt
  }
  const store = getStoreById(order.storeId)
  if (store) return computeOrderDeliveredAt(order.storeId, order.placedAt)
  return order.placedAt + LEGACY_DELIVERY_WINDOW_MS
}

export function normalizeTasteOrderDelivery(order: TasteOrderPayload): TasteOrderPayload {
  let next = order
  if (!order.deliveryAddress?.label) {
    next = {
      ...next,
      deliveryAddress: buildSelfDeliveryAddress('我'),
    }
  }
  if (!Array.isArray(next.items)) {
    next = { ...next, items: [] }
  }
  const deliveredAt = resolveOrderDeliveredAt(next)
  if (next.deliveredAt === deliveredAt && next === order) return order
  return { ...next, deliveredAt }
}

export function findPendingFeastOrder(
  orders: TasteOrderPayload[],
  now = Date.now(),
  options?: { preferOrderId?: string | null },
): TasteOrderPayload | null {
  const pending = orders.filter((o) => needsTasteFeastCeremony(o, now))
  if (pending.length === 0) return null

  const preferId = options?.preferOrderId?.trim()
  if (preferId) {
    const preferred = pending.find((o) => o.orderId === preferId)
    if (preferred) return preferred
  }

  const realCharacter = pending.find((o) => isCharacterGiftOrder(o) && !isLumiTakeoutDemoOrder(o))
  if (realCharacter) return realCharacter

  const anyCharacter = pending.find((o) => isCharacterGiftOrder(o))
  if (anyCharacter) return anyCharacter

  return pending[0] ?? null
}

/** Lumi 助手功能演示单，不应抢占角色真实订单的拆封仪式 */
export function isLumiTakeoutDemoOrder(order: TasteOrderPayload): boolean {
  if (order.orderSourceCharacterId === 'wechat-lumi-assistant') return true
  return order.remark.includes('演示备注')
}

export function tasteOrderStatus(order: TasteOrderPayload, now = Date.now()): 'delivering' | 'done' {
  return now >= resolveOrderDeliveredAt(order) ? 'done' : 'delivering'
}

export function isTasteOrderEvaluated(order: TasteOrderPayload): boolean {
  return typeof order.evaluatedAt === 'number' && order.evaluatedAt > 0
}

/** 已送达且尚未评价（用户赠角色单由角色收餐，用户侧无拆封仪式） */
export function needsTasteFeastCeremony(order: TasteOrderPayload, now = Date.now()): boolean {
  if (isUserGiftToCharacterOrder(order)) return false
  return tasteOrderStatus(order, now) === 'done' && !isTasteOrderEvaluated(order)
}

/** 用户赠角色单：已送达且尚未触发角色微信告知 */
export function needsCharacterDeliveryWechatNotify(order: TasteOrderPayload, now = Date.now()): boolean {
  if (!isUserGiftToCharacterOrder(order)) return false
  if (typeof order.characterDeliveryNotifiedAt === 'number' && order.characterDeliveryNotifiedAt > 0) {
    return false
  }
  return tasteOrderStatus(order, now) === 'done'
}

export function markCharacterDeliveryNotified(accountId: string, orderId: string): TasteOrderPayload | null {
  return patchTasteOrder(accountId, orderId, { characterDeliveryNotifiedAt: Date.now() })
}

export function listTasteOrderStorageAccountIds(): string[] {
  const ids = new Set<string>()
  try {
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const key = window.localStorage.key(i)
      if (!key?.startsWith('lumi-taste-orders-v1:')) continue
      const accountId = key.slice('lumi-taste-orders-v1:'.length).trim()
      if (accountId) ids.add(accountId)
    }
  } catch {
    /* ignore */
  }
  return [...ids]
}

function patchTasteOrder(
  accountId: string,
  orderId: string,
  patch: Partial<TasteOrderPayload>,
): TasteOrderPayload | null {
  const orders = readOrdersFromStorage(accountId)
  const index = orders.findIndex((o) => o.orderId === orderId)
  if (index < 0) return null
  const next = { ...orders[index]!, ...patch }
  orders[index] = next
  writeOrdersToStorage(accountId, orders)
  try {
    const lastRaw = window.localStorage.getItem(lastOrderStorageKey(accountId))
    if (lastRaw) {
      const last = JSON.parse(lastRaw) as TasteOrderPayload
      if (last.orderId === orderId) {
        window.localStorage.setItem(lastOrderStorageKey(accountId), JSON.stringify(next))
      }
    }
  } catch {
    /* ignore */
  }
  window.dispatchEvent(
    new CustomEvent(LUMI_TASTE_ORDER_UPDATED_EVENT, { detail: { accountId, orderId } }),
  )
  return next
}

export function submitTasteOrderReview(
  accountId: string,
  orderId: string,
  review: Omit<TasteOrderReview, 'submittedAt'>,
  authorName: string,
): TasteOrderPayload | null {
  const orders = readOrdersFromStorage(accountId)
  const order = orders.find((o) => o.orderId === orderId)
  if (!order || isTasteOrderEvaluated(order)) return null

  const submittedAt = Date.now()
  const fullReview: TasteOrderReview = { ...review, submittedAt }
  const updated = patchTasteOrder(accountId, orderId, {
    evaluatedAt: submittedAt,
    review: fullReview,
  })
  if (!updated) return null

  const storeReview: StoreReview = {
    id: `user-${orderId}`,
    author: authorName.trim() || '匿名食客',
    rating: review.storeRating,
    text: review.text.trim() || '一次安静的飨味体验。',
    date: formatTasteOrderTime(submittedAt).slice(0, 10),
  }
  appendUserStoreReview(accountId, order.storeId, storeReview)
  return updated
}

export function readTasteOrderById(accountId: string, orderId: string): TasteOrderPayload | null {
  return readTasteOrders(accountId).find((o) => o.orderId === orderId) ?? null
}

export function formatTasteOrderTime(ts: number): string {
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  const hh = String(d.getHours()).padStart(2, '0')
  const mm = String(d.getMinutes()).padStart(2, '0')
  return `${y}-${m}-${day} ${hh}:${mm}`
}

export function useTasteOrders(accountId: string | null | undefined): TasteOrderPayload[] {
  const [orders, setOrders] = useState<TasteOrderPayload[]>([])

  const refresh = useCallback(() => {
    if (!accountId) {
      setOrders([])
      return
    }
    setOrders(readTasteOrders(accountId))
  }, [accountId])

  useEffect(() => {
    refresh()
    const onPlaced = () => refresh()
    const onStorage = () => refresh()
    window.addEventListener(LUMI_TASTE_ORDER_EVENT, onPlaced)
    window.addEventListener(LUMI_TASTE_ORDER_UPDATED_EVENT, onPlaced)
    window.addEventListener('wechat-storage-changed', onStorage)
    return () => {
      window.removeEventListener(LUMI_TASTE_ORDER_EVENT, onPlaced)
      window.removeEventListener(LUMI_TASTE_ORDER_UPDATED_EVENT, onPlaced)
      window.removeEventListener('wechat-storage-changed', onStorage)
    }
  }, [refresh])

  return orders
}
