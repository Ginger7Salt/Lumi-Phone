import { WECHAT_LUMI_PEER_CHARACTER_ID } from '../../phone/apps/wechat/wechatConversationKey'

import type { MomentItemModel } from './mockMoments'
import type { InteractionParticipantMeta } from './momentInteractionParticipant'

export type MomentParticipantProfilePayload = {
  kind: 'lumi' | 'self' | 'persona'
  characterId?: string
  remarkName: string
  avatarUrl?: string
}

export type OnOpenMomentParticipantProfile = (payload: MomentParticipantProfilePayload) => void

function payloadFromCharacterId(
  charId: string,
  remarkName: string,
  avatarUrl?: string,
): MomentParticipantProfilePayload {
  if (charId === WECHAT_LUMI_PEER_CHARACTER_ID) {
    return { kind: 'lumi', remarkName, avatarUrl }
  }
  return { kind: 'persona', characterId: charId, remarkName, avatarUrl }
}

export function profilePayloadFromParticipantMeta(
  meta: InteractionParticipantMeta,
): MomentParticipantProfilePayload | null {
  if (meta.isCurrentUser) {
    return { kind: 'self', remarkName: meta.remark, avatarUrl: meta.avatarUrl }
  }
  const charId = meta.charId?.trim()
  if (!charId) return null
  return payloadFromCharacterId(charId, meta.remark, meta.avatarUrl)
}

export function profilePayloadFromMomentAuthor(params: {
  item: MomentItemModel
  authorName: string
  authorAvatarUrl?: string
}): MomentParticipantProfilePayload | null {
  if (params.item.isUserAuthored) {
    return {
      kind: 'self',
      remarkName: params.authorName,
      avatarUrl: params.authorAvatarUrl,
    }
  }
  const charId = params.item.authorCharacterId?.trim()
  if (!charId) return null
  return payloadFromCharacterId(charId, params.authorName, params.authorAvatarUrl)
}

export function profilePayloadFromArchiveSubject(params: {
  isCurrentUser: boolean
  userId: string
  displayName: string
  avatarUrl?: string
}): MomentParticipantProfilePayload {
  if (params.isCurrentUser) {
    return {
      kind: 'self',
      remarkName: params.displayName,
      avatarUrl: params.avatarUrl,
    }
  }
  return payloadFromCharacterId(params.userId.trim(), params.displayName, params.avatarUrl)
}
