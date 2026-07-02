import type { DiaryAiResult, DiaryFontStyleCode, DiaryMemorySummary } from './diaryTypes'
import { repairMemorySummaryBodyFromModel } from '../memory/memorySummarySchemaLeakRepair'
import {
  normalizeStoryTimelineRowKeywords,
  normalizeStoryTimelineRowTitle,
} from '../memory/storyTimelineTypes'

export class DiaryAiParseError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DiaryAiParseError'
  }
}

function stripFence(s: string): string {
  const t = String(s ?? '').trim()
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence?.[1]) return fence[1].trim()
  return t
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function unescapeJsonString(s: string): string {
  return s
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function normalizeFontStyle(raw: unknown): DiaryFontStyleCode | undefined {
  const v = String(raw ?? '').trim().toLowerCase()
  if (v === 'sharp' || v === 'neat' || v === 'lazy' || v === 'elegant' || v === 'wild') return v
  return undefined
}

/** 从首个 { 起做括号平衡截取；截断时尝试补全引号与 } */
function sliceBalancedOrRepairJsonObject(raw: string): string {
  const t = stripFence(raw)
  const start = t.indexOf('{')
  if (start < 0) throw new DiaryAiParseError('模型未返回 JSON 对象')

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < t.length; i += 1) {
    const c = t[i]!
    if (inString) {
      if (escape) {
        escape = false
        continue
      }
      if (c === '\\') {
        escape = true
        continue
      }
      if (c === '"') inString = false
      continue
    }
    if (c === '"') {
      inString = true
      continue
    }
    if (c === '{') depth += 1
    if (c === '}') {
      depth -= 1
      if (depth === 0) return t.slice(start, i + 1)
    }
  }

  let partial = t.slice(start)
  if (inString) partial += '"'
  while (depth > 0) {
    partial += '}'
    depth -= 1
  }
  return partial
}

function pickStringField(obj: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const v = obj[key]
    if (typeof v === 'string' && v.trim()) return v.trim()
  }
  return ''
}

function pickStringArrayField(obj: Record<string, unknown>, ...keys: string[]): string[] {
  for (const key of keys) {
    const v = obj[key]
    if (Array.isArray(v)) {
      return v.map((x) => String(x ?? '').trim()).filter(Boolean)
    }
  }
  return []
}

function parseMemorySummaryField(obj: Record<string, unknown>): DiaryMemorySummary | null {
  const raw = obj.memory_summary ?? obj.memorySummary
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null
  const ms = raw as Record<string, unknown>
  const content = repairMemorySummaryBodyFromModel(
    pickStringField(ms, 'content', 'body', 'summary'),
  ).trim()
  if (!content) return null
  const rowTitle =
    normalizeStoryTimelineRowTitle(pickStringField(ms, 'row_title', 'rowTitle')) || ''
  const rowKeywords = normalizeStoryTimelineRowKeywords(
    pickStringArrayField(ms, 'row_keywords', 'rowKeywords', 'keywords'),
  )
  return { rowTitle, rowKeywords, content }
}

function parseFromObject(obj: Record<string, unknown>): DiaryAiResult {
  const title = pickStringField(obj, 'title')
  const content = pickStringField(obj, 'content')
  const inUniverseTime = pickStringField(obj, 'inUniverseTime', 'in_universe_time', 'time')
  const memorySummary = parseMemorySummaryField(obj)
  if (!title || !content) {
    throw new DiaryAiParseError('AI 未返回完整日记（缺少 title 或 content）')
  }
  if (!memorySummary) {
    throw new DiaryAiParseError('AI 未返回 memory_summary 摘要表（长期记忆须同次生成）')
  }
  const result: DiaryAiResult = { title, content, inUniverseTime, memorySummary }
  const fontStyle = normalizeFontStyle(obj.font_style ?? obj.fontStyle)
  if (fontStyle) result.font_style = fontStyle
  return result
}

/** 标准 JSON 失败时：按字段正则抽取（容忍 content 内未转义换行） */
function parseDiaryFieldsLenient(raw: string): DiaryAiResult | null {
  const t = stripFence(raw)
  const titleRaw = t.match(/"title"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1]
  const timeRaw =
    t.match(/"inUniverseTime"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1] ??
    t.match(/"in_universe_time"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1]
  const fontRaw = t.match(/"font_style"\s*:\s*"((?:\\.|[^"\\])*)"/)?.[1]

  const contentMatch =
    t.match(/"content"\s*:\s*"([\s\S]*?)"\s*,\s*"(?:memory_summary|memorySummary|font_style|inUniverseTime|in_universe_time)"/) ??
    t.match(/"content"\s*:\s*"([\s\S]*)"\s*}\s*$/)

  const contentRaw = contentMatch?.[1]
  if (!titleRaw || !contentRaw) return null

  let memorySummary: DiaryMemorySummary | null = null
  const msMatch = t.match(/"memory_summary"\s*:\s*(\{[\s\S]*?\})\s*(?:,|\})/)
  if (msMatch?.[1]) {
    try {
      memorySummary = parseMemorySummaryField(JSON.parse(msMatch[1]) as Record<string, unknown>)
    } catch {
      memorySummary = null
    }
  }

  const result: DiaryAiResult = {
    title: unescapeJsonString(titleRaw).trim(),
    inUniverseTime: unescapeJsonString(timeRaw ?? '').trim(),
    content: unescapeJsonString(contentRaw).trim(),
    memorySummary: memorySummary ?? { rowTitle: '', rowKeywords: [], content: '' },
  }
  const fontStyle = normalizeFontStyle(fontRaw)
  if (fontStyle) result.font_style = fontStyle
  if (!result.title || !result.content || !result.memorySummary.content) return null
  return result
}

export function parseDiaryAiModelText(raw: string, opts?: { allowFontStyle?: boolean }): DiaryAiResult {
  const allowFont = opts?.allowFontStyle !== false
  let lastErr: unknown = null

  try {
    const slice = sliceBalancedOrRepairJsonObject(raw)
    const obj = JSON.parse(slice) as Record<string, unknown>
    if (!obj || typeof obj !== 'object') throw new DiaryAiParseError('AI 返回格式异常')
    const parsed = parseFromObject(obj)
    if (!allowFont) delete parsed.font_style
    return parsed
  } catch (e) {
    lastErr = e
  }

  try {
    const slice = sliceBalancedOrRepairJsonObject(raw)
    const obj = JSON.parse(slice) as Record<string, unknown>
    if (obj && typeof obj === 'object') {
      const parsed = parseFromObject(obj)
      if (!allowFont) delete parsed.font_style
      return parsed
    }
  } catch {
    /* fall through to lenient */
  }

  const lenient = parseDiaryFieldsLenient(raw)
  if (lenient) {
    if (!allowFont) delete lenient.font_style
    return lenient
  }

  const hint =
    lastErr instanceof Error && lastErr.message
      ? lastErr.message
      : '返回的 JSON 可能被截断，或 content 内含未转义的双引号/换行'
  throw new DiaryAiParseError(
    `日记 JSON 解析失败：${hint}。请重试；若反复出现可换模型或稍缩短上下文。`,
  )
}

export function formatDiaryGenerateError(err: unknown): string {
  if (err instanceof DiaryAiParseError) return err.message
  if (err instanceof Error) {
    if (/JSON|Unterminated string|Unexpected token/i.test(err.message)) {
      return `日记 JSON 解析失败：模型返回了不完整或格式不合法的 JSON（常见于正文里有未转义引号、或输出被截断）。请重试一次。`
    }
    return err.message
  }
  return '生成失败'
}
