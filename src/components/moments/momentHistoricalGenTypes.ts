import type { InstantGenContentTypeChoice } from './momentInstantGenContentTypes'
import type { InstantGenPostTypeChoice } from './momentInstantGenTypes'

export type HistoricalTimeSpanPresetId =
  | 'week'
  | 'month'
  | 'quarter'
  | 'half_year'
  | 'year'
  | 'custom'

export type HistoricalTimeSpan = {
  preset: HistoricalTimeSpanPresetId
  startMs: number
  endMs: number
}

export type HistoricalGenConfig = {
  targetCharacterId: string
  postTypes: InstantGenPostTypeChoice[]
  contentTypes: InstantGenContentTypeChoice[]
  customContentDirection?: string
  textLengthMin: number
  textLengthMax: number
  count: number
  /** 本批次中设为置顶的数量（0～条数） */
  pinnedCount: number
  timeSpan: HistoricalTimeSpan
}

export const HISTORICAL_PINNED_COUNT_MIN = 0
export const HISTORICAL_PINNED_COUNT_MAX = 5
export const HISTORICAL_PINNED_COUNT_DEFAULT = 1

export const HISTORICAL_GEN_COUNT_MIN = 1
export const HISTORICAL_GEN_COUNT_MAX = 30
export const HISTORICAL_GEN_COUNT_DEFAULT = 5

export const HISTORICAL_TIME_SPAN_PRESETS: {
  id: HistoricalTimeSpanPresetId
  label: string
  days: number
}[] = [
  { id: 'week', label: '最近一周', days: 7 },
  { id: 'month', label: '最近一月', days: 30 },
  { id: 'quarter', label: '最近三月', days: 90 },
  { id: 'half_year', label: '最近半年', days: 180 },
  { id: 'year', label: '最近一年', days: 365 },
  { id: 'custom', label: '自定义', days: 0 },
]

export function clampHistoricalGenCount(raw: number): number {
  const n = Number.isFinite(raw) ? Math.round(raw) : HISTORICAL_GEN_COUNT_DEFAULT
  return Math.max(HISTORICAL_GEN_COUNT_MIN, Math.min(HISTORICAL_GEN_COUNT_MAX, n))
}

export function clampHistoricalPinnedCount(raw: number, totalCount: number): number {
  const total = clampHistoricalGenCount(totalCount)
  const n = Number.isFinite(raw) ? Math.round(raw) : HISTORICAL_PINNED_COUNT_DEFAULT
  return Math.max(HISTORICAL_PINNED_COUNT_MIN, Math.min(HISTORICAL_PINNED_COUNT_MAX, total, n))
}

/** 在时间轴上均匀分布置顶条目的序号（0 = 较新） */
export function pickHistoricalPinnedIndices(totalCount: number, pinnedCount: number): Set<number> {
  const total = clampHistoricalGenCount(totalCount)
  const pinned = clampHistoricalPinnedCount(pinnedCount, total)
  if (pinned <= 0) return new Set()
  if (pinned >= total) return new Set(Array.from({ length: total }, (_, i) => i))
  const indices = new Set<number>()
  for (let i = 0; i < pinned; i += 1) {
    const idx =
      pinned === 1
        ? 0
        : Math.round((i * (total - 1)) / Math.max(1, pinned - 1))
    indices.add(idx)
  }
  return indices
}

export function buildHistoricalTimeSpanFromPreset(
  preset: HistoricalTimeSpanPresetId,
  nowMs = Date.now(),
): HistoricalTimeSpan {
  if (preset === 'custom') {
    const endMs = nowMs
    const startMs = endMs - 30 * 24 * 60 * 60 * 1000
    return { preset, startMs, endMs }
  }
  const hit = HISTORICAL_TIME_SPAN_PRESETS.find((p) => p.id === preset)
  const days = hit?.days ?? 30
  const endMs = nowMs
  const startMs = endMs - days * 24 * 60 * 60 * 1000
  return { preset, startMs, endMs }
}

export function pickHistoricalPoolItem<T>(pool: readonly T[], index: number): T | undefined {
  if (!pool.length) return undefined
  return pool[index % pool.length]
}
