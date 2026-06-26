import type { GlobalWechatWorldBook, GlobalWechatWorldBookScope } from './globalWorldBookTypes'
import { normalizeGlobalWechatWorldBookScope } from './globalWorldBookTypes'

export type { GlobalWechatWorldBookScope } from './globalWorldBookTypes'

/** 作用角色：全员，或指定通讯录中的 NPC id */
export type ArchiveCharacterScope =
  | { mode: 'all' }
  | { mode: 'characters'; ids: string[] }

/**
 * 档案室统一条目：原「档案法则」+ 原「微信全局世界书」条目合并为同一列表。
 * 每条可单独配置：生效板块、作用角色、标题与正文。
 */
export type ArchiveWorldbookEntry = {
  id: string
  title: string
  content: string
  /** 未写入时视为 true */
  enabled?: boolean
  /** 全部场景，或限定私聊/群聊/线下剧情/VN 等 */
  plateScope: GlobalWechatWorldBookScope
  characterScope: ArchiveCharacterScope
  updatedAt: number
}

/** 与 `ArchiveWorldbookEntry` 同形；保留旧名减少引用改动 */
export type LoreEntry = ArchiveWorldbookEntry

export function normalizeCharacterScope(raw: unknown): ArchiveCharacterScope {
  if (!raw || typeof raw !== 'object') return { mode: 'all' }
  const o = raw as Record<string, unknown>
  if (o.mode === 'characters' && Array.isArray(o.ids)) {
    const ids = o.ids.map((x) => String(x ?? '').trim()).filter(Boolean)
    return ids.length ? { mode: 'characters', ids: [...new Set(ids)] } : { mode: 'all' }
  }
  return { mode: 'all' }
}

export function normalizeArchiveEntryPartial(raw: Record<string, unknown>): ArchiveWorldbookEntry | null {
  const id = typeof raw.id === 'string' ? raw.id.trim() : ''
  if (!id) return null
  return {
    id,
    title: typeof raw.title === 'string' ? raw.title : '',
    content: typeof raw.content === 'string' ? raw.content : '',
    enabled: raw.enabled !== false,
    plateScope: normalizeGlobalWechatWorldBookScope(raw.plateScope),
    characterScope: normalizeCharacterScope(raw.characterScope),
    updatedAt: typeof raw.updatedAt === 'number' && Number.isFinite(raw.updatedAt) ? raw.updatedAt : Date.now(),
  }
}

/** v1 仅法则条目 */
export type LoreArchiveStoreShape = {
  entries: LoreEntry[]
}

/** v2：法则条目 + 微信全局世界书（多本）；微博占位 */
export type LoreArchiveStoreShapeV2 = {
  version: 2
  entries: Array<{
    id: string
    title: string
    content: string
    isGlobal: boolean
    targetIds: string[]
    updatedAt: number
  }>
  wechat?: {
    worldBooks: GlobalWechatWorldBook[]
  }
  weibo?: { _reserved: true }
}

import type { LoreArchiveBuiltinPresetToggles } from './loreArchiveBuiltinPresets'

/** v3：统一条目（板块 + 角色） */
export type LoreArchiveStoreShapeV3 = {
  version: 3
  entries: ArchiveWorldbookEntry[]
  /** 系统内置预设开关；未写入时默认全部开启 */
  builtinPresets?: LoreArchiveBuiltinPresetToggles
  weibo?: { _reserved: true }
}
