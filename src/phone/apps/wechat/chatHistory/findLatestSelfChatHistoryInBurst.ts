import type { WeChatChatHistoryPayload } from '../newFriendsPersona/types'

type BurstMsg = {
  from: 'self' | 'other'
  chatHistory?: WeChatChatHistoryPayload
}

/** 自最近一条对方消息以来，用户连发多条时，取最近一条聊天记录卡片。 */
export function findLatestSelfChatHistoryInBurst(
  reversedNewestFirst: readonly BurstMsg[],
): WeChatChatHistoryPayload | undefined {
  for (const m of reversedNewestFirst) {
    if (m.from === 'other') break
    if (m.from === 'self' && m.chatHistory?.messages?.length) return m.chatHistory
  }
  return undefined
}
