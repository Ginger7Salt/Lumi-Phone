export function formatMomentTime(timestamp: number, nowMs = Date.now()): string {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || ts <= 0) return ''
  const diffMs = Math.max(0, nowMs - ts)
  const minuteMs = 60 * 1000
  const hourMs = 60 * minuteMs
  const dayMs = 24 * hourMs

  if (diffMs < minuteMs) return '刚刚'
  if (diffMs < hourMs) return `${Math.max(1, Math.floor(diffMs / minuteMs))}分钟前`
  if (diffMs < dayMs) return `${Math.max(1, Math.floor(diffMs / hourMs))}小时前`
  if (diffMs < 7 * dayMs) return `${Math.max(1, Math.floor(diffMs / dayMs))}天前`

  const now = new Date(nowMs)
  const date = new Date(ts)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  if (year === now.getFullYear()) return `${month}月${day}日`
  return `${year}年${month}月${day}日`
}

/** 记忆刻录用：绝对发布时间（含时分） */
export function formatMomentPublishedAtAbsolute(timestamp: number): string {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || ts <= 0) return ''
  const date = new Date(ts)
  const year = date.getFullYear()
  const month = date.getMonth() + 1
  const day = date.getDate()
  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const now = new Date()
  if (year === now.getFullYear()) return `${month}月${day}日 ${hour}:${minute}`
  return `${year}年${month}月${day}日 ${hour}:${minute}`
}

/** 评论区：今天仅时分；昨天加「昨天」；前天及更早显示月日时分，跨年加年份 */
export function formatMomentCommentTime(timestamp: number, nowMs = Date.now()): string {
  const ts = Number(timestamp)
  if (!Number.isFinite(ts) || ts <= 0) return ''

  const date = new Date(ts)
  const now = new Date(nowMs)

  const hour = String(date.getHours()).padStart(2, '0')
  const minute = String(date.getMinutes()).padStart(2, '0')
  const timePart = `${hour}:${minute}`

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const dayDiff = Math.floor((startOfDay(now) - startOfDay(date)) / (24 * 60 * 60 * 1000))

  if (dayDiff === 0) return timePart
  if (dayDiff === 1) return `昨天 ${timePart}`

  const month = date.getMonth() + 1
  const day = date.getDate()
  if (date.getFullYear() === now.getFullYear()) return `${month}月${day}日 ${timePart}`
  return `${date.getFullYear()}年${month}月${day}日 ${timePart}`
}
