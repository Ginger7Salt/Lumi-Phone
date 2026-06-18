import type { WeChatSharedRecordPayload } from '../newFriendsPersona/types'

type BurstMsg = {
  from: 'self' | 'other'
  sharedRecord?: WeChatSharedRecordPayload
}

/**
 * 自最近一条对方消息以来，用户连发多条时，取最近一条带收藏切片的 self 消息。
 * （避免「先转发卡片、再补一句文字」时只命中纯文本而漏注入来源 bias。）
 */
export function findLatestSelfSharedRecordInBurst(
  reversedNewestFirst: readonly BurstMsg[],
): WeChatSharedRecordPayload | undefined {
  for (const m of reversedNewestFirst) {
    if (m.from === 'other') break
    if (m.from === 'self' && m.sharedRecord) return m.sharedRecord
  }
  return undefined
}
