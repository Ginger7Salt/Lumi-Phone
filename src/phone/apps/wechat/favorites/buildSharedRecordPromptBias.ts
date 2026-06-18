import type { WeChatSharedRecordPayload } from '../newFriendsPersona/types'
import { resolveCanonicalCharacterId } from '../wechatGlobalCharacterRegistry'
import { sharedRecordTranscriptPreview } from './buildSharedRecordPayload'
import { resolveCharacterRealNameForSharedRecord } from './sharedRecordOriginNames'
import { resolveSharedRecordOriginKnowledge } from './resolveSharedRecordOriginKnowledge'
import { isSharedRecordPlayerOrigin } from './sharedRecordOrigin'

function formatSharedRecordTypeLabel(recordType: WeChatSharedRecordPayload['recordType']): string {
  if (recordType === 'voice') return '语音收藏'
  if (recordType === 'image') return '图片收藏'
  return '文字收藏'
}

function formatSharedRecordKindGuard(payload: WeChatSharedRecordPayload): string {
  const lines = [
    '- **硬性约束**：这是**聊天收藏**转发，不是截图、不是截屏、不是屏摄，也不是用户本轮新发的照片/图片消息。',
    '- **禁止**在回复里把收藏说成「截图」「截屏」「你发的图」；应理解为「用户把某段收藏转给你看」。',
  ]
  if (payload.recordType === 'image') {
    lines.push(
      '- 本条为**图片收藏**：内容是其它会话里被收藏的图片，不是用户刚刚拍摄或上传给当前对话的新图。',
    )
  }
  return lines.join('\n')
}

function formatOriginKnowledgeLine(
  knowledge: Awaited<ReturnType<typeof resolveSharedRecordOriginKnowledge>>,
  isSelfOrigin: boolean,
  isPlayerOrigin: boolean,
): string {
  const realName = knowledge.originRealName.trim() || '未知来源'
  if (isPlayerOrigin) {
    return `原发送者：【${realName}】（玩家本人，不是当前对话角色）。`
  }
  if (isSelfOrigin) return `原发送者：【${realName}】（即你自己）。`
  if (knowledge.originKnownToRecipient && knowledge.linkKind === 'mutual') {
    const knownName = knowledge.originNameAsKnownByRecipient.trim() || realName
    return `原发送者：【${knownName}】（真实姓名：${realName}；人脉关系图：**双向连线**，互相认识，已知这条出自谁）。`
  }
  if (knowledge.originKnownToRecipient && knowledge.linkKind === 'one_way') {
    const knownName = knowledge.originNameAsKnownByRecipient.trim() || realName
    const rel = knowledge.relationLabel?.trim()
    const relBit = rel ? `关系：${rel}；` : ''
    return `原发送者：【${knownName}】（真实姓名：${realName}；人脉关系图：**你→TA 单向连线**，${relBit}你认识 TA，已知这条出自谁）。`
  }
  if (knowledge.linkKind === 'one_way_reverse') {
    const nick = knowledge.originNameAsKnownByRecipient.trim() || realName
    return `原发送者：微信昵称【${nick}】（人设真实姓名：${realName}，非微信通讯录备注；人脉图仅有 **TA→你 单向连线**，你对 TA 身份应存疑，**只能按微信昵称称呼**）。`
  }
  const nick = knowledge.originNameAsKnownByRecipient.trim() || realName
  return `原发送者：微信昵称【${nick}】（人设真实姓名：${realName}，非微信通讯录备注；你们人脉图**无角色↔角色连线**，你对 TA 身份应存疑，**只能按微信昵称称呼，勿用备注或真名**）。`
}

function formatMisattributionGuard(params: {
  recipientDisplayName: string
  originRealName: string
  isSelfOrigin: boolean
  isPlayerOrigin: boolean
  originKnown: boolean
  linkKind: Awaited<ReturnType<typeof resolveSharedRecordOriginKnowledge>>['linkKind']
}): string {
  const who = params.recipientDisplayName.trim() || '你'
  const name = params.originRealName.trim() || '某人'
  if (params.isSelfOrigin) {
    return `- **硬性约束**：这是用户转发的、你本人曾经在其它对话里说/发过的记录；不要当成「用户曾对你说过」或「用户与你的陈年旧账」，除非用户明确在翻你们之间的旧话。`
  }
  if (params.isPlayerOrigin) {
    return `- **硬性约束**：正文是【${name}】在其它会话里说过/发过的内容，不是【${who}】说的，也不是用户曾对你（${who}）说的原话；禁止当成「陈年旧账」。`
  }
  if (params.originKnown) {
    return `- **硬性约束**：正文是【${name}】在其它会话里说过/发过的内容，不是用户曾对你（${who}）说的原话，也不是你曾对用户说的；禁止误判为「陈年旧账」或当成用户在自说自话。`
  }
  if (params.linkKind === 'one_way_reverse') {
    return `- **硬性约束**：正文来自用户转发的第三方收藏；你只能看到其**微信昵称**，不得使用通讯录备注或真实姓名；人脉图中 TA 可能认识你，但你不一定认识 TA，对来源应存疑；禁止默认当成用户曾对你说过，或当成你们私聊旧账。`
  }
  return `- **硬性约束**：正文来自用户转发的第三方收藏；你只能看到其**微信昵称**，不得使用通讯录备注或真实姓名；你们人脉图中无有效连线，你对来源应存疑；禁止默认当成用户曾对你说过，或当成用户在自说自话。`
}

