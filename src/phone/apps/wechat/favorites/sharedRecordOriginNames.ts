import type { WeChatPersonaContact } from '../../../types'
import { personaDb } from '../newFriendsPersona/idb'
import type { WeChatSharedRecordPayload } from '../newFriendsPersona/types'
import { resolveCanonicalCharacterId } from '../wechatGlobalCharacterRegistry'
import { isSharedRecordPlayerOrigin } from './sharedRecordOrigin'

/** 角色微信昵称（不认识对方时 UI / 卡片仅展示此名，不用备注或真实姓名） */
export async function resolveCharacterWechatNickname(characterId: string): Promise<string> {
  const raw = characterId.trim()
  if (!raw || isSharedRecordPlayerOrigin(raw)) return '用户'
  try {
    const canon = (await resolveCanonicalCharacterId(raw)) || raw
    const ch = await personaDb.getCharacter(canon)
    return ch?.wechatNickname?.trim() || ch?.name?.trim() || '未命名'
  } catch {
    return '未命名'
  }
}

/** 角色人设「姓名」字段（非微信通讯录备注、非 wechatNickname） */
export async function resolveCharacterRealNameForSharedRecord(characterId: string): Promise<string> {
  const raw = characterId.trim()
  if (!raw || isSharedRecordPlayerOrigin(raw)) return '用户'
  try {
    const canon = (await resolveCanonicalCharacterId(raw)) || raw
    const ch = await personaDb.getCharacter(canon)
    return ch?.name?.trim() || '未命名'
  } catch {
    return '未命名'
  }
}

function findPersonaContactRemark(
  characterId: string,
  personaContacts: readonly WeChatPersonaContact[],
): string | undefined {
  const id = characterId.trim()
  if (!id) return undefined
  const contact = personaContacts.find((c) => c.characterId.trim() === id)
  return contact?.remarkName?.trim() || undefined
}

/** 玩家 UI：优先通讯录微信备注，无备注则用该角色微信昵称 */
export async function resolveCharacterUserRemarkOrNickname(
  characterId: string,
  personaContacts: readonly WeChatPersonaContact[],
): Promise<string> {
  const raw = characterId.trim()
  if (!raw || isSharedRecordPlayerOrigin(raw)) return '未命名'
  const directRemark = findPersonaContactRemark(raw, personaContacts)
  if (directRemark) return directRemark
  try {
    const canon = (await resolveCanonicalCharacterId(raw)) || raw
    const canonRemark = findPersonaContactRemark(canon, personaContacts)
    if (canonRemark) return canonRemark
  } catch {
    // ignore
  }
  return resolveCharacterWechatNickname(raw)
}

/** 玩家可见 UI：原发送者展示为用户通讯录中的微信备注（非人脉称呼） */
export async function resolveSharedRecordOriginUserDisplayName(params: {
  payload: WeChatSharedRecordPayload
  personaContacts?: readonly WeChatPersonaContact[]
  playerDisplayName?: string
}): Promise<string> {
  const originId = params.payload.originalSenderCharacterId.trim()
  const senderKind =
    params.payload.originalSenderKind ?? (isSharedRecordPlayerOrigin(originId) ? 'player' : 'character')
  if (senderKind === 'player' || isSharedRecordPlayerOrigin(originId)) {
    return params.playerDisplayName?.trim() || '用户'
  }
  const contacts = params.personaContacts ?? []
  const directRemark = findPersonaContactRemark(originId, contacts)
  if (directRemark) return directRemark
  try {
    const canon = (await resolveCanonicalCharacterId(originId)) || originId
    const canonRemark = findPersonaContactRemark(canon, contacts)
    if (canonRemark) return canonRemark
  } catch {
    // ignore
  }
  const stored = params.payload.originalSenderName.trim()
  if (stored) return stored
  return resolveCharacterWechatNickname(originId)
}

/** B 认识 A 时：优先人脉图 B→A 的 fromCallsTo，否则 A 的真实姓名 */
export async function resolveOriginNameKnownToRecipient(params: {
  originCharacterId: string
  fromCallsTo?: string | null
  fallbackRealName?: string
}): Promise<string> {
  const call = params.fromCallsTo?.trim()
  if (call) return call
  const fb = params.fallbackRealName?.trim()
  if (fb) return fb
  return resolveCharacterRealNameForSharedRecord(params.originCharacterId)
}
