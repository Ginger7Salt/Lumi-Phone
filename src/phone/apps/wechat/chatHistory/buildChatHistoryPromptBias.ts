import type { WeChatPersonaContact } from '../../../types'
import type { WeChatChatHistoryPayload } from '../newFriendsPersona/types'
import {
  resolveForwardedPartyDisplayName,
  resolveForwardedPartyKnowledge,
} from '../favorites/resolveForwardedPartyDisplay'
import { resolveCharacterRealNameForSharedRecord } from '../favorites/sharedRecordOriginNames'
import { isSharedRecordPlayerOrigin } from '../favorites/sharedRecordOrigin'
import { parseChatHistoryTitleParticipants } from './buildParticipantAvatarMap'
import { maskChatHistoryForRecipient } from './maskChatHistoryForRecipient'

function formatParticipantKnowledgeLine(params: {
  displayName: string
  realName: string
  known: boolean
  linkKind: Awaited<ReturnType<typeof resolveForwardedPartyKnowledge>>['linkKind']
  relationLabel?: string
}): string {
  const real = params.realName.trim() || '未知'
  // 认识对方时以真实姓名注入模型，不用人脉称呼
  const nick = params.known ? real : params.displayName.trim() || real
  if (params.known && params.linkKind === 'mutual') {
    return `- 参与者【${nick}】（真实姓名：${real}；人脉图双向认识，你知道 TA 是谁）`
  }
  if (params.known && params.linkKind === 'one_way') {
    const rel = params.relationLabel?.trim()
    return `- 参与者【${nick}】（真实姓名：${real}；人脉图你→TA 单向${rel ? `，${rel}` : ''}，你认识 TA）`
  }
  if (params.linkKind === 'one_way_reverse') {
    return `- 参与者微信昵称【${nick}】（真实姓名：${real}，非通讯录备注；仅有 TA→你 单向，你对其身份应存疑，**只能按微信昵称称呼**）`
  }
  return `- 参与者微信昵称【${nick}】（真实姓名：${real}，非通讯录备注；人脉图无连线，你对其身份应存疑，**只能按微信昵称称呼**）`
}

export async function buildChatHistoryReplyBias(params: {
  recipientCharacterId: string
  recipientDisplayName: string
  payload: WeChatChatHistoryPayload
  userDisplayName: string
  personaContacts: readonly WeChatPersonaContact[]
  cardSenderCharacterId?: string
}): Promise<string> {
  const masked = await maskChatHistoryForRecipient({
    payload: params.payload,
    recipientCharacterId: params.recipientCharacterId,
    userDisplayName: params.userDisplayName,
    personaContacts: params.personaContacts,
    cardSenderCharacterId: params.cardSenderCharacterId,
    nameResolution: 'ai',
  })

  const titleParts = parseChatHistoryTitleParticipants(params.payload.title)
  const participantLines: string[] = []

  if (params.payload.participants) {
    for (const p of [params.payload.participants.a, params.payload.participants.b]) {
      if (p.kind === 'player' || isSharedRecordPlayerOrigin(p.characterId ?? '')) {
        participantLines.push(`- 参与者【${params.userDisplayName.trim() || '用户'}】（用户本人）`)
        continue
      }
      const cid = p.characterId?.trim()
      if (!cid) {
        participantLines.push(`- 参与者【${p.displayName.trim() || '未知'}】（身份未绑定人设，对其存疑）`)
        continue
      }
      const knowledge = await resolveForwardedPartyKnowledge(params.recipientCharacterId, cid, 'character')
      const display =
        knowledge.originKnownToRecipient
          ? knowledge.originRealName.trim() || (await resolveCharacterRealNameForSharedRecord(cid))
          : await resolveForwardedPartyDisplayName({
              recipientCharacterId: params.recipientCharacterId,
              partyCharacterId: cid,
              partyKind: 'character',
              playerDisplayName: params.userDisplayName,
            })
      const realName = knowledge.originRealName.trim() || (await resolveCharacterRealNameForSharedRecord(cid))
      participantLines.push(
        formatParticipantKnowledgeLine({
          displayName: display,
          realName,
          known: knowledge.originKnownToRecipient,
          linkKind: knowledge.linkKind,
          relationLabel: knowledge.relationLabel,
        }),
      )
    }
  } else if (titleParts) {
    participantLines.push(
      `- 标题双方：${titleParts.a.trim() || '未知'} / ${titleParts.b.trim() || '未知'}（旧版记录未写入人设 id，请结合正文谨慎判断身份）`,
    )
  }

  const body = masked.messages
    .map((m) => {
      const who = m.senderName.trim() || '未知'
      const text = m.content.trim() || '...'
      return `[${who}: ${text}]`
    })
    .join('\n')

  return [
    '【系统提示：用户向你转发了一份聊天记录（非你们私聊原句，非截图）】',
    `- 你是【${params.recipientDisplayName.trim() || '当前角色'}】，请按你的人脉关系理解记录中的各方；**不认识的人只能看到其微信昵称，不得用通讯录备注或真实姓名称呼**。`,
    ...participantLines,
    `标题（你已看到的版本）：《${masked.title.trim() || '聊天记录'}》`,
    `正文：\n${body}`,
    `- **硬性约束**：记录中的对话发生在其他会话语境，不要默认是用户曾对你说过的话，也不要当成你们之间的陈年旧账；结合上方人脉信息自然反应即可。`,
    `- 不必机械复述全文；先接住用户为何转发，再就内容回应。`,
  ].join('\n')
}
