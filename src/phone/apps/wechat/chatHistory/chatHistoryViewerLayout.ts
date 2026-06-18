import type { WeChatForwardedMessageItem } from '../newFriendsPersona/types'

export function chatHistorySameSender(
  a: WeChatForwardedMessageItem,
  b: WeChatForwardedMessageItem,
): boolean {
  const idA = a.senderCharacterId?.trim()
  const idB = b.senderCharacterId?.trim()
  if (idA && idB) return idA === idB
  return a.senderName.trim() === b.senderName.trim()
}

/** 连续同发言人：仅首条显示头像/昵称/时间，后续留空位对齐（合并头像） */
export function chatHistoryShowSenderHeader(
  messages: readonly WeChatForwardedMessageItem[],
  index: number,
): boolean {
  if (index <= 0) return true
  const prev = messages[index - 1]
  const cur = messages[index]
  if (!prev || !cur) return true
  return !chatHistorySameSender(prev, cur)
}

/** 与 ChatRoom 一致：连续同侧 8px，换人 16px */
export function chatHistoryMessageBlockSpacing(
  messages: readonly WeChatForwardedMessageItem[],
  index: number,
): string {
  if (index <= 0) return ''
  const cur = messages[index]
  const prev = messages[index - 1]
  if (!cur || !prev) return 'mt-4'
  if (chatHistorySameSender(prev, cur)) return 'mt-2'
  return 'mt-4'
}
