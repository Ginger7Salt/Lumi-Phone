import { personaDb } from '../newFriendsPersona/idb'
import type { StoryTimelineSummaryDelta } from './storyTimelineTypes'
import { dualNarrativeStoryFieldsFromDelta } from './dualNarrativeTime'

/**
 * 本轮剧情摘要落库后：给会话内尚未标注剧情时间的近期消息补上剧情锚点。
 * 系统落库时间保持不动；仅写用户可见的 story* 字段。
 */
export async function stampConversationMessagesWithStoryTime(params: {
  conversationKey: string
  delta: StoryTimelineSummaryDelta | null | undefined
  /** 最多回填最近 N 条；默认 24 */
  limit?: number
}): Promise<number> {
  const ck = params.conversationKey.trim()
  const story = dualNarrativeStoryFieldsFromDelta(params.delta)
  if (!ck || !story.storyTimeLabel) return 0

  const rows = await personaDb.listWeChatChatMessagesByConversationKey(ck)
  if (!rows.length) return 0
  const limit = Math.max(1, Math.min(80, params.limit ?? 24))
  const recent = rows.slice(-limit)
  let n = 0
  for (const msg of recent) {
    if (msg.storyTimeLabel?.trim()) continue
    await personaDb.patchWeChatChatMessageById(msg.id, {
      storyDay: story.storyDay,
      storyTime: story.storyTime,
      storyTimeLabel: story.storyTimeLabel,
    })
    n += 1
  }
  return n
}

/** 发送时：用角色当前剧情状态预填消息剧情时间（尚无本轮 delta 时） */
export async function resolveCurrentStoryFieldsForCharacter(
  characterId: string,
): Promise<{ storyDay?: string; storyTime?: string; storyTimeLabel?: string }> {
  const cid = characterId.trim()
  if (!cid) return {}
  try {
    const state = await personaDb.getStoryTimelineState(cid)
    if (!state) return {}
    return dualNarrativeStoryFieldsFromDelta({
      story_day: state.currentStoryDay,
      story_time: state.currentStoryTime,
    })
  } catch {
    return {}
  }
}
