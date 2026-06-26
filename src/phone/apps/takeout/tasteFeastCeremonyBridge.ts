export type TasteFeastCeremonyRequest = {
  accountId: string
  orderId: string
}

type TasteFeastCeremonyHandler = (request: TasteFeastCeremonyRequest) => boolean

let handler: TasteFeastCeremonyHandler | null = null
let pending: TasteFeastCeremonyRequest | null = null
let suppressUntil = 0
let activeOrderId: string | null = null

export function markTasteFeastCeremonyActive(orderId: string | null): void {
  activeOrderId = orderId?.trim() || null
}

export function isTasteFeastCeremonyActive(orderId?: string): boolean {
  if (!activeOrderId) return false
  if (!orderId?.trim()) return true
  return activeOrderId === orderId.trim()
}

/** 短暂抑制自动拆封（如从微信卡片退出追踪页时） */
export function suppressTasteFeastCeremonyAutoOpen(ms = 1200): void {
  suppressUntil = Date.now() + Math.max(0, ms)
}

function isSuppressed(): boolean {
  return Date.now() < suppressUntil
}

export function registerTasteFeastCeremonyHandler(next: TasteFeastCeremonyHandler | null): void {
  handler = next
  if (!next || isSuppressed() || !pending) return
  const req = pending
  pending = null
  if (!next(req)) {
    pending = req
  }
}

export function tryOpenTasteFeastCeremony(request: TasteFeastCeremonyRequest): boolean {
  const accountId = request.accountId.trim()
  const orderId = request.orderId.trim()
  if (!accountId || !orderId) return false
  if (isSuppressed()) return false
  if (activeOrderId === orderId) return true

  const req = { accountId, orderId }
  if (handler?.(req)) return true
  pending = req
  return false
}

export function consumePendingTasteFeastCeremony(): TasteFeastCeremonyRequest | null {
  if (isSuppressed() || !pending) return null
  const req = pending
  pending = null
  return req
}

export function clearPendingTasteFeastCeremony(orderId?: string): void {
  if (!pending) return
  if (!orderId?.trim() || pending.orderId === orderId.trim()) {
    pending = null
  }
}