function formatReactionGuide(
  knowledge: Awaited<ReturnType<typeof resolveSharedRecordOriginKnowledge>>,
  isSelfOrigin: boolean,
  isPlayerOrigin: boolean,
  recipientDisplayName: string,
): string {
  const realName = knowledge.originRealName.trim() || '未知来源'
  const knownName = knowledge.originNameAsKnownByRecipient.trim() || realName
  const commonTail = `- 默认当作普通转发消息处理：先接住用户为什么发这条，再就内容本身自然回应即可。
- 不必自动吃醋或质问；只有当下氛围与内容确实需要时，才适度流露情绪。`

  const guard = formatMisattributionGuard({
    recipientDisplayName,
    originRealName: realName,
    isSelfOrigin,
    isPlayerOrigin,
    originKnown: knowledge.originKnownToRecipient,
    linkKind: knowledge.linkKind,
  })

  if (isPlayerOrigin) {
    return `${guard}
- 用户把 TA 自己说过的话转给你看；可自然问「怎么突然翻出这句」，就内容接话即可。
${commonTail}`
  }

  if (isSelfOrigin) {
    return `${guard}
- 可先自然确认「你翻出这条了」，再按当下语境接话；若合适可略带回忆、害羞或调侃，但不要机械复述卡片原文。
${commonTail}`
  }

  if (knowledge.originKnownToRecipient && knowledge.linkKind === 'mutual') {
    return `${guard}
- 这是用户转发的、来自【${knownName}】（${realName}）的一条收藏记录。你们在人脉关系图中**双向认识**，你本来就知道这条出自谁；可直接用平时对他的称呼，不必假装不知道来源。
${commonTail}`
  }

  if (knowledge.originKnownToRecipient && knowledge.linkKind === 'one_way') {
    const rel = knowledge.relationLabel?.trim()
    const relBit = rel ? `（${rel}）` : ''
    return `${guard}
- 这是用户转发的、来自【${knownName}】（${realName}）的一条收藏记录。你在人脉图中有**指向 TA 的单向连线**${relBit}，你认识 TA，知道这条是 TA 说的；可直接用你对 TA 的称呼接话。
${commonTail}`
  }

  if (knowledge.linkKind === 'one_way_reverse') {
    return `${guard}
- 用户转发了标注微信昵称【${knownName}】的收藏；人脉图里 TA 可能认识你，但你不一定熟悉 TA，**不应**像亲耳听过 TA 说这句话一样接话；可表示不太确定、或问用户为什么要给你看。
${commonTail}`
  }

  return `${guard}
- 用户转发了标注微信昵称【${knownName}】的收藏，但你们人脉图中无连线，你**不应**像亲眼见过 ${realName} 说这句话一样接话；可表示不确定是谁说的、或问用户为什么要给你看。
${commonTail}`
}

export async function buildSharedRecordReplyBias(params: {
  recipientCharacterId: string
  recipientDisplayName: string
  payload: WeChatSharedRecordPayload
}): Promise<string> {
  const recipientId = params.recipientCharacterId.trim()
  const originId = params.payload.originalSenderCharacterId.trim()
  const senderKind =
    params.payload.originalSenderKind ?? (isSharedRecordPlayerOrigin(originId) ? 'player' : 'character')
  const isPlayerOrigin = senderKind === 'player' || isSharedRecordPlayerOrigin(originId)
  const summary = sharedRecordTranscriptPreview(params.payload)

  let isSelfOrigin = false
  if (!isPlayerOrigin && recipientId && originId) {
    const [recipientCanon, originCanon] = await Promise.all([
      resolveCanonicalCharacterId(recipientId),
      resolveCanonicalCharacterId(originId),
    ])
    isSelfOrigin = recipientCanon.trim() === originCanon.trim()
  }

  const knowledge = isSelfOrigin
    ? {
        originKnownToRecipient: true,
        linkKind: 'mutual' as const,
        originNameAsKnownByRecipient: await resolveCharacterRealNameForSharedRecord(originId),
        originRealName: await resolveCharacterRealNameForSharedRecord(originId),
      }
    : await resolveSharedRecordOriginKnowledge(recipientId, params.payload)

  return [
    '【系统提示：用户向你转发了一条【收藏】（来自其它会话的聊天收藏，非截图、非截屏、非用户本轮新发的图片，也非你们私聊原句）】',
    formatSharedRecordKindGuard(params.payload),
    formatOriginKnowledgeLine(knowledge, isSelfOrigin, isPlayerOrigin),
    `收藏类型：${formatSharedRecordTypeLabel(params.payload.recordType)}。`,
    `内容摘要：【${summary}】。`,
    formatReactionGuide(knowledge, isSelfOrigin, isPlayerOrigin, params.recipientDisplayName),
    '回复须符合人设与当前关系，字数适中；不要像机器人一样复述或逐字复读卡片内容；禁止把收藏称为截图。',
  ].join('\n')
}
