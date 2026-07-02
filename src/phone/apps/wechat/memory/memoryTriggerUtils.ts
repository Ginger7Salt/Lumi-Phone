import type { CharacterMemory } from '../newFriendsPersona/types'
import { extractStoryTimelineRowKeywordsFromRowText } from './storyTimelineTypes'

/** 单角色注入时「始终触发」类记忆条数上限，防止 token 失控 */
export const MEMORY_ALWAYS_INJECT_CAP = 28

/**
 * 用户手动填写 / 从存储读出的触发词字符串：仅 trim + 空白折叠，**不做字数截断**。
 * 「≤5 字 / ≤10 字」等约束只用于自动总结模型输出（见 `clampModelMemoryTrigger*`）。
 */
export function trimMemoryTriggerText(raw: string | undefined | null): string | undefined {
  const t = String(raw ?? '').replace(/\s+/g, ' ').trim()
  return t || undefined
}

/** 参与「触发词合并」的字段子集（记忆行或自动总结结果均可） */
export type MemoryTriggerPhraseSource = Pick<
  CharacterMemory,
  'memoryTriggerCategory' | 'memoryTriggerPrecise' | 'memoryTriggerEmotionNeed' | 'memoryKeywords' | 'content'
>

/**
 * 合并「模型侧字段 + 用户关键词」为一条短语列表（去重、保序），供列表摘要展示与手动编辑弹窗初始值。
 * 用户界面不区分来源，只当作一组关键词。
 */
export function flattenMemoryTriggerKeywords(m: MemoryTriggerPhraseSource): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const push = (s?: string | null) => {
    const t = String(s ?? '').replace(/\s+/g, ' ').trim()
    if (!t || seen.has(t)) return
    seen.add(t)
    out.push(t)
  }
  push(m.memoryTriggerCategory)
  push(m.memoryTriggerPrecise)
  for (const e of m.memoryTriggerEmotionNeed ?? []) push(e)
  for (const k of m.memoryKeywords ?? []) push(k)
  if (!out.length && m.content) {
    for (const k of extractStoryTimelineRowKeywordsFromRowText(m.content)) push(k)
  }
  return out
}

/** 从 IDB 读入的情绪/需求数组：逐项 trim，不做条数或单条字数截断 */
export function normalizeStoredMemoryEmotionNeedList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = (raw as unknown[])
    .map((x) => String(x ?? '').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
  return out.length ? out : undefined
}

/**
 * 码点级上限截断后：尽量落在句读处，并去掉常见「半截叙述」尾字，减少模型超长句被硬砍成「既不像关键词也不像句子」的残片。
 * 仅用于自动总结入库前的规范化。
 */
function smartTruncateChineseKeyword(raw: string, maxChars: number): string {
  const normalized = String(raw ?? '').replace(/\s+/g, ' ').trim()
  if (!normalized) return ''
  const chars = [...normalized]
  if (chars.length <= maxChars) return normalized
  let slice = chars.slice(0, maxChars).join('')
  const puncts = new Set(['，', '。', '；', '、', ',', ';', '·', '\n'])
  for (let i = slice.length - 1; i >= 2; i--) {
    if (puncts.has(slice[i]!)) {
      slice = slice.slice(0, i + 1).trimEnd()
      break
    }
  }
  const badEndRe = /[在为与及和的地得被把给从我以于是着了的呀吧呢吗嘛嘛哪啥]$/
  while (slice.length > 3 && badEndRe.test(slice)) {
    slice = slice.slice(0, -1).trimEnd()
  }
  const out = slice.trim()
  if (out.length >= 2) return out
  return chars.slice(0, Math.min(6, maxChars)).join('').trim()
}

/** 仅自动总结模型 JSON：大分类 ≤5 字（与提示词一致） */
export function clampModelMemoryTriggerCategory(raw: string | undefined | null): string | undefined {
  const t = trimMemoryTriggerText(raw)
  if (!t) return undefined
  const seg = smartTruncateChineseKeyword(t, 5)
  return seg || undefined
}

/** 仅自动总结模型 JSON：精准词 ≤10 字（智能截断，减轻硬切残句） */
export function clampModelMemoryTriggerPrecise(raw: string | undefined | null): string | undefined {
  const t = trimMemoryTriggerText(raw)
  if (!t) return undefined
  const seg = smartTruncateChineseKeyword(t, 10)
  return seg || undefined
}

