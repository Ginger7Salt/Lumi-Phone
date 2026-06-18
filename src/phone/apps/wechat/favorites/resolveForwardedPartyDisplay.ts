import type { WeChatSharedRecordPayload } from '../newFriendsPersona/types'
import { isSharedRecordPlayerOrigin } from './sharedRecordOrigin'
import {
  resolveCharacterWechatNickname,
} from './sharedRecordOriginNames'
import {
  resolveSharedRecordOriginKnowledge,
  type SharedRecordOriginKnowledge,
} from './resolveSharedRecordOriginKnowledge'

export type { SharedRecordOriginKnowledge }

/** 判断接收方对某角色是否「认识」（人脉图双向或接收方→对方单向） */
export async function resolveForwardedPartyKnowledge(
  recipientCharacterId: string,
  partyCharacterId: string,
  partyKind: 'player' | 'character' = 'character',
): Promise<SharedRecordOriginKnowledge> {
  const originId = partyCharacterId.trim()
  if (partyKind === 'player' || isSharedRecordPlayerOrigin(originId)) {
    return {
      originKnownToRecipient: true,
      linkKind: 'none',
      originNameAsKnownByRecipient: '用户',
      originRealName: '用户',
    }
  }
  const probe: WeChatSharedRecordPayload = {
    kind: 'shared_record',
    shareId: 'party-lookup',
    originalSenderName: '',
    originalSenderCharacterId: originId,
    originalSenderKind: 'character',
    recordType: 'text',
    contentSummary: '',
    timestamp: 0,
  }
  return resolveSharedRecordOriginKnowledge(recipientCharacterId, probe)
}

/**
 * 接收方视角的展示名：
 * - 认识对方：人脉称呼 / 真实姓名
 * - 不认识：仅微信昵称（不用通讯录备注、不用真实姓名）
 */
export async function resolveForwardedPartyDisplayName(params: {
  recipientCharacterId: string
  partyCharacterId: string
  partyKind?: 'player' | 'character'
  playerDisplayName?: string
}): Promise<string> {
  const partyKind = params.partyKind ?? 'character'
  const partyId = params.partyCharacterId.trim()
  if (partyKind === 'player' || isSharedRecordPlayerOrigin(partyId)) {
    return params.playerDisplayName?.trim() || '用户'
  }
  const knowledge = await resolveForwardedPartyKnowledge(params.recipientCharacterId.trim(), partyId, 'character')
  if (knowledge.originKnownToRecipient) {
    return knowledge.originNameAsKnownByRecipient.trim() || knowledge.originRealName.trim() || '未命名'
  }
  return resolveCharacterWechatNickname(partyId)
}

export async function resolveSharedRecordOriginDisplayName(params: {
  recipientCharacterId: string
  payload: WeChatSharedRecordPayload
  playerDisplayName?: string
}): Promise<string> {
  const originId = params.payload.originalSenderCharacterId.trim()
  const senderKind =
    params.payload.originalSenderKind ?? (isSharedRecordPlayerOrigin(originId) ? 'player' : 'character')
  return resolveForwardedPartyDisplayName({
    recipientCharacterId: params.recipientCharacterId,
    partyCharacterId: originId,
    partyKind: senderKind,
    playerDisplayName: params.playerDisplayName,
  })
}

/** 私聊中：以当前会话角色为「对方」视角解析转发内容展示名 */
export function resolvePrivateChatRecipientCharacterId(
  roomType: 'private' | 'group',
  conversationCharacterId: string,
  isSelfMemoPeer: boolean,
): string | undefined {
  if (roomType !== 'private' || isSelfMemoPeer) return undefined
  const id = conversationCharacterId.trim()
  return id || undefined
}
