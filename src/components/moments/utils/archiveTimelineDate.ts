export function getDayKey(timestamp: number, nowMs = Date.now()): string {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || ts <= 0) return getDayKey(nowMs, nowMs)
  const d = new Date(ts)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function isSameCalendarDay(a: number, b: number): boolean {
  return getDayKey(a) === getDayKey(b)
}

export function isToday(timestamp: number, nowMs = Date.now()): boolean {
  return isSameCalendarDay(timestamp, nowMs)
}

export function isYesterday(timestamp: number, nowMs = Date.now()): boolean {
  return isSameCalendarDay(timestamp, nowMs - 86_400_000)
}

export function getCalendarYear(timestamp: number): number {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || ts <= 0) return new Date().getFullYear()
  return new Date(ts).getFullYear()
}

/** 个人相册年份分隔：仅非今年且与上一条年份不同时展示 */
export function shouldShowArchiveYearHeader(
  year: number,
  prevYear: number | null,
  nowMs = Date.now(),
): boolean {
  const currentYear = new Date(nowMs).getFullYear()
  return year !== currentYear && year !== prevYear
}

/** 左侧时间轴：今天/昨天，或「大号日 + 小号月」 */
export function formatArchiveTimelineDate(
  timestamp: number,
  nowMs = Date.now(),
): { primary: string; secondary?: string } {
  if (isToday(timestamp, nowMs)) return { primary: '今天' }
  if (isYesterday(timestamp, nowMs)) return { primary: '昨天' }
  const d = new Date(timestamp)
  return {
    primary: String(d.getDate()),
    secondary: `${d.getMonth() + 1}月`,
  }
}
