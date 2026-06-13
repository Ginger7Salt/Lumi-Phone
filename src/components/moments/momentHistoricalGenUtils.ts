export function distributeHistoricalTimestamps(
  count: number,
  startMs: number,
  endMs: number,
): number[] {
  const n = Math.max(1, Math.round(count))
  const start = Math.min(startMs, endMs)
  const end = Math.max(startMs, endMs)
  if (end <= start) return Array.from({ length: n }, () => end)
  const span = end - start
  const out: number[] = []
  for (let i = 0; i < n; i += 1) {
    const segStart = start + (span * i) / n
    const segEnd = start + (span * (i + 1)) / n
    const segSpan = Math.max(1, segEnd - segStart)
    const jitter = segSpan * 0.1 + Math.random() * segSpan * 0.75
    out.push(Math.floor(segStart + jitter))
  }
  return out.sort((a, b) => b - a)
}

export function formatHistoricalMomentContext(timestampMs: number): string {
  const date = new Date(timestampMs)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = date.getHours()
  const period =
    hour < 6 ? '凌晨' : hour < 12 ? '上午' : hour < 18 ? '下午' : '晚上'
  return `${year}年${month}月${day}日 ${period}${hour}点`
}

export function buildPriorHistoricalSummariesBlock(summaries: string[]): string {
  const rows = summaries.map((s) => s.trim()).filter(Boolean)
  if (!rows.length) return '（本批次尚未生成其他动态）'
  return rows.map((s, i) => `${i + 1}. ${s}`).join('\n')
}
