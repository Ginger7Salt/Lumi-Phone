import type { WorldBookAfterPatch } from '../newFriendsPersona/worldBookAfterPatch'
import {
  normalizeStoryTimelineRowKeywords,
  normalizeStoryTimelineRowTitle,
  parseStoryTimelineSummaryDelta,
  type StoryTimelineSummaryDelta,
} from './storyTimelineTypes'

/** 避免与 wechatChatAi 循环依赖：与 MemoryAutoSummaryResult 字段兼容 */
export type MemorySummaryMarkupFields = {
  content: string
  rowTitle?: string
  rowKeywords?: string[]
  memoryTriggerCategory?: string
  memoryTriggerPrecise?: string
  memoryTriggerEmotionNeed?: string[]
  memorySupplementKeywords?: string[]
  timeline?: StoryTimelineSummaryDelta
}

export type LinkedMemoryMarkupEntry = MemorySummaryMarkupFields & { characterId: string }

export type UnifiedMemoryMarkupResult = {
  primary: MemorySummaryMarkupFields
  linked: LinkedMemoryMarkupEntry[]
  epiloguePatches?: WorldBookAfterPatch[]
}

/** 约会同轮回复末尾：稳定 markup 分隔符（替换旧 JSON 分隔符） */
export const DATING_UNIFIED_MEMORY_MARKUP_DELIMITER = '<<<DATING_UNIFIED_MEMORY>>>'

/** 兼容旧版 JSON 分隔符 */
export const DATING_UNIFIED_MEMORY_JSON_DELIMITER_LEGACY = '<<<DATING_UNIFIED_MEMORY_JSON>>>'

export const STORY_TIMELINE_SUMMARY_MARKUP_FIELDS = `
【时间轴字段 · 写在 [TIMELINE] 块内，每行「字段名：值」】
标题：（4～10 字短标题）
关键词：（3～5 个，顿号「、」分隔，每条 ≤5 字）
事件：（本轮关键事件摘要，约 80～100 字）
地点：（具体地点，含店名/楼层/区域，禁止仅写「饭馆」「酒店」等类名）
故事日：（含年份公历日，如 2025年10月1日）
时刻：（24h，如 19:30）
结束故事日：（可选）
结束时刻：（可选）
相对时间：（可选，如 约会第3天）
在场：（占位符，顿号分隔，如 {{user}}、{{char}}）
侧幕：（是/否；侧幕叙写时填「是」，且在场不得含 {{char}}）
服装：（可多行，每行「占位符｜具体穿着描述」）
物品：（可多行，每行「名称｜备注｜normal/important/critical」）
伏笔：（可多行，每行「文本｜open/resolved」；须为结尾快照）
待办：（可多行，每行「文本｜open/resolved」；须为结尾快照）
`.trim()

export const UNIFIED_MEMORY_LINKED_MARKUP_RULE = `
【输出格式】禁止 JSON、禁止 markdown 代码围栏、禁止前后解释。只输出下列 markup 块（可按需省略无内容的块）：

[PRIMARY]
标题：（4～10 字）
关键词：（3～5 个，顿号「、」分隔）
分类：（可选，≤5 字）
精准：（可选，≤10 字）
情绪：（可选，顿号分隔）
正文：
（第三人称备忘；本轮非总结间隔时可留空；写人时用 {{user}}/{{char}}/{{archive_char}}/{{id:UUID}}）

[TIMELINE]
（primary 本轮时间轴增量；字段见下方说明；每轮尽量填写）

[LINKED]
character_id：（仅可关联角色 id 表中的 id）
标题：（4～10 字）
关键词：（3～5 个，顿号分隔）
正文：
（第三人称；指称规则同 primary）

[TIMELINE]
（该 linked 角色本轮时间轴；线下摘要表须含标题/关键词/事件）

[EPILOGUE_PATCH]
character_id：
world_book_id：
item_id：
new_content：
（可多条 EPILOGUE_PATCH）

规则：
- linked 的 character_id 只能来自 id 表；勿把当前约会对象写进 linked（应写 primary）。
- 不要在正文里写 [私聊]/[线下] 前缀。
- 可重复 [LINKED]…[TIMELINE] 组合；每个 LINKED 后的 TIMELINE 归属该 LINKED。
${STORY_TIMELINE_SUMMARY_MARKUP_FIELDS}
`.trim()

