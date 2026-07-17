/** 生成动态发布时间跨度单位 */
export const CHARACTER_DYNAMICS_TIME_UNITS = [
  { id: 'day', label: '天', hint: '按天计' },
  { id: 'month', label: '个月', hint: '按月计' },
  { id: 'year', label: '年', hint: '按年计' },
] as const

export type CharacterDynamicsTimeUnit = (typeof CHARACTER_DYNAMICS_TIME_UNITS)[number]['id']

export type CharacterDynamicsTimeSpan = {
  amount: number
  unit: CharacterDynamicsTimeUnit
}

export const CHARACTER_DYNAMICS_TIME_AMOUNT_MIN = 1
export const CHARACTER_DYNAMICS_TIME_AMOUNT_MAX_BY_UNIT: Record<CharacterDynamicsTimeUnit, number> = {
  day: 365,
  month: 36,
  year: 10,
}

export const DEFAULT_CHARACTER_DYNAMICS_TIME_SPAN: CharacterDynamicsTimeSpan = {
  amount: 3,
  unit: 'month',
}

export function clampCharacterDynamicsTimeSpan(
  span: Partial<CharacterDynamicsTimeSpan> | null | undefined,
): CharacterDynamicsTimeSpan {
  const unit: CharacterDynamicsTimeUnit =
    span?.unit === 'day' || span?.unit === 'month' || span?.unit === 'year'
      ? span.unit
      : DEFAULT_CHARACTER_DYNAMICS_TIME_SPAN.unit
  const max = CHARACTER_DYNAMICS_TIME_AMOUNT_MAX_BY_UNIT[unit]
  const raw = Math.floor(Number(span?.amount))
  const amount = Number.isFinite(raw)
    ? Math.min(max, Math.max(CHARACTER_DYNAMICS_TIME_AMOUNT_MIN, raw))
    : DEFAULT_CHARACTER_DYNAMICS_TIME_SPAN.amount
  return { amount, unit }
}

/** 跨度窗口毫秒（用于本地打时间戳） */
export function characterDynamicsTimeSpanMs(span: CharacterDynamicsTimeSpan): number {
  const { amount, unit } = clampCharacterDynamicsTimeSpan(span)
  const day = 86_400_000
  if (unit === 'month') return amount * 30 * day
  if (unit === 'year') return amount * 365 * day
  return amount * day
}

export function formatCharacterDynamicsTimeSpan(span: CharacterDynamicsTimeSpan): string {
  const { amount, unit } = clampCharacterDynamicsTimeSpan(span)
  if (unit === 'month') return `${amount} 个月内`
  if (unit === 'year') return `${amount} 年内`
  return `${amount} 天内`
}

export function characterDynamicsTimeSpanHint(span: CharacterDynamicsTimeSpan): string {
  const label = formatCharacterDynamicsTimeSpan(span)
  const { unit } = clampCharacterDynamicsTimeSpan(span)
  if (unit === 'year') {
    return `多条动态时间线散落在近 ${label}，内容应像不同时期的旧帖+近期帖，勿写成像同一天连发`
  }
  if (unit === 'month') {
    return `多条动态时间线散落在近 ${label}，口吻可有阶段差异，勿写成像同一天连发`
  }
  return `多条动态时间线散落在近 ${label} 的不同日子/时段，勿写成像几小时内连发`
}

/**
 * 在 [now - span, now] 内为多条动态分配递增时间（末条最新）。
 * 带轻微抖动与日间时段偏好，避免整点等距。
 */
export function distributeCharacterDynamicsTimestamps(
  count: number,
  span: CharacterDynamicsTimeSpan,
  now = Date.now(),
): number[] {
  const n = Math.max(0, Math.floor(count))
  if (n <= 0) return []
  const spanMs = Math.max(characterDynamicsTimeSpanMs(span), 86_400_000)
  const newestPad = Math.min(45 * 60_000, Math.floor(spanMs * 0.02))
  const oldest = now - spanMs
  const newest = now - newestPad
  if (n === 1) {
    return [Math.floor(oldest + (newest - oldest) * 0.65)]
  }
  const out: number[] = []
  for (let i = 0; i < n; i++) {
    const t = i / (n - 1) // 0 最旧 → 1 最新
    const base = oldest + (newest - oldest) * t
    const wobble = Math.sin((i + 1) * 12.9898) * 0.5 + 0.5
    const jitter = (wobble - 0.5) * Math.min(spanMs / (n * 2.5), 12 * 3_600_000)
    let ts = Math.floor(base + jitter)
    const d = new Date(ts)
    const hourBias = [9, 11, 13, 16, 19, 21][i % 6]!
    const minuteBias = Math.floor(8 + wobble * 48)
    d.setHours(hourBias, minuteBias, Math.floor(wobble * 50), 0)
    ts = d.getTime()
    if (ts >= now) ts = now - newestPad - i * 90_000
    if (ts < oldest) ts = oldest + i * 60_000
    out.push(ts)
  }
  for (let i = 1; i < out.length; i++) {
    if (out[i]! <= out[i - 1]!) {
      out[i] = out[i - 1]! + 3_600_000 + i * 90_000
    }
  }
  const last = out[out.length - 1]!
  if (last >= now) {
    const shift = last - now + newestPad
    for (let i = 0; i < out.length; i++) out[i]! -= shift
  }
  return out
}
