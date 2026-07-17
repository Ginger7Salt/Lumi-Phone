import {
  extractStoryTimelineRowKeywordsFromRowText,
  normalizeStoryTimelineRowKeyword,
  normalizeStoryTimelineRowKeywords,
  normalizeStoryTimelineRowTitle,
} from './storyTimelineTypes'

export type OnlineMemorySummaryKeywordMeta = {
  rowKeywords?: string[]
  memoryTriggerCategory?: string
  memoryTriggerPrecise?: string
  memoryTriggerEmotionNeed?: string[]
  memorySupplementKeywords?: string[]
  content?: string
}

/** 线上总结入库正文：与线下摘要表一致的标题 / 关键词 / 正文结构。 */
export function formatOnlineMemorySummaryStorageBody(
  body: string,
  meta?: { rowTitle?: string; rowKeywords?: string[]; storyTimeLabel?: string },
): string {
  const lines: string[] = []
  const title = normalizeStoryTimelineRowTitle(meta?.rowTitle)
  const kws = normalizeStoryTimelineRowKeywords(meta?.rowKeywords)
  const storyTime = String(meta?.storyTimeLabel ?? '').trim()
  const core = String(body ?? '').trim()
  if (title) lines.push(`【摘要标题】${title}`)
  if (storyTime) lines.push(`【剧情时间】${storyTime}`)
  if (kws.length) lines.push(`【摘要关键词】${kws.join('、')}`)
  if (core) lines.push(`【摘要正文】\n${core}`)
  return (lines.join('\n') || core).slice(0, 4000)
}

/** 从模型 JSON 各字段（含旧版 category / keywords 别名）合并出摘要检索词。 */
export function resolveMemorySummaryRowKeywordsFromParsed(
  meta?: OnlineMemorySummaryKeywordMeta,
): string[] {
  const direct = normalizeStoryTimelineRowKeywords(meta?.rowKeywords)
  if (direct.length) return direct
  const fromLegacy = onlineMemoryKeywordsFromSummary(meta)
  const normalized = normalizeStoryTimelineRowKeywords(fromLegacy)
  if (normalized.length) return normalized
  const body = String(meta?.content ?? '').trim()
  return body ? extractStoryTimelineRowKeywordsFromRowText(body) : []
}

export function onlineMemoryKeywordsFromSummary(meta?: OnlineMemorySummaryKeywordMeta): string[] | undefined {
  const rowKws = normalizeStoryTimelineRowKeywords(meta?.rowKeywords)
  if (rowKws.length) return rowKws
  const legacy: string[] = []
  const cat = normalizeStoryTimelineRowKeyword(meta?.memoryTriggerCategory)
  if (cat) legacy.push(cat)
  const precise = String(meta?.memoryTriggerPrecise ?? '')
    .replace(/\s+/g, '')
    .trim()
    .slice(0, 10)
  if (precise) legacy.push(precise)
  for (const e of meta?.memoryTriggerEmotionNeed ?? []) {
    const t = normalizeStoryTimelineRowKeyword(e)
    if (t) legacy.push(t)
  }
  for (const e of meta?.memorySupplementKeywords ?? []) {
    const t = String(e ?? '').replace(/\s+/g, '').trim().slice(0, 16)
    if (t) legacy.push(t)
  }
  const seen = new Set<string>()
  const out: string[] = []
  for (const kw of legacy) {
    const key = kw.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(kw)
  }
  return out.length ? out : undefined
}