function stripFences(raw: string): string {
  return String(raw ?? '')
    .replace(/^```(?:[\w-]*)?\s*\n?/i, '')
    .replace(/\n?```\s*$/i, '')
    .trim()
}

function fieldLine(block: string, keys: string[]): string {
  const lines = block.split(/\r?\n/)
  for (const key of keys) {
    const re = new RegExp(`^\\s*${key}\\s*[:：]\\s*(.*)$`, 'i')
    for (const line of lines) {
      const m = re.exec(line.trim())
      if (!m) continue
      return (m[1] ?? '').trim()
    }
  }
  return ''
}

function multilineAfter(block: string, keys: string[]): string {
  const lines = block.split(/\r?\n/)
  const keyRe = new RegExp(`^\\s*(?:${keys.join('|')})\\s*[:：]\\s*(.*)$`, 'i')
  const stopRe =
    /^\s*(?:标题|关键词|分类|精准|情绪|正文|地点|故事日|时刻|结束故事日|结束时刻|相对时间|在场|侧幕|服装|物品|伏笔|待办|事件|character_id|world_book_id|item_id|new_content)\s*[:：]/i
  for (let i = 0; i < lines.length; i++) {
    const m = keyRe.exec(lines[i]!.trim())
    if (!m) continue
    const parts: string[] = []
    const first = (m[1] ?? '').trim()
    if (first) parts.push(first)
    for (let j = i + 1; j < lines.length; j++) {
      const raw = lines[j]!
      const t = raw.trim()
      if (!t) {
        parts.push('')
        continue
      }
      if (stopRe.test(t) && !keyRe.test(t)) break
      parts.push(raw)
    }
    return parts.join('\n').replace(/\n+$/g, '').trim()
  }
  return ''
}

function parseKeywords(raw: string): string[] {
  return normalizeStoryTimelineRowKeywords(
    raw
      .split(/[,，、;；|/]+/)
      .map((x) => x.trim())
      .filter(Boolean),
  )
}

function parsePipeRows(block: string, keys: string[]): string[] {
  const body = multilineAfter(block, keys)
  if (!body) return []
  return body
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-*•]\s*/, '').trim())
    .filter(Boolean)
}

export function parseTimelineMarkupFromBlock(block: string): StoryTimelineSummaryDelta | undefined {
  return parseTimelineMarkup(block)
}