/** 仅自动总结模型 JSON：情绪/需求 最多 5 条、每条最多 10 字（偏短词，与提示词「2～8 字」一致） */
export function clampModelMemoryEmotionNeedList(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = (raw as unknown[])
    .map((x) =>
      String(x ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .map((s) => smartTruncateChineseKeyword(s, 10))
    .filter(Boolean)
    .slice(0, 5)
  return out.length ? out : undefined
}

/** 仅自动总结模型 JSON：补充触发短语至多 2 条、每条 ≤16 字（与提示词 4～16 字对齐；智能截断） */
export function clampModelMemorySupplementKeywords(raw: unknown): string[] | undefined {
  if (!Array.isArray(raw)) return undefined
  const out = (raw as unknown[])
    .map((x) =>
      String(x ?? '')
        .replace(/\s+/g, ' ')
        .trim(),
    )
    .filter(Boolean)
    .map((s) => smartTruncateChineseKeyword(s, 16))
    .filter(Boolean)
    .slice(0, 2)
  return out.length ? out : undefined
}

/**
 * 自动总结入库：先合并三维触发词，再并入模型给出的至多 2 条补充词（去重），写入 `memoryKeywords`。
 */
export function buildAutoSummaryMemoryKeywordsBackup(params: {
  memoryTriggerCategory?: string
  memoryTriggerPrecise?: string
  memoryTriggerEmotionNeed?: string[]
  memorySupplementKeywords?: string[]
}): string[] | undefined {
  const base = flattenMemoryTriggerKeywords({
    memoryTriggerCategory: params.memoryTriggerCategory,
    memoryTriggerPrecise: params.memoryTriggerPrecise,
    memoryTriggerEmotionNeed: params.memoryTriggerEmotionNeed,
    memoryKeywords: undefined,
    content: '',
  })
  const seen = new Set(base.map((x) => x.toLowerCase()))
  const out = [...base]
  for (const raw of params.memorySupplementKeywords ?? []) {
    const t = String(raw ?? '').replace(/\s+/g, ' ').trim()
    if (!t) continue
    const k = t.toLowerCase()
    if (seen.has(k)) continue
    out.push(t)
    seen.add(k)
  }
  return out.length ? out : undefined
}

/** 是否配置了任一关键词维度（含旧版扁平 memoryKeywords） */
export function memoryHasTriggerDimensions(m: CharacterMemory): boolean {
  if (trimMemoryTriggerText(m.memoryTriggerCategory)) return true
  if (trimMemoryTriggerText(m.memoryTriggerPrecise)) return true
  const em = m.memoryTriggerEmotionNeed
  if (Array.isArray(em) && em.some((x) => String(x ?? '').trim())) return true
  if ((m.memoryKeywords ?? []).some((x) => String(x ?? '').trim())) return true
  return false
}

export function isMemoryAlwaysTrigger(m: CharacterMemory): boolean {
  return m.memoryTriggerMode === 'always'
}

/**
 * 关键词模式：相关性文本是否命中「大分类 / 精准词 / 情绪需求 / 附加词」任一项（子串、小写化拉丁）。
 * 「始终触发」记忆请调用方单独并入，勿用本函数。
 */
export function memoryTriggerMatchesHaystack(m: CharacterMemory, hayLower: string): boolean {
  if (isMemoryAlwaysTrigger(m)) return false
  if (hayLower.length < 2) return false
  const cat = trimMemoryTriggerText(m.memoryTriggerCategory)
  if (cat && hayLower.includes(cat.toLowerCase())) return true
  const pre = trimMemoryTriggerText(m.memoryTriggerPrecise)
  if (pre && hayLower.includes(pre.toLowerCase())) return true
  for (const e of m.memoryTriggerEmotionNeed ?? []) {
    const t = String(e ?? '').trim()
    if (t && hayLower.includes(t.toLowerCase())) return true
  }
  for (const k of m.memoryKeywords ?? []) {
    const t = String(k ?? '').trim()
    if (t && hayLower.includes(t.toLowerCase())) return true
  }
  return false
}

/** 列表行/详情：一行展示触发配置摘要（不向用户展示「模型维度」文案，只合并为关键词） */
export function formatMemoryTriggerSummaryLine(m: CharacterMemory): string {
  if (isMemoryAlwaysTrigger(m)) return '触发：始终纳入参考'
  const words = flattenMemoryTriggerKeywords(m)
  if (words.length) return `触发：关键词「${words.join('、')}」`
  return '触发：关键词（尚未配置，走系统兜底策略）'
}
