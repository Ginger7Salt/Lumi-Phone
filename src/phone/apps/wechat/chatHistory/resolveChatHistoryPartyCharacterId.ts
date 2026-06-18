import type { WeChatPersonaContact } from '../../../types'
import { personaDb } from '../newFriendsPersona/idb'
import type { WeChatChatHistoryPayload } from '../newFriendsPersona/types'
import { resolveCanonicalCharacterId } from '../wechatGlobalCharacterRegistry'

export function isFirstPersonCardSenderName(name: string): boolean {
  const n = name.trim()
  return n === '你' || n === '我'
}

export async function resolveChatHistoryPartyCharacterId(params: {
  name: string
  personaContacts: readonly WeChatPersonaContact[]
  cardSenderCharacterId?: string
  participants?: WeChatChatHistoryPayload['participants']
}): Promise<string | undefined> {
  const name = params.name.trim()
  const cardSenderId = params.cardSenderCharacterId?.trim()
  if (!name) return undefined
  if (cardSenderId && isFirstPersonCardSenderName(name)) return cardSenderId

  const fromParticipants = (() => {
    const parts = params.participants
    if (!parts) return undefined
    for (const p of [parts.a, parts.b]) {
      if (p.displayName.trim() === name) return p
    }
    return undefined
  })()
  if (fromParticipants?.characterId?.trim()) return fromParticipants.characterId.trim()

  for (const c of params.personaContacts) {
    const ch = await personaDb.getCharacter(c.characterId)
    const aliases = new Set<string>([c.remarkName.trim()])
    if (ch?.name?.trim()) aliases.add(ch.name.trim())
    if (ch?.wechatNickname?.trim()) aliases.add(ch.wechatNickname.trim())
    if (ch?.remark?.trim()) aliases.add(ch.remark.trim())
    if (aliases.has(name)) {
      return (await resolveCanonicalCharacterId(c.characterId)) || c.characterId
    }
  }

  const all = await personaDb.listCharacters()
  for (const ch of all) {
    const aliases = [ch.name, ch.wechatNickname, ch.remark].filter((x): x is string => !!x?.trim())
    if (aliases.some((a) => a.trim() === name)) {
      return (await resolveCanonicalCharacterId(ch.id)) || ch.id
    }
  }

  return undefined
}