function parseTimelineMarkup(block: string): StoryTimelineSummaryDelta | undefined {
  const row_title = normalizeStoryTimelineRowTitle(fieldLine(block, ['标题', 'row_title', 'rowTitle']))
  const row_keywords = parseKeywords(fieldLine(block, ['关键词', 'row_keywords', 'keywords']))
  const event_summary = fieldLine(block, ['事件', 'event_summary', 'eventSummary']) || multilineAfter(block, ['事件'])
  const location = fieldLine(block, ['地点', 'location'])
  const story_day = fieldLine(block, ['故事日', 'story_day', 'storyDay'])
  const story_time = fieldLine(block, ['时刻', 'story_time', 'storyTime'])
  const story_day_end = fieldLine(block, ['结束故事日', 'story_day_end', 'storyDayEnd'])
  const story_time_end = fieldLine(block, ['结束时刻', 'story_time_end', 'storyTimeEnd'])
  const relative_time = fieldLine(block, ['相对时间', 'relative_time', 'relativeTime'])
  const presentRaw = fieldLine(block, ['在场', 'characters_present', 'charactersPresent'])
  const sideRaw = fieldLine(block, ['侧幕', 'side_perspective', 'sidePerspective'])

  const costumes: Record<string, string> = {}
  for (const row of parsePipeRows(block, ['服装', 'costumes'])) {
    const [k, ...rest] = row.split(/[｜|]/)
    const key = (k ?? '').trim()
    const val = rest.join('｜').trim()
    if (key && val) costumes[key] = val
  }

  const items: Array<{ name: string; note?: string; tier?: string }> = []
  for (const row of parsePipeRows(block, ['物品', 'items'])) {
    const parts = row.split(/[｜|]/).map((x) => x.trim())
    if (!parts[0]) continue
    items.push({
      name: parts[0],
      ...(parts[1] ? { note: parts[1] } : {}),
      ...(parts[2] ? { tier: parts[2] } : {}),
    })
  }

  const foreshadows: Array<{ text: string; status: string }> = []
  for (const row of parsePipeRows(block, ['伏笔', 'foreshadows'])) {
    const parts = row.split(/[｜|]/).map((x) => x.trim())
    if (!parts[0]) continue
    foreshadows.push({ text: parts[0], status: parts[1] || 'open' })
  }

  const todos: Array<{ text: string; status: string }> = []
  for (const row of parsePipeRows(block, ['待办', 'todos'])) {
    const parts = row.split(/[｜|]/).map((x) => x.trim())
    if (!parts[0]) continue
    todos.push({ text: parts[0], status: parts[1] || 'open' })
  }

  const rawObj: Record<string, unknown> = {
    ...(row_title ? { row_title } : {}),
    ...(row_keywords.length ? { row_keywords } : {}),
    ...(event_summary ? { event_summary } : {}),
    ...(location ? { location } : {}),
    ...(story_day ? { story_day } : {}),
    ...(story_time ? { story_time } : {}),
    ...(story_day_end ? { story_day_end } : {}),
    ...(story_time_end ? { story_time_end } : {}),
    ...(relative_time ? { relative_time } : {}),
    ...(presentRaw
      ? {
          characters_present: presentRaw
            .split(/[,，、;；]+/)
            .map((x) => x.trim())
            .filter(Boolean),
        }
      : {}),
    ...(sideRaw === '是' || sideRaw.toLowerCase() === 'true' || sideRaw === '1'
      ? { side_perspective: true }
      : {}),
    ...(Object.keys(costumes).length ? { costumes } : {}),
    ...(items.length ? { items } : {}),
    ...(foreshadows.length ? { foreshadows } : {}),
    ...(todos.length ? { todos } : {}),
  }

  return parseStoryTimelineSummaryDelta(rawObj)
}

function parseMemoryFieldsFromBlock(block: string): MemorySummaryMarkupFields {
  const rowTitle = normalizeStoryTimelineRowTitle(fieldLine(block, ['标题', 'row_title', 'rowTitle']))
  const rowKeywords = parseKeywords(fieldLine(block, ['关键词', 'row_keywords', 'keywords']))
  const content =
    multilineAfter(block, ['正文', 'content', '摘要正文']) ||
    fieldLine(block, ['正文', 'content']) ||
    ''
  const category = fieldLine(block, ['分类', 'category'])
  const precise = fieldLine(block, ['精准', 'precise'])
  const emotion = parseKeywords(fieldLine(block, ['情绪', 'emotion_need', 'emotionNeed']))
  return {
    content: content.trim(),
    ...(rowTitle ? { rowTitle } : {}),
    ...(rowKeywords.length ? { rowKeywords } : {}),
    ...(category ? { memoryTriggerCategory: category.slice(0, 12) } : {}),
    ...(precise ? { memoryTriggerPrecise: precise.slice(0, 16) } : {}),
    ...(emotion.length ? { memoryTriggerEmotionNeed: emotion.slice(0, 5) } : {}),
  }
}

type Section = { kind: 'PRIMARY' | 'LINKED' | 'TIMELINE' | 'EPILOGUE_PATCH'; body: string }

function splitSections(raw: string): Section[] {
  const text = stripFences(raw)
  const re = /\[(PRIMARY|LINKED|TIMELINE|EPILOGUE_PATCH)\]/gi
  const hits: Array<{ kind: Section['kind']; index: number; len: number }> = []
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    hits.push({
      kind: m[1]!.toUpperCase() as Section['kind'],
      index: m.index,
      len: m[0].length,
    })
  }
  if (!hits.length) return []
  const out: Section[] = []
  for (let i = 0; i < hits.length; i++) {
    const cur = hits[i]!
    const start = cur.index + cur.len
    const end = i + 1 < hits.length ? hits[i + 1]!.index : text.length
    out.push({ kind: cur.kind, body: text.slice(start, end).trim() })
  }
  return out
}

/** 是否像合并记忆 markup（而非截断 JSON） */
export function looksLikeUnifiedMemoryMarkup(raw: string): boolean {
  const t = stripFences(raw)
  return /\[PRIMARY\]/i.test(t) || (/\[LINKED\]/i.test(t) && /character_id\s*[:：]/i.test(t))
}

