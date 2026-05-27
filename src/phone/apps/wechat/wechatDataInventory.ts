import { countWeChatPersonaCoreStoreRecords } from '../dataArchive/scanWeChatPersonaIndexedDb'
import { personaDb, pullPhoneKvWithLocalStorageLegacy } from './newFriendsPersona/idb'
import { loadAccountsBundle } from './wechatAccountPersistence'
import {
  markWeChatHadCoreData,
  WECHAT_HAD_CORE_DATA_LS_KEY,
} from './wechatLocalDataHealth'

export const WECHAT_DATA_INVENTORY_KV_KEY = 'lumi-wechat-data-inventory-v1'

const MAX_CLEAR_LOG = 100

/** 用户主动、会改变本地微信数据量的操作 */
export type WeChatUserDataClearOp =
  | 'erase_account_completely'
  | 'erase_bundle_account'
  | 'delete_character_persona'
  | 'delete_character_full'
  | 'delete_character_scoped'
  | 'clear_conversation_messages'
  | 'clear_conversation_ui_only'

export type WeChatDataInventorySnapshot = {
  at: number
  accountCount: number
  characters: number
  chatMessages: number
  bundleContactCount: number
}

export type WeChatUserDataClearRecord = {
  op: WeChatUserDataClearOp
  at: number
  wechatAccountId?: string
  characterId?: string
  conversationKey?: string
  note?: string
}

export type WeChatDataInventoryLedger = {
  version: 1
  baseline: WeChatDataInventorySnapshot | null
  /** 用户主动清空至「无核心数据」后标记；不再报 missing */
  intentionallyEmptySince: number | null
  userClears: WeChatUserDataClearRecord[]
}

const FULL_ERASE_OPS: WeChatUserDataClearOp[] = [
  'erase_account_completely',
  'erase_bundle_account',
]

function emptyLedger(): WeChatDataInventoryLedger {
  return { version: 1, baseline: null, intentionallyEmptySince: null, userClears: [] }
}

function normalizeLedger(raw: unknown): WeChatDataInventoryLedger {
  if (!raw || typeof raw !== 'object') return emptyLedger()
  const o = raw as Record<string, unknown>
  const baselineRaw = o.baseline
  let baseline: WeChatDataInventorySnapshot | null = null
  if (baselineRaw && typeof baselineRaw === 'object') {
    const b = baselineRaw as Record<string, unknown>
    baseline = {
      at: typeof b.at === 'number' ? b.at : Date.now(),
      accountCount: typeof b.accountCount === 'number' ? b.accountCount : 0,
      characters: typeof b.characters === 'number' ? b.characters : 0,
      chatMessages: typeof b.chatMessages === 'number' ? b.chatMessages : 0,
      bundleContactCount: typeof b.bundleContactCount === 'number' ? b.bundleContactCount : 0,
    }
  }
  const userClears: WeChatUserDataClearRecord[] = []
  if (Array.isArray(o.userClears)) {
    for (const row of o.userClears) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const op = r.op
      if (typeof op !== 'string') continue
      userClears.push({
        op: op as WeChatUserDataClearOp,
        at: typeof r.at === 'number' ? r.at : Date.now(),
        wechatAccountId: typeof r.wechatAccountId === 'string' ? r.wechatAccountId : undefined,
        characterId: typeof r.characterId === 'string' ? r.characterId : undefined,
        conversationKey: typeof r.conversationKey === 'string' ? r.conversationKey : undefined,
        note: typeof r.note === 'string' ? r.note : undefined,
      })
    }
  }
  return {
    version: 1,
    baseline,
    intentionallyEmptySince:
      typeof o.intentionallyEmptySince === 'number' ? o.intentionallyEmptySince : null,
    userClears: userClears.slice(-MAX_CLEAR_LOG),
  }
}

export async function loadWeChatDataInventoryLedger(): Promise<WeChatDataInventoryLedger> {
  try {
    const raw = await pullPhoneKvWithLocalStorageLegacy(WECHAT_DATA_INVENTORY_KV_KEY, [
      WECHAT_DATA_INVENTORY_KV_KEY,
    ])
    return normalizeLedger(raw)
  } catch {
    return emptyLedger()
  }
}

