import type { WeChatPersonaContact } from '../../../types'
import type { WeChatChatHistoryPayload, WeChatForwardedMessageItem } from '../newFriendsPersona/types'
import { assignChatHistoryMessageTimestamps } from './assignChatHistoryMessageTimestamps'
import { resolveForwardedMessageTimestamps } from './parseChatHistoryTimeHint'
import { pickStableNetizenAvatarForChatHistoryNpc } from './ephemeralNpcChatHistoryAvatar'
import { parseChatHistoryTitleParticipants } from './buildParticipantAvatarMap'
import {
  isFirstPersonCardSenderName,
  resolveChatHistoryPartyCharacterId,
} from './resolveChatHistoryPartyCharacterId'

/** 角色伪造聊天记录落库前：标记发言人身份 + 为临时 NPC 分配稳定随机网友头像 */
export async function enrichCharacterForwardHistoryPayload(
  payload: WeChatChatHistoryPayload,
  cardSenderCharacterId: string,
  personaContacts: readonly WeChatPersonaContact[] = [],
  opts?: { anchorMs?: number },
): Promise<WeChatChatHistoryPayload> {
  const cid = cardSenderCharacterId.trim()
  if (!cid) return payload

  const anchorMs = opts?.anchorMs ?? Date.now()
  const occurredAtHint = payload.occurredAtHint?.trim() || undefined
  const titleSeed = payload.title.trim() || '聊天记录'
  const messages: WeChatForwardedMessageItem[] = []

  for (const m of payload.messages) {
    if (m.senderKind === 'player') {
      messages.push(m)
      continue
    }
    const stored = m.senderName.trim()
    if (isFirstPersonCardSenderName(stored)) {
      messages.push({ ...m, senderKind: 'character', senderCharacterId: cid })
      continue
    }

    const resolvedId =
      m.senderCharacterId?.trim() ||
      (await resolveChatHistoryPartyCharacterId({
        name: stored,
        personaContacts,
        cardSenderCharacterId: cid,
        participants: payload.participants,
      }))

    if (resolvedId) {
      messages.push({
        ...m,
        senderKind: 'character',
        senderCharacterId: resolvedId,
        senderAvatarUrl: undefined,
      })
      continue
    }

    const avatar =
      m.senderAvatarUrl?.trim() ||
      pickStableNetizenAvatarForChatHistoryNpc(`${titleSeed}::${stored}`) ||
      undefined
    messages.push({
      ...m,
      senderKind: 'character',
      ...(avatar ? { senderAvatarUrl: avatar } : {}),
    })
  }

  let participants = payload.participants
  if (!participants) {
    const titleParts = parseChatHistoryTitleParticipants(payload.title)
    if (titleParts) {
      const buildParticipant = async (displayName: string) => {
        const characterId = await resolveChatHistoryPartyCharacterId({
          name: displayName,
          personaContacts,
          cardSenderCharacterId: cid,
        })
        return {
          kind: 'character' as const,
          displayName,
          ...(characterId ? { characterId } : {}),
        }
      }
      participants = {
        a: await buildParticipant(titleParts.a),
        b: await buildParticipant(titleParts.b),
      }
    }
  }

  const resolvedTimestamps = resolveForwardedMessageTimestamps(messages, anchorMs, occurredAtHint)
  const stamped = assignChatHistoryMessageTimestamps(resolvedTimestamps, anchorMs, {
    historyWhenHint: occurredAtHint,
    titleHint: payload.title,
  })

  return {
    ...payload,
    messages: stamped,
    historyAnchorMs: anchorMs,
    ...(occurredAtHint ? { occurredAtHint } : {}),
    ...(participants ? { participants } : {}),
  }
}