/**
 * 解析 primary + linked + timeline markup。
 * 无有效块时返回 null（调用方再回退 JSON）。
 */
export function parseUnifiedMemoryLinkedMarkup(raw: string): UnifiedMemoryMarkupResult | null {
  const sections = splitSections(raw)
  if (!sections.length) return null

  let primary: MemorySummaryMarkupFields | null = null
  const linked: LinkedMemoryMarkupEntry[] = []
  const epiloguePatches: WorldBookAfterPatch[] = []
  let pendingLinked: LinkedMemoryMarkupEntry | null = null
  let assignTimelineTo: 'primary' | 'linked' | null = null

  const flushPendingLinked = () => {
    if (pendingLinked) {
      linked.push(pendingLinked)
      pendingLinked = null
    }
  }

  for (const sec of sections) {
    if (sec.kind === 'PRIMARY') {
      flushPendingLinked()
      primary = parseMemoryFieldsFromBlock(sec.body)
      assignTimelineTo = 'primary'
      continue
    }
    if (sec.kind === 'LINKED') {
      flushPendingLinked()
      const characterId = fieldLine(sec.body, ['character_id', 'characterId', '角色id', '角色ID']).trim()
      if (!characterId) {
        assignTimelineTo = null
        continue
      }
      pendingLinked = { ...parseMemoryFieldsFromBlock(sec.body), characterId }
      assignTimelineTo = 'linked'
      continue
    }
    if (sec.kind === 'TIMELINE') {
      const timeline = parseTimelineMarkup(sec.body)
      if (timeline) {
        if (assignTimelineTo === 'linked' && pendingLinked) {
          pendingLinked = { ...pendingLinked, timeline }
        } else if (primary) {
          primary = { ...primary, timeline }
          assignTimelineTo = 'primary'
        } else {
          primary = { content: '', timeline }
          assignTimelineTo = 'primary'
        }
      }
      continue
    }
    if (sec.kind === 'EPILOGUE_PATCH') {
      const characterId = fieldLine(sec.body, ['character_id', 'characterId'])
      const worldBookId = fieldLine(sec.body, ['world_book_id', 'worldBookId'])
      const itemId = fieldLine(sec.body, ['item_id', 'itemId'])
      const newContent =
        multilineAfter(sec.body, ['new_content', 'newContent', '正文']) ||
        fieldLine(sec.body, ['new_content', 'newContent'])
      if (characterId && worldBookId && itemId && newContent) {
        epiloguePatches.push({
          characterId,
          worldBookId,
          itemId,
          newContent,
        })
      }
    }
  }
  flushPendingLinked()

  if (!primary && !linked.length) return null
  return {
    primary: primary ?? { content: '' },
    linked,
    ...(epiloguePatches.length ? { epiloguePatches } : {}),
  }
}

/** 从回复中切分剧情正文与记忆块（优先新 markup 分隔符，兼容旧 JSON 分隔符） */
export function splitDatingAiResponseAndUnifiedMemoryMarkup(raw: string): {
  plotRaw: string
  memoryText: string | null
  kind: 'markup' | 'json' | null
} {
  const text = String(raw ?? '')
  const markupIdx = text.lastIndexOf(DATING_UNIFIED_MEMORY_MARKUP_DELIMITER)
  const jsonIdx = text.lastIndexOf(DATING_UNIFIED_MEMORY_JSON_DELIMITER_LEGACY)
  if (markupIdx < 0 && jsonIdx < 0) {
    return { plotRaw: text.trim(), memoryText: null, kind: null }
  }
  if (markupIdx >= jsonIdx) {
    const d = DATING_UNIFIED_MEMORY_MARKUP_DELIMITER
    return {
      plotRaw: text.slice(0, markupIdx).trimEnd(),
      memoryText: text.slice(markupIdx + d.length).trim() || null,
      kind: 'markup',
    }
  }
  const d = DATING_UNIFIED_MEMORY_JSON_DELIMITER_LEGACY
  return {
    plotRaw: text.slice(0, jsonIdx).trimEnd(),
    memoryText: text.slice(jsonIdx + d.length).trim() || null,
    kind: 'json',
  }
}
