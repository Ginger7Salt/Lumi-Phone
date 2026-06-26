import { useCallback, useEffect, useState } from 'react'

import { formatSpecSummary } from './tasteItemSpecs'
import type { CollectedReceipt, TasteOrderPayload } from './types'
import { isCharacterGiftOrder } from './types'
import { LUMI_TASTE_RECEIPTS_EVENT } from './types'

const STORAGE_PREFIX = 'lumi-taste-collected-receipts-v1'

function storageKey(accountId: string): string {
  return `${STORAGE_PREFIX}:${accountId}`
}

function readAll(accountId: string): CollectedReceipt[] {
  try {
    const raw = window.localStorage.getItem(storageKey(accountId))
    if (!raw) return []
    const parsed = JSON.parse(raw) as CollectedReceipt[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeAll(accountId: string, receipts: CollectedReceipt[]) {
  try {
    window.localStorage.setItem(storageKey(accountId), JSON.stringify(receipts))
    window.dispatchEvent(new CustomEvent(LUMI_TASTE_RECEIPTS_EVENT, { detail: { accountId } }))
  } catch {
    /* ignore */
  }
}

function resolveCharacterNote(order: TasteOrderPayload): string {
  const remark = order.remark.trim()
  if (remark) return remark
  return '望你按时用餐，别让我挂念。'
}

export function readCollectedReceipts(accountId: string): CollectedReceipt[] {
  return readAll(accountId).sort((a, b) => b.collectedAt - a.collectedAt)
}

export function saveCollectedReceipt(
  accountId: string,
  order: TasteOrderPayload,
): CollectedReceipt | null {
  if (!isCharacterGiftOrder(order)) return null

  const existing = readAll(accountId)
  if (existing.some((r) => r.orderId === order.orderId)) return null

  const collectedAt = Date.now()
  const receipt: CollectedReceipt = {
    id: order.orderId,
    orderId: order.orderId,
    storeId: order.storeId,
    storeName: order.storeName,
    total: order.total,
    itemCount: order.itemCount,
    characterName: order.orderSourceCharacterName?.trim() || 'TA',
    characterId: order.orderSourceCharacterId,
    note: resolveCharacterNote(order),
    items: order.items.map((item) => ({
      id: item.id,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
      specSummary: item.specSummary?.trim() || formatSpecSummary(item.specs) || undefined,
    })),
    placedAt: order.placedAt,
    collectedAt,
  }

  writeAll(accountId, [receipt, ...existing])
  return receipt
}

export function removeCollectedReceipt(accountId: string, receiptId: string): void {
  const next = readAll(accountId).filter((r) => r.id !== receiptId)
  writeAll(accountId, next)
}

export function useCollectedReceipts(accountId: string | null | undefined): CollectedReceipt[] {
  const [receipts, setReceipts] = useState<CollectedReceipt[]>([])

  const refresh = useCallback(() => {
    if (!accountId) {
      setReceipts([])
      return
    }
    setReceipts(readCollectedReceipts(accountId))
  }, [accountId])

  useEffect(() => {
    refresh()
    const onChange = () => refresh()
    window.addEventListener(LUMI_TASTE_RECEIPTS_EVENT, onChange)
    window.addEventListener('wechat-storage-changed', onChange)
    return () => {
      window.removeEventListener(LUMI_TASTE_RECEIPTS_EVENT, onChange)
      window.removeEventListener('wechat-storage-changed', onChange)
    }
  }, [refresh])

  return receipts
}
