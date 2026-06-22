import {
  buildAnonymousQaPersonaPromptPack,
  type AnonymousQaWechatContext,
} from '../anonymousQa/buildAnonymousQaPersonaContext'
import { personaDb } from '../../phone/apps/wechat/newFriendsPersona/idb'
import type { WeChatChatMessage } from '../../phone/apps/wechat/newFriendsPersona/types'

import type { AllowedMomentCharacter } from './momentPrivacyAudience'

/** 用户长时间未回私聊、却发朋友圈时，允许角色在评论里轻调侃的最小间隔 */
export const USER_MOMENT_GHOST_TEASE_MIN_MS = 3 * 60 * 60 * 1000

export type UserMomentInteractionCharacterContext = {
  charId: string
  displayName: string
  contextBlock: string
}

function truncateNotes(text: string, max: number): string {
  const t = text.trim()
  if (!t) return '（暂无）'
  if (t.length <= max) return t
  return `${t.slice(0, max)}…`
}

/** 末条私聊来自角色且用户久未回复，但刚发了朋友圈 */
export function detectUserGhostedChatButPostedMoment(
  messages: WeChatChatMessage[],
  momentPublishedAt: number,
  minGapMs = USER_MOMENT_GHOST_TEASE_MIN_MS,
): { gapHours: number; lastCharacterSnippet: string } | null {
  const sorted = [...messages].filter((m) => !m.isRecalled).sort((a, b) => a.timestamp - b.timestamp)
  const last = sorted[sorted.length - 1]
  if (!last || last.type !== 'character') return null

  const gapMs = momentPublishedAt - last.timestamp
  if (!Number.isFinite(gapMs) || gapMs < minGapMs) return null

  const trailingChar: string[] = []
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    const m = sorted[i]
    if (!m || m.type !== 'character') break
    const t = m.content?.trim()
    if (t) trailingChar.unshift(t.slice(0, 200))
  }

  return {
    gapHours: Math.max(1, Math.round(gapMs / (1000 * 60 * 60))),
    lastCharacterSnippet: trailingChar.slice(-2).join(' / ') || '（你上一轮私聊发言）',
  }
}

function buildCharacterContextBlock(params: {
  displayName: string
  charId: string
  longTermMemoryNotes: string
  unsummarizedPrivateNotes: string
  offlineDatingPlotsContext: string
  ghostTease: { gapHours: number; lastCharacterSnippet: string } | null
}): string {
  const lines = [
    `【${params.displayName}（${params.charId}）· 与该用户的私聊与记忆】`,
    `- 长期记忆：${truncateNotes(params.longTermMemoryNotes, 520)}`,
    `- 近期私聊：${truncateNotes(params.unsummarizedPrivateNotes, 680)}`,
  ]
  if (params.offlineDatingPlotsContext.trim()) {
    lines.push(`- 线下剧情：${truncateNotes(params.offlineDatingPlotsContext, 280)}`)
  }
  if (params.ghostTease) {
    lines.push(
      `- 【情境】用户已约 ${params.ghostTease.gapHours} 小时未回你私聊（你末条：${truncateNotes(params.ghostTease.lastCharacterSnippet, 120)}），却刚发了这条朋友圈。`,
      '  若符合人设与关系，可在 comment 中自然调侃「有空发朋友圈没空回消息」类（勿机械复读模板；关系冷淡/严肃话题可略过或只 like/viewed）。',
    )
  }
  return lines.join('\n')
}

async function loadPrivateChatMessages(conversationKey: string): Promise<WeChatChatMessage[]> {
  const key = conversationKey.trim()
  if (!key) return []
  try {
    return await personaDb.listWeChatChatMessagesByConversationKey(key)
  } catch {
    return []
  }
}

/** 为可见角色批量构建朋友圈互动所需的私聊/记忆语境（含「未回私聊却发朋友圈」检测） */
export async function buildUserMomentInteractionCharacterContexts(params: {
  wechatCtx: AnonymousQaWechatContext
  allowedCharacters: AllowedMomentCharacter[]
  momentContent: string
  momentPublishedAt: number
}): Promise<UserMomentInteractionCharacterContext[]> {
  const haystack = [params.momentContent.trim(), '朋友圈 动态 互动 评论'].filter(Boolean).join('\n')
  const publishedAt = params.momentPublishedAt

  const rows = await Promise.all(
    params.allowedCharacters.map(async (c) => {
      const pack = await buildAnonymousQaPersonaPromptPack({
        characterId: c.charId,
        wechatCtx: params.wechatCtx,
        relevanceHaystack: haystack,
      })
      const messages = await loadPrivateChatMessages(pack.conversationKey)
      const ghostTease = detectUserGhostedChatButPostedMoment(messages, publishedAt)
      const contextBlock = buildCharacterContextBlock({
        displayName: c.displayName,
        charId: c.charId,
        longTermMemoryNotes: pack.longTermMemoryNotes,
        unsummarizedPrivateNotes: pack.unsummarizedPrivateNotes,
        offlineDatingPlotsContext: pack.offlineDatingPlotsContext,
        ghostTease,
      })
      return { charId: c.charId, displayName: c.displayName, contextBlock }
    }),
  )

  return rows.filter((r) => r.contextBlock.trim())
}

export function formatUserMomentCharacterContextsPrompt(
  contexts: UserMomentInteractionCharacterContext[],
): string {
  if (!contexts.length) return ''
  return [
    '【各角色与该用户的私聊记忆与近期上下文（互动须据此反应，像真人刷熟人朋友圈）】',
    ...contexts.map((c) => c.contextBlock),
  ].join('\n\n')
}
