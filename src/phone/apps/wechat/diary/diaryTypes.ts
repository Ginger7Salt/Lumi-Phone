export interface DiaryEntry {
  id: string
  title: string
  /** 剧情内的时间流（非现实生成时间） */
  inUniverseTime: string
  content: string
  createdAt: number
}

export interface CharacterDiaryBook {
  charId: string
  /** 永久绑定的字体 CSS font-family 名 */
  fontFamily: string | null
  /** 重置字体后暂存旧笔迹，用于下次绑定时尽量避开同款 */
  fontRebindAvoid?: string | null
  /** 自动记录频率（毫秒）；0 表示关闭 */
  autoWriteInterval: number
  lastWrittenAt: number
  entries: DiaryEntry[]
}

export type DiaryFontStyleCode = 'sharp' | 'neat' | 'lazy' | 'elegant' | 'wild'

/** 日记正文生成字数下限（prompt 用） */
export const DIARY_CONTENT_MIN_CHARS = 600
/** 日记正文生成字数上限 */
export const DIARY_CONTENT_MAX_CHARS = 1500

/** 同次请求生成的长期记忆摘要（摘要表结构，非日记原文） */
export type DiaryMemorySummary = {
  rowTitle: string
  rowKeywords: string[]
  content: string
}

export type DiaryAiResult = {
  title: string
  inUniverseTime: string
  content: string
  font_style?: DiaryFontStyleCode
  memorySummary: DiaryMemorySummary
}

export type DiaryAccountData = {
  books: Record<string, CharacterDiaryBook>
}

export type DiaryPersistedRoot = {
  byAccount: Record<string, DiaryAccountData>
}

export const DIARY_KV_KEY = 'wechat-subconscious-archives-v1'

export const DIARY_AUTO_INTERVAL_PRESETS = [
  { label: '关闭自动', ms: 0 },
  { label: '每 6 小时', ms: 6 * 60 * 60 * 1000 },
  { label: '每 12 小时', ms: 12 * 60 * 60 * 1000 },
  { label: '每 1 天', ms: 24 * 60 * 60 * 1000 },
  { label: '每 3 天', ms: 72 * 60 * 60 * 1000 },
] as const
