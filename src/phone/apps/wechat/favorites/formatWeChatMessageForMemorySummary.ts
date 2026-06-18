import type { WeChatChatMessage } from '../newFriendsPersona/types'
import { formatChatHistoryForMemorySummary } from '../chatHistory/formatChatHistoryForMemorySummary'
import { isSharedRecordPlayerOrigin } from './sharedRecordOrigin'
import { resolveCharacterRealNameForSharedRecord } from './sharedRecordOriginNames'

function sharedRecordTypeLabel(recordType: 'text' | 'voice' | 'image'): string {
  if (recordType === 'voice') return '语音收藏'
  if (recordType === 'image') return '图片收藏'
  return '文字收藏'
}

/** 从待总结消息里收集收藏原发送方人设 id（供记忆总结 sanitize 展开姓名）。 */
export function collectSharedRecordOriginCharacterIds(
  messages: readonly WeChatChatMessage[],
): string[] {
  const out = new Set<string>()
  for (const m of messages) {
    const sr = m.sharedRecord
    if (!sr) continue
    const id = sr.originalSenderCharacterId.trim()
    if (!id || isSharedRecordPlayerOrigin(id)) continue
    out.add(id)
  }
  return [...out]
}

/**
 * 自动总结用的单条消息正文：收藏须带原发送者人设真名 + 内容摘要（禁止只写 [收藏] 或角色 id）。
 */
export async function formatWeChatMessageTextForMemorySummary(
  m: WeChatChatMessage,
): Promise<string | null> {
  if (m.isRecalled) {
    const who = m.type === 'player' ? '我' : '对方'
    return `（${who}撤回了一条消息）`
  }

  if (m.sharedRecord) {
    const sr = m.sharedRecord
    const senderKind =
      sr.originalSenderKind ?? (isSharedRecordPlayerOrigin(sr.originalSenderCharacterId) ? 'player' : 'character')
    let originName = '未知来源'
    if (senderKind === 'player' || isSharedRecordPlayerOrigin(sr.originalSenderCharacterId)) {
      originName = '用户'
    } else {
      originName =
        (await resolveCharacterRealNameForSharedRecord(sr.originalSenderCharacterId)) ||
        sr.originalSenderName.trim() ||
        '未知来源'
    }
    const typeLabel = sharedRecordTypeLabel(sr.recordType)
    const summary = sr.contentSummary.trim() || '（空内容）'
    const originId =
      senderKind === 'player' || isSharedRecordPlayerOrigin(sr.originalSenderCharacterId)
        ? ''
        : sr.originalSenderCharacterId.trim()
    const idHint = originId ? `；人设id：\`${originId}\`` : ''
    return `（向当前会话对象转发【收藏】；原发送者「${originName}」${idHint}；类型：${typeLabel}；内容：${summary}）`
  }

  if (m.chatHistory?.messages?.length) {
    return formatChatHistoryForMemorySummary({
      payload: m.chatHistory,
      messageType: m.type === 'player' ? 'player' : 'character',
    })
  }

  if (m.voice) {
    const vt = m.voice.transcriptText?.trim() || String(m.content || '').trim() || '（语音）'
    const emo = m.voice.emotionLabel?.trim()
    return emo ? `（语音，情绪：${emo}）${vt}` : `（语音）${vt}`
  }

  if (m.images?.length && !String(m.content || '').trim()) {
    return '（发送了图片）'
  }

  if (m.redPacket && !String(m.content || '').trim()) {
    return `（红包，约 ¥${m.redPacket.amountYuan}）`
  }

  if (m.transfer && !String(m.content || '').trim()) {
    return '（转账）'
  }

  const text = String(m.content || '').trim()
  return text || null
}
