import type { WeChatPersonaContact } from '../../../types'
import { personaDb } from '../newFriendsPersona/idb'
import type {
  WeChatChatHistoryParticipantRef,
  WeChatChatHistoryPayload,
  WeChatForwardedMessageItem,
} from '../newFriendsPersona/types'
import { resolveCanonicalCharacterId } from '../wechatGlobalCharacterRegistry'
import {
  resolveForwardedPartyDisplayName,
  resolveForwardedPartyKnowledge,
} from '../favorites/resolveForwardedPartyDisplay'
import { resolveCharacterWechatNickname } from '../favorites/sharedRecordOriginNames'
import { parseChatHistoryTitleParticipants } from './buildParticipantAvatarMap'

type PartyRef = {
  storedName: string
  kind: 'player' | 'character'
  characterId?: string
}

async function resolveCharacterIdByStoredName(params: {
  name: string
  userDisplayName: string
  personaContacts: readonly WeChatPersonaContact[]
  cardSenderCharacterId?: string
  participants?: WeChatChatHistoryPayload['participants']
}): Promise<PartyRef> {
  const name = params.name.trim()
  const userName = params.userDisplayName.trim() || '我'
  if (!name || name === '我' || name === userName) {
    return { storedName: name || userName, kind: 'player' }
  }
  if (name === '你') {
    const cid = params.cardSenderCharacterId?.trim()
    if (cid) return { storedName: name, kind: 'character', characterId: cid }
  }

  const fromParticipants = (() => {
    const parts = params.participants
    if (!parts) return undefined
    for (const p of [parts.a, parts.b]) {
      if (p.displayName.trim() === name) return p
    }
    return undefined
  })()
  if (fromParticipants) {
    return {
      storedName: name,
      kind: fromParticipants.kind,
      characterId: fromParticipants.characterId?.trim() || undefined,
    }
  }

  for (const c of params.personaContacts) {
    const ch = await personaDb.getCharacter(c.characterId)
    const aliases = new Set<string>([c.remarkName.trim()])
    if (ch?.name?.trim()) aliases.add(ch.name.trim())
    if (ch?.wechatNickname?.trim()) aliases.add(ch.wechatNickname.trim())
    if (ch?.remark?.trim()) aliases.add(ch.remark.trim())
    if (aliases.has(name)) {
      const canon = (await resolveCanonicalCharacterId(c.characterId)) || c.characterId
      return { storedName: name, kind: 'character', characterId: canon }
    }
  }

  const all = await personaDb.listCharacters()
  for (const ch of all) {
    const aliases = [ch.name, ch.wechatNickname, ch.remark].filter((x): x is string => !!x?.trim())
    if (aliases.some((a) => a.trim() === name)) {
      const canon = (await resolveCanonicalCharacterId(ch.id)) || ch.id
      return { storedName: name, kind: 'character', characterId: canon }
    }
  }

  return { storedName: name, kind: 'character' }
}

export type ChatHistoryNameResolution = 'recipient' | 'ai'

async function resolvePartyDisplayName(params: {
  recipientCharacterId: string
  party: PartyRef
  userDisplayName: string
  nameResolution: ChatHistoryNameResolution
}): Promise<string> {
  if (params.party.kind === 'player') {
    return params.userDisplayName.trim() || '用户'
  }
  const cid = params.party.characterId?.trim()
  if (!cid) return params.party.storedName
  if (params.nameResolution === 'ai') {
    const knowledge = await resolveForwardedPartyKnowledge(params.recipientCharacterId, cid, 'character')
    if (knowledge.originKnownToRecipient) {
      return knowledge.originRealName.trim() || params.party.storedName
    }
    return resolveCharacterWechatNickname(cid)
  }
  return resolveForwardedPartyDisplayName({
    recipientCharacterId: params.recipientCharacterId,
    partyCharacterId: cid,
    partyKind: 'character',
    playerDisplayName: params.userDisplayName,
  })
}

function collectStoredNames(payload: WeChatChatHistoryPayload): string[] {
  const names = new Set<string>()
  const titleParts = parseChatHistoryTitleParticipants(payload.title)
  if (titleParts) {
    names.add(titleParts.a)
    names.add(titleParts.b)
  }
  for (const m of payload.messages) {
    const n = m.senderName.trim()
    if (n) names.add(n)
  }
  return [...names]
}

/**
 * 以当前私聊对方视角重写聊天记录标题与发言人名。
 * - recipient：认识时用接收方人脉称呼，不认识时仅微信昵称（勿用于玩家 UI）
 * - ai：认识时用真实姓名，不认识时仅微信昵称（注入回复模型）
 */
export async function maskChatHistoryForRecipient(params: {
  payload: WeChatChatHistoryPayload
  recipientCharacterId: string
  userDisplayName: string
  personaContacts: readonly WeChatPersonaContact[]
  cardSenderCharacterId?: string
  nameResolution?: ChatHistoryNameResolution
}): Promise<WeChatChatHistoryPayload> {
  const nameResolution = params.nameResolution ?? 'recipient'
  const recipientId = params.recipientCharacterId.trim()
  if (!recipientId) return params.payload

  const storedNames = collectStoredNames(params.payload)
  const nameMap = new Map<string, string>()

  await Promise.all(
    storedNames.map(async (storedName) => {
      const partyFromMsg = params.payload.messages.find((m) => m.senderName.trim() === storedName.trim())
      let party = await resolveCharacterIdByStoredName({
        name: storedName,
        userDisplayName: params.userDisplayName,
        personaContacts: params.personaContacts,
        cardSenderCharacterId: params.cardSenderCharacterId,
        participants: params.payload.participants,
      })
      if (partyFromMsg?.senderKind) {
        party = {
          storedName,
          kind: partyFromMsg.senderKind,
          characterId: partyFromMsg.senderCharacterId?.trim() || party.characterId,
        }
      }
      const display = await resolvePartyDisplayName({
        recipientCharacterId: recipientId,
        party,
        userDisplayName: params.userDisplayName,
        nameResolution,
      })
      nameMap.set(storedName, display)
    }),
  )

  const replaceName = (raw: string) => nameMap.get(raw.trim()) ?? raw.trim()

  let title = params.payload.title
  const titleParts = parseChatHistoryTitleParticipants(title)
  if (titleParts) {
    const a = replaceName(titleParts.a)
    const b = replaceName(titleParts.b)
    title = `${a} 和 ${b} 的聊天记录`
  }

  const messages: WeChatForwardedMessageItem[] = params.payload.messages.map((m) => ({
    ...m,
    senderName: replaceName(m.senderName),
  }))

  let participants: { a: WeChatChatHistoryParticipantRef; b: WeChatChatHistoryParticipantRef } | undefined
  if (params.payload.participants) {
    participants = {
      a: {
        ...params.payload.participants.a,
        displayName: replaceName(params.payload.participants.a.displayName),
      },
      b: {
        ...params.payload.participants.b,
        displayName: replaceName(params.payload.participants.b.displayName),
      },
    }
  }

  return {
    ...params.payload,
    title,
    messages,
    ...(participants ? { participants } : {}),
  }
}
