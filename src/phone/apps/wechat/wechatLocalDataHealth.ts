import {
  captureWeChatDataInventorySnapshot,
  isWeChatIntentionallyEmpty,
  loadWeChatDataInventoryLedger,
  syncWeChatDataInventoryBaseline,
  userClearExplainsEmptySinceBaseline,
} from './wechatDataInventory'
import { loadAccountsBundle } from './wechatAccountPersistence'

/** 本机曾写入过微信聊天/人设（兼容旧逻辑；新逻辑以 inventory 基线为准） */
export const WECHAT_HAD_CORE_DATA_LS_KEY = 'lumi-wechat-had-core-data-v1'

export type WeChatLocalDataHealthStatus =
  | 'ok'
  | 'missing'
  | 'no_account'
  | 'empty_idb'
  | 'cleared_by_user'

export type WeChatLocalDataHealthReport = {
  status: WeChatLocalDataHealthStatus
  accountCount: number
  chatMessages: number
  characters: number
  bundleContactCount: number
  hadCoreDataBefore: boolean
  summary: string
  detail: string
}

export function markWeChatHadCoreData(): void {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(WECHAT_HAD_CORE_DATA_LS_KEY, '1')
  } catch {
    // ignore
  }
}

function readWeChatHadCoreDataFlag(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.localStorage.getItem(WECHAT_HAD_CORE_DATA_LS_KEY) === '1'
  } catch {
    return false
  }
}

function baselineHadCoreData(ledger: Awaited<ReturnType<typeof loadWeChatDataInventoryLedger>>): boolean {
  const b = ledger.baseline
  if (b && (b.characters > 0 || b.chatMessages > 0)) return true
  return readWeChatHadCoreDataFlag()
}

/** 数据中心手动检测：对比基线快照与用户主动清除记录，仅对「非主动丢失」报 missing */
export async function runWeChatLocalDataHealthCheck(): Promise<WeChatLocalDataHealthReport> {
  const bundle = await loadAccountsBundle()
  const accountCount = bundle?.accounts.length ?? 0
  const ledger = await loadWeChatDataInventoryLedger()
  const hadCoreDataBefore = baselineHadCoreData(ledger)

  if (!accountCount) {
    return {
      status: 'no_account',
      accountCount: 0,
      chatMessages: 0,
      characters: 0,
      bundleContactCount: 0,
      hadCoreDataBefore,
      summary: '未检测到微信账号',
      detail: '请先在微信中完成注册或登录后再检测。',
    }
  }

  const current = await captureWeChatDataInventorySnapshot()
  const { chatMessages, characters, bundleContactCount } = current

  if (chatMessages > 0 || characters > 0) {
    await syncWeChatDataInventoryBaseline()
    return {
      status: 'ok',
      accountCount,
      chatMessages,
      characters,
      bundleContactCount,
      hadCoreDataBefore: true,
      summary: '本地微信数据正常',
      detail: `IndexedDB 中约有 ${characters} 条人设、${chatMessages} 条聊天记录索引。若微信列表仍为空，可点「尝试自动恢复」或返回微信刷新。`,
    }
  }

  if (isWeChatIntentionallyEmpty(ledger)) {
    return {
      status: 'cleared_by_user',
      accountCount,
      chatMessages,
      characters,
      bundleContactCount,
      hadCoreDataBefore,
      summary: '当前为空（记录为用户主动清除）',
      detail:
        '系统记录到您曾在本机主动删除或注销微信相关数据，当前 IndexedDB 为空属预期结果，不视为意外丢失。若需找回，请使用曾导出的 .lumi 备份导入。',
    }
  }

  if (userClearExplainsEmptySinceBaseline(ledger)) {
    return {
      status: 'cleared_by_user',
      accountCount,
      chatMessages,
      characters,
      bundleContactCount,
      hadCoreDataBefore,
      summary: '当前为空（与主动清除记录一致）',
      detail:
        '检测到您在基线快照之后执行过删除/清空操作，当前无人设与聊天记录不判为意外丢失。若有 .lumi 备份仍可导入恢复。',
    }
  }

  const base = ledger.baseline
  if (base && (base.characters > 0 || base.chatMessages > 0)) {
    return {
      status: 'missing',
      accountCount,
      chatMessages,
      characters,
      bundleContactCount,
      hadCoreDataBefore,
      summary: '检测到本地微信数据可能已意外丢失',
      detail: `上次记录约 ${base.characters} 条人设、${base.chatMessages} 条聊天索引，当前均为 0，且未发现对应的主动清除记录。可先「尝试自动恢复」；若失败且曾导出 .lumi，请用备份导入。`,
    }
  }

  const multiAccount = accountCount > 1
  const hasBundleContacts = bundleContactCount > 0
  if (hadCoreDataBefore || hasBundleContacts || multiAccount) {
    return {
      status: 'missing',
      accountCount,
      chatMessages,
      characters,
      bundleContactCount,
      hadCoreDataBefore,
      summary: '检测到本地微信数据可能已丢失',
      detail:
        '账号信息可能仍在，但聊天记录与人设库为空，且未记录到您在本应用内的主动清除操作。可先「尝试自动恢复」；若失败且曾导出过 .lumi，请用备份导入。',
    }
  }

  return {
    status: 'empty_idb',
    accountCount,
    chatMessages,
    characters,
    bundleContactCount,
    hadCoreDataBefore,
    summary: 'IndexedDB 中暂无微信聊天与人设',
    detail: '若为新账号且尚未添加角色或聊天，可忽略。若此前使用过微信，请检查浏览器与网址是否一致，或尝试从 .lumi 备份恢复。',
  }
}
