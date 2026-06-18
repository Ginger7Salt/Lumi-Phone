import { useEffect, useState } from 'react'

import type { WeChatPersonaContact } from '../../../types'
import { personaDb } from '../newFriendsPersona/idb'
import type { WeChatForwardedMessageItem } from '../newFriendsPersona/types'
import { resolveCharacterUserRemarkOrNickname } from '../favorites/sharedRecordOriginNames'
import { resolveCanonicalCharacterId } from '../wechatGlobalCharacterRegistry'

export type ChatHistorySenderLabel = {
  /** 通讯录备注 / 会话展示名 */
  remarkName: string
  /** 人设微信昵称；与备注不同时单独展示 */
  wechatNickname?: string
}

function isPlayerSender(
  m: WeChatForwardedMessageItem,
  userDisplayName: string,
  cardSenderCharacterId?: string,
): boolean {
  if (cardSenderCharacterId?.trim()) {
    if (m.senderKind === 'player') return true
    return false
  }
  if (m.senderKind === 'player') return true
  const name = m.senderName.trim()
  const user = userDisplayName.trim()
  return name === '我' || (!!user && name === user)
}

function isCardSenderSpeakerName(name: string): boolean {
  const n = name.trim()
  return n === '你' || n === '我'
}

/** 解析发言人备注与微信昵称，供全屏阅读器区分展示 */
export function useChatHistorySenderLabels(
  messages: readonly WeChatForwardedMessageItem[],
  options?: {
    userDisplayName?: string
    personaContacts?: readonly WeChatPersonaContact[]
    cardSenderCharacterId?: string
  },
): Map<string, ChatHistorySenderLabel> {
  const [labels, setLabels] = useState<Map<string, ChatHistorySenderLabel>>(() => new Map())

  useEffect(() => {
    const userDisplayName = options?.userDisplayName?.trim() || '我'
    const personaContacts = options?.personaContacts ?? []
    const cardSenderId = options?.cardSenderCharacterId?.trim()
    let cancelled = false

    void (async () => {
      const next = new Map<string, ChatHistorySenderLabel>()
      for (const m of messages) {
        const key = m.senderName.trim()
        if (!key || next.has(key)) continue

        if (isPlayerSender(m, userDisplayName, cardSenderId)) {
          next.set(key, { remarkName: userDisplayName })
          continue
        }

        const cid =
          m.senderCharacterId?.trim() ||
          (cardSenderId && isCardSenderSpeakerName(key) ? cardSenderId : undefined)
        const contact =
          (cid ? personaContacts.find((c) => c.characterId === cid) : undefined) ??
          personaContacts.find((c) => c.remarkName.trim() === key)

        let remark = contact?.remarkName.trim() || key
        let wechatNickname: string | undefined
        const lookupId = contact?.characterId?.trim() || cid
        if (lookupId) {
          try {
            remark = await resolveCharacterUserRemarkOrNickname(lookupId, personaContacts)
            const canon = (await resolveCanonicalCharacterId(lookupId)) || lookupId
            const ch = await personaDb.getCharacter(canon)
            const nick = ch?.wechatNickname?.trim()
            if (nick && nick !== remark) wechatNickname = nick
          } catch {
            // ignore
          }
        }
        next.set(key, { remarkName: remark, wechatNickname })
      }
      if (!cancelled) setLabels(next)
    })()

    return () => {
      cancelled = true
    }
  }, [messages, options?.cardSenderCharacterId, options?.personaContacts, options?.userDisplayName])

  return labels
}
