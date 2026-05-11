/**
 * Lumi 转账持久化：localStorage + 时间戳驱动 24h 自动退还（不依赖定时器持久化）。
 */

import { parsePrivateWeChatConversationCharacterAndSession } from '../wechatConversationKey'

export type LumiTransferStatus = 'pending' | 'accepted' | 'returned'

export interface LumiTransferRecord {
  id: string
  amount: number
  remark?: string
  senderId: string
  receiverId: string
  status: LumiTransferStatus
  createdAt: number
  expiresAt: number
  acceptedAt?: number
  conversationKey: string
  messageId: string
}

const LS_KEY = 'wechat-lumi-transfers-v1'
/** 一次性：把「角色→用户」旧记录里与 conversationKey 不一致的 receiverId 改回会话身份，修复详情页不显示收款按钮 */
const RECEIVER_FIX_FLAG_KEY = 'wechat-lumi-transfers-receiver-fix-v1'

function markReceiverFixMigrationDone(): void {
  try {
    localStorage.setItem(RECEIVER_FIX_FLAG_KEY, '1')
  } catch {
    /* ignore */
  }
}

function migratePendingReceiverIdFromConversationKeyOnce(): void {
  if (typeof window === 'undefined') return
  try {
    if (localStorage.getItem(RECEIVER_FIX_FLAG_KEY) === '1') return
  } catch {
    return
  }
  let list: LumiTransferRecord[] = []
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) {
      markReceiverFixMigrationDone()
      return
    }
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) {
      markReceiverFixMigrationDone()
      return
    }
    list = parsed.filter((x): x is LumiTransferRecord => isRecord(x))
  } catch {
    markReceiverFixMigrationDone()
    return
  }
  let changed = false
  for (const t of list) {
    if (t.status !== 'pending') continue
    const parts = parsePrivateWeChatConversationCharacterAndSession(t.conversationKey)
    if (!parts) continue
    if (t.senderId === parts.characterId && t.receiverId !== parts.sessionPlayerId) {
      t.receiverId = parts.sessionPlayerId
      changed = true
    }
  }
  if (changed) {
    writeAll(list)
  }
  markReceiverFixMigrationDone()
}

function readAll(): LumiTransferRecord[] {
  migratePendingReceiverIdFromConversationKeyOnce()
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is LumiTransferRecord => isRecord(x))
  } catch {
    return []
  }
}

function isRecord(x: unknown): x is LumiTransferRecord {
  if (!x || typeof x !== 'object') return false
  const r = x as Record<string, unknown>
  return (
    typeof r.id === 'string' &&
    typeof r.amount === 'number' &&
    typeof r.senderId === 'string' &&
    typeof r.receiverId === 'string' &&
    (r.status === 'pending' || r.status === 'accepted' || r.status === 'returned') &&
    typeof r.createdAt === 'number' &&
    typeof r.expiresAt === 'number' &&
    typeof r.conversationKey === 'string' &&
    typeof r.messageId === 'string'
  )
}

function writeAllWithoutEmit(list: LumiTransferRecord[]): void {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(list))
  } catch {
    /* ignore quota */
  }
}

function writeAll(list: LumiTransferRecord[]): void {
  writeAllWithoutEmit(list)
  emitLumiTransferChanged()
}

export function emitLumiTransferChanged(): void {
  if (typeof window === 'undefined') return
  window.dispatchEvent(new CustomEvent('lumi-transfer-changed'))
}

/** 将仍 pending 且已过期的记录标记为 returned */
export function evaluateExpiredTransfers(getCurrentTime: () => number): void {
  const now = getCurrentTime()
  const list = readAll()
  let changed = false
  for (const t of list) {
    if (t.status === 'pending' && now >= t.expiresAt) {
      t.status = 'returned'
      changed = true
    }
  }
  if (changed) writeAll(list)
}

export function getLumiTransferFresh(id: string, getCurrentTime: () => number): LumiTransferRecord | null {
  const tid = id.trim()
  if (!tid) return null
  evaluateExpiredTransfers(getCurrentTime)
  return readAll().find((x) => x.id === tid) ?? null
}

export function upsertLumiTransfer(record: LumiTransferRecord): void {
  const list = readAll()
  const i = list.findIndex((x) => x.id === record.id)
  if (i >= 0) list[i] = record
  else list.push(record)
  writeAll(list)
}

export function acceptLumiTransfer(
  transferId: string,
  getCurrentTime: () => number,
  opts?: { emitChanged?: boolean },
): boolean {
  evaluateExpiredTransfers(getCurrentTime)
  const list = readAll()
  const t = list.find((x) => x.id === transferId.trim())
  if (!t || t.status !== 'pending') return false
  t.status = 'accepted'
  t.acceptedAt = getCurrentTime()
  if (opts?.emitChanged === false) {
    writeAllWithoutEmit(list)
  } else {
    writeAll(list)
  }
  return true
}

/** 收款方主动退还/拒收（pending 才允许） */
export function returnLumiTransfer(transferId: string, getCurrentTime: () => number): boolean {
  evaluateExpiredTransfers(getCurrentTime)
  const list = readAll()
  const t = list.find((x) => x.id === transferId.trim())
  if (!t || t.status !== 'pending') return false
  t.status = 'returned'
  writeAll(list)
  return true
}

/**
 * 重新回复：撤销「用户→当前会话角色」且已标记收款的转账，回到待收款（仅私聊语义下的 sender/receiver 对齐）。
 */
export function resetAcceptedIncomingPlayerTransfersForConversationPeer(params: {
  conversationKey: string
  playerIdentityId: string
  peerCharacterId: string
}): boolean {
  const ck = params.conversationKey.trim()
  const pid = params.playerIdentityId.trim()
  const cid = params.peerCharacterId.trim()
  if (!ck || !pid || !cid || pid === '__none__') return false
  const list = readAll()
  let changed = false
  for (const t of list) {
    if (t.conversationKey !== ck) continue
    if (t.status !== 'accepted') continue
    if (t.senderId !== pid || t.receiverId !== cid) continue
    t.status = 'pending'
    delete t.acceptedAt
    changed = true
  }
  if (changed) writeAll(list)
  return changed
}

export function listLumiTransfersForPlayer(playerIdentityId: string): LumiTransferRecord[] {
  const pid = playerIdentityId.trim()
  if (!pid) return []
  return readAll().filter((x) => x.senderId === pid || x.receiverId === pid)
}
