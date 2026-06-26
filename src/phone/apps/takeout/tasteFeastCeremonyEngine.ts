import { isCharacterGiftOrder } from './types'
import {
  findPendingFeastOrder,
  listTasteOrderStorageAccountIds,
  readTasteOrders,
} from './tasteOrderBridge'
import {
  isTasteFeastCeremonyActive,
  tryOpenTasteFeastCeremony,
} from './tasteFeastCeremonyBridge'
import { LUMI_TASTE_ORDER_EVENT, LUMI_TASTE_ORDER_UPDATED_EVENT } from './types'

const TICK_MS = 12_000

let installed = false
let runningTick = false

function pickBestPendingFeast(): { accountId: string; orderId: string } | null {
  const accountIds = listTasteOrderStorageAccountIds()
  if (accountIds.length === 0) return null

  let best: { accountId: string; orderId: string; characterGift: boolean } | null = null

  for (const accountId of accountIds) {
    const pending = findPendingFeastOrder(readTasteOrders(accountId))
    if (!pending) continue
    const characterGift = isCharacterGiftOrder(pending)
    if (!best) {
      best = { accountId, orderId: pending.orderId, characterGift }
      continue
    }
    if (characterGift && !best.characterGift) {
      best = { accountId, orderId: pending.orderId, characterGift }
    }
  }

  return best ? { accountId: best.accountId, orderId: best.orderId } : null
}

function scanAndOpen(): void {
  if (isTasteFeastCeremonyActive()) return
  const next = pickBestPendingFeast()
  if (!next) return
  tryOpenTasteFeastCeremony(next)
}

async function tick(): Promise<void> {
  if (runningTick) return
  runningTick = true
  try {
    scanAndOpen()
  } finally {
    runningTick = false
  }
}

function onOrderEvent(): void {
  void tick()
}

export function installTasteFeastCeremonyEngine(): void {
  if (installed) return
  installed = true
  window.addEventListener(LUMI_TASTE_ORDER_EVENT, onOrderEvent)
  window.addEventListener(LUMI_TASTE_ORDER_UPDATED_EVENT, onOrderEvent)
  window.setInterval(() => void tick(), TICK_MS)
  void tick()
}
