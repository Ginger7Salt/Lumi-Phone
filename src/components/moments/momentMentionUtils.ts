import type { CharacterMomentPrivacyDraft } from './momentCharacterPrivacyAi'
import type { MomentItemModel } from './mockMoments'
import { buildMomentPostThumbnail } from './momentPostThumbnail'
import type { InteractionNotice } from './interactionNoticeTypes'
import type { AiMomentInteractionDraft } from './momentInteractionTypes'
import type { AllowedMomentCharacter } from './momentPrivacyAudience'
import type { MomentContactRef } from './newMomentTypes'
import { resolveContactsByCharacterIds } from './momentCharacterPrivacyAi'

export function momentMentionSourceId(momentId: string): string {
  return `mention:${momentId.trim()}`
}

export function momentMentionsUser(moment: MomentItemModel): boolean {
  const mentions = moment.privacy?.mentions ?? []
  if (mentions.some((m) => m.id === 'self')) return true
  return false
}

export function buildMomentsUserContactRef(playerDisplayName?: string): MomentContactRef {
  return {
    id: 'self',
    name: playerDisplayName?.trim() || '我',
  }
}

/** 用户是否在私聊里明确要求「@你 / 提醒你看」 */
export function hasExplicitUserMentionRequest(chatRequestHint?: string): boolean {
  const hint = chatRequestHint?.trim()
  if (!hint) return false
  return /(@你|@ 你|提醒你看|让你看这条|让你看|记得看|一定要看|务必看)/.test(hint)
}

/**
 * 角色 @ 提醒用户：仅作「请你看这条」的强调，非常稀有。
 * - only_user（仅你可见）≠ @ 提醒，二者不要叠加
 * - 主动/定时/批量发文默认关闭
 * - 仅私聊代发且用户明确要求 @ 时才开启
 */
export function resolveEffectiveCharacterMentionUser(params: {
  mentionUser?: boolean
  privacy: CharacterMomentPrivacyDraft
  chatRequestHint?: string
  triggeredByUserRequest?: boolean
  suppressMentionUser?: boolean
}): boolean {
  if (params.suppressMentionUser || params.mentionUser !== true) return false
  if (params.privacy.mode === 'only_user') return false
  if (!params.triggeredByUserRequest) return false
  return hasExplicitUserMentionRequest(params.chatRequestHint)
}

export function resolveCharacterMomentMentions(params: {
  mentionUser?: boolean
  mentionCharacterIds?: string[]
  userContact?: MomentContactRef
  momentContacts?: MomentContactRef[]
}): MomentContactRef[] {
  const mentions: MomentContactRef[] = []
  const seen = new Set<string>()

  const push = (contact: MomentContactRef) => {
    const id = contact.id.trim()
    if (!id || seen.has(id)) return
    seen.add(id)
    mentions.push(contact)
  }

  if (params.mentionUser && params.userContact) {
    push(params.userContact)
  }

  const extra = resolveContactsByCharacterIds(
    params.mentionCharacterIds ?? [],
    params.momentContacts ?? [],
  )
  for (const c of extra) push(c)

  return mentions
}

export function applyMentionsToPrivacyMeta<
  T extends { mentions?: MomentContactRef[] },
>(privacy: T, mentions: MomentContactRef[]): T {
  if (!mentions.length) return privacy
  return { ...privacy, mentions }
}

export function buildMentionNoticeFromMoment(moment: MomentItemModel): InteractionNotice | null {
  if (moment.isUserAuthored) return null
  const actorId = moment.authorCharacterId?.trim()
  if (!actorId || !momentMentionsUser(moment)) return null

  return {
    id: `notice-mention-${moment.id}`,
    momentId: moment.id,
    actorId,
    type: 'mention',
    timestamp: moment.timestamp,
    isRead: false,
    postThumbnail: buildMomentPostThumbnail(moment),
    sourceInteractionId: momentMentionSourceId(moment.id),
  }
}

/** 用户朋友圈 @ 提醒的角色（不含 self） */
export function getUserMomentMentionedContacts(moment: MomentItemModel): MomentContactRef[] {
  if (!moment.isUserAuthored) return []
  return (moment.privacy?.mentions ?? []).filter(
    (m) => m.id !== 'self' && m.characterId?.trim(),
  )
}

export function mentionedContactsToAllowed(
  mentions: MomentContactRef[],
): AllowedMomentCharacter[] {
  const out: AllowedMomentCharacter[] = []
  const seen = new Set<string>()
  for (const m of mentions) {
    const charId = m.characterId?.trim()
    if (!charId || seen.has(charId)) continue
    seen.add(charId)
    out.push({ charId, displayName: m.name.trim() || '未命名' })
  }
  return out
}

/** 仅保留对当前动态可见的被 @ 角色 */
export function filterMentionedCharactersByAudience(
  mentions: MomentContactRef[],
  allowed: AllowedMomentCharacter[],
): AllowedMomentCharacter[] {
  const allowedIds = new Set(allowed.map((c) => c.charId))
  return mentionedContactsToAllowed(mentions).filter((c) => allowedIds.has(c.charId))
}

/** 保留调用点；互动内容仅来自模型，不在本地补 viewed。 */
export function ensureMentionedCharacterAwarenessDrafts(
  drafts: AiMomentInteractionDraft[],
  _mentionedCharIds: readonly string[],
): AiMomentInteractionDraft[] {
  return drafts
}