async function persistWeChatDataInventoryLedger(ledger: WeChatDataInventoryLedger): Promise<void> {
  const trimmed: WeChatDataInventoryLedger = {
    ...ledger,
    userClears: ledger.userClears.slice(-MAX_CLEAR_LOG),
  }
  await personaDb.setPhoneKv(WECHAT_DATA_INVENTORY_KV_KEY, trimmed)
  try {
    localStorage.setItem(WECHAT_DATA_INVENTORY_KV_KEY, JSON.stringify(trimmed))
  } catch {
    // ignore
  }
}

export function clearWeChatHadCoreDataFlag(): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.removeItem(WECHAT_HAD_CORE_DATA_LS_KEY)
  } catch {
    // ignore
  }
}

export async function captureWeChatDataInventorySnapshot(): Promise<WeChatDataInventorySnapshot> {
  const bundle = await loadAccountsBundle()
  const { chatMessages, characters } = await countWeChatPersonaCoreStoreRecords()
  return {
    at: Date.now(),
    accountCount: bundle?.accounts.length ?? 0,
    characters,
    chatMessages,
    bundleContactCount: bundle?.accounts.reduce((n, a) => n + a.personaContacts.length, 0) ?? 0,
  }
}

/** 在「有数据」或检测通过时刷新基线快照 */
export async function syncWeChatDataInventoryBaseline(): Promise<void> {
  const snap = await captureWeChatDataInventorySnapshot()
  const ledger = await loadWeChatDataInventoryLedger()
  ledger.baseline = snap
  if (snap.characters > 0 || snap.chatMessages > 0) {
    ledger.intentionallyEmptySince = null
    markWeChatHadCoreData()
  }
  await persistWeChatDataInventoryLedger(ledger)
}

/**
 * 记录用户主动清除；操作完成后应用当前库计数更新基线。
 * 整号/全库注销会标记 intentionallyEmpty，健康检测不再报 missing。
 */
export async function recordUserWeChatDataClear(
  op: WeChatUserDataClearOp,
  meta?: {
    wechatAccountId?: string
    characterId?: string
    conversationKey?: string
    note?: string
  },
): Promise<void> {
  const ledger = await loadWeChatDataInventoryLedger()
  ledger.userClears.push({
    op,
    at: Date.now(),
    wechatAccountId: meta?.wechatAccountId?.trim() || undefined,
    characterId: meta?.characterId?.trim() || undefined,
    conversationKey: meta?.conversationKey?.trim() || undefined,
    note: meta?.note?.trim() || undefined,
  })

  if (FULL_ERASE_OPS.includes(op)) {
    ledger.intentionallyEmptySince = Date.now()
    clearWeChatHadCoreDataFlag()
  }

  const snap = await captureWeChatDataInventorySnapshot()
  ledger.baseline = snap
  if (snap.characters === 0 && snap.chatMessages === 0) {
    if (FULL_ERASE_OPS.includes(op)) {
      ledger.intentionallyEmptySince = Date.now()
      clearWeChatHadCoreDataFlag()
    } else if (
      op === 'delete_character_full' ||
      op === 'delete_character_persona' ||
      op === 'delete_character_scoped'
    ) {
      ledger.intentionallyEmptySince = Date.now()
      clearWeChatHadCoreDataFlag()
    }
  } else {
    ledger.intentionallyEmptySince = null
  }

  await persistWeChatDataInventoryLedger(ledger)
}

function userClearExplainsEmptySinceBaseline(ledger: WeChatDataInventoryLedger): boolean {
  const base = ledger.baseline
  if (!base) return false
  if (base.characters > 0 || base.chatMessages > 0) {
    return ledger.userClears.some((c) => c.at >= base.at)
  }
  return false
}

export function isWeChatIntentionallyEmpty(ledger: WeChatDataInventoryLedger): boolean {
  if (ledger.intentionallyEmptySince != null) return true
  const base = ledger.baseline
  if (!base) return false
  if (base.characters === 0 && base.chatMessages === 0 && base.accountCount > 0) {
    return ledger.userClears.some((c) => c.at >= base.at)
  }
  return false
}

export { userClearExplainsEmptySinceBaseline }
