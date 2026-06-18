import type { WeChatForwardedMessageItem } from '../newFriendsPersona/types'

/** 聊天记录时间轴：年月日，例如 2026年4月15日 */
export function formatChatHistoryDateYmd(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`
}

/** 从消息时间戳推断记录覆盖的日期区间文案 */
export function formatChatHistoryDateRange(messages: readonly WeChatForwardedMessageItem[]): string {
  const stamps = messages
    .map((m) => m.timestamp)
    .filter((ts): ts is number => typeof ts === 'number' && Number.isFinite(ts))
  if (!stamps.length) return ''
  const start = Math.min(...stamps)
  const end = Math.max(...stamps)
  const startLabel = formatChatHistoryDateYmd(start)
  const endLabel = formatChatHistoryDateYmd(end)
  if (startLabel === endLabel) return startLabel
  return `${startLabel}至${endLabel}`
}
