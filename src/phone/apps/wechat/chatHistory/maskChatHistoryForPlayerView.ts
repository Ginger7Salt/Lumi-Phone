import type { WeChatPersonaContact } from '../../../types'
import type {
  WeChatChatHistoryPayload,
  WeChatForwardedMessageItem,
} from '../newFriendsPersona/types'
import { resolveCharacterUserRemarkOrNickname } from '../favorites/sharedRecordOriginNames'
import { buildChatHistoryDisplayTitleFromMessages } from './buildChatHistoryDisplayTitle'
import { parseChatHistoryTitleParticipants } from './buildParticipantAvatarMap'
import {
  isFirstPersonCardSenderName,
  resolveChatHistoryPartyCharacterId,
} from './resolveChatHistoryPartyCharacterId'

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

async function resolvePlayerViewDisplayName(params: {
  storedName: string
  characterId?: string
  personaContacts: readonly WeChatPersonaContact[]
  cardSenderCharacterId: string
}): Promise<string> {
  const stored = params.storedName.trim()
  const cardSenderId = params.cardSenderCharacterId.trim()
  const cid =
    params.characterId?.trim() ||
    (isFirstPersonCardSenderName(stored) ? cardSenderId : undefined)

  if (cid) {
    return resolveCharacterUserRemarkOrNickname(cid, params.personaContacts)
  }
  return stored || '未知'
}

/**
 * 玩家阅读「角色伪造」的聊天记录卡片：展示用户通讯录备注 / 临时 NPC 微信昵称，绝不混入玩家头像昵称。
 */
export async function maskChatHistoryForPlayerView(params: {
  payload: WeChatChatHistoryPayload
  cardSenderCharacterId: string
  personaContacts: readonly WeChatPersonaContact[]
}): Promise<WeChatChatHistoryPayload> {
  const cardSenderId = params.cardSenderCharacterId.trim()
  if (!cardSenderId) return params.payload

  const storedNames = collectStoredNames(params.payload)
  const nameMap = new Map<string, string>()
  const idMap = new Map<string, string | undefined>()

  await Promise.all(
    storedNames.map(async (storedName) => {
      const partyFromMsg = params.payload.messages.find((m) => m.senderName.trim() === storedName.trim())
      if (partyFromMsg?.senderKind === 'player') {
        nameMap.set(storedName, storedName)
        return
      }
      const characterId = await resolveChatHistoryPartyCharacterId({
        name: storedName,
        personaContacts: params.personaContacts,
        cardSenderCharacterId: cardSenderId,
        participants: params.payload.participants,
      })
      idMap.set(storedName, characterId)
      const display = await resolvePlayerViewDisplayName({
        storedName,
        characterId,
        personaContacts: params.personaContacts,
        cardSenderCharacterId: cardSenderId,
      })
      nameMap.set(storedName, display)
    }),
  )

  const replaceName = (raw: string) => nameMap.get(raw.trim()) ?? raw.trim()

  const cardSenderDisplay = (() => {
    for (const key of ['你', '我']) {
      const v = nameMap.get(key)?.trim()
      if (v) return v
    }
    return ''
  })()
  const resolvedCardSenderDisplay =
    cardSenderDisplay ||
    (await resolvePlayerViewDisplayName({
      storedName: '你',
      characterId: cardSenderId,
      personaContacts: params.personaContacts,
      cardSenderCharacterId: cardSenderId,
    }))

  const messages: WeChatForwardedMessageItem[] = params.payload.messages.map((m) => {
    const stored = m.senderName.trim()
    const display = replaceName(stored)
    const characterId =
      m.senderCharacterId?.trim() ||
      idMap.get(stored) ||
      (isFirstPersonCardSenderName(stored) ? cardSenderId : undefined)
    if (m.senderKind === 'player') return { ...m, senderName: display }
    return {
      ...m,
      senderName: display,
      senderKind: 'character' as const,
      ...(characterId ? { senderCharacterId: characterId } : {}),
      ...(m.senderAvatarUrl ? { senderAvatarUrl: m.senderAvatarUrl } : {}),
    }
  })

  const title = buildChatHistoryDisplayTitleFromMessages({
    messages,
    cardSenderDisplayName: resolvedCardSenderDisplay,
    cardSenderCharacterId: cardSenderId,
    fallbackTitle: params.payload.title,
  })

  return {
    ...params.payload,
    title,
    messages,
  }
}
