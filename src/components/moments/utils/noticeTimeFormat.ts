/** 互动消息列表用：如「昨天 23:06」 */
export function formatNoticeTimestamp(timestamp: number, nowMs = Date.now()): string {
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
  if (dayDiff === 2) return `前天 ${timePart}`

  const month = date.getMonth() + 1
  const day = date.getDate()
  if (date.getFullYear() === now.getFullYear()) return `${month}月${day}日 ${timePart}`
  return `${date.getFullYear()}年${month}月${day}日 ${timePart}`
}
