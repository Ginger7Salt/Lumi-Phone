import type { WeChatForwardedMessageItem } from '../newFriendsPersona/types'

export function buildChatHistoryTitleFromPartyNames(a: string, b: string): string {
  const left = a.trim() || '未知'
  const right = b.trim() || '未知'
  return `${left} 和 ${right} 的聊天记录`
}

/** 标题里的占位/泛称：应用消息里真实发言人昵称替换 */
const TITLE_PARTY_PLACEHOLDER_RE =
  /^(XXX|xxx|某某|某人|某位|前同事|同事|朋友|对方|路人|网友|陌生人|他|她|TA|ta)$/i

export function isChatHistoryTitlePartyPlaceholder(name: string): boolean {
  const n = name.trim()
  if (!n) return true
  if (TITLE_PARTY_PLACEHOLDER_RE.test(n)) return true
  if (/^某/.test(n)) return true
  return false
}

function parseLooseTitleParticipants(title: string): { a: string; b: string } | null {
  const t = title.trim()
  const patterns = [/^(.+?)\s*和\s*(.+?)\s*的聊天记录$/, /^(.+?)\s*和\s*(.+?)\s*的对话$/]
  for (const re of patterns) {
    const m = re.exec(t)
    if (m?.[1]?.trim() && m?.[2]?.trim()) {
      return { a: m[1].trim(), b: m[2].trim() }
    }
  }
  return null
}

function isSameSenderParty(
  m: WeChatForwardedMessageItem | undefined,
  senderDisplay: string,
  cardSenderId?: string,
): boolean {
  if (!m) return false
  const name = m.senderName.trim()
  if (senderDisplay && name === senderDisplay) return true
  if (cardSenderId && m.senderCharacterId?.trim() === cardSenderId) return true
  return false
}

/** 从已 mask 的消息里取「卡片发送方 + 对方」展示名，统一标题与预览 */
export function buildChatHistoryDisplayTitleFromMessages(params: {
  messages: readonly WeChatForwardedMessageItem[]
  cardSenderDisplayName: string
  cardSenderCharacterId?: string
  fallbackTitle?: string
}): string {
  const senderDisplay = params.cardSenderDisplayName.trim()
  const cardSenderId = params.cardSenderCharacterId?.trim()
  const orderedSenders: string[] = []
  for (const m of params.messages) {
    const name = m.senderName.trim()
    if (!name) continue
    if (!orderedSenders.includes(name)) orderedSenders.push(name)
  }

  let otherParty: string | undefined
  for (const m of params.messages) {
    const name = m.senderName.trim()
    if (!name) continue
    if (isSameSenderParty(m, senderDisplay, cardSenderId)) continue
    otherParty = name
    break
  }

  if (senderDisplay && otherParty) {
    return buildChatHistoryTitleFromPartyNames(senderDisplay, otherParty)
  }

  const fallback = params.fallbackTitle?.trim()
  if (fallback) {
    const parts = parseLooseTitleParticipants(fallback)
    if (parts) {
      const a = isChatHistoryTitlePartyPlaceholder(parts.a) ? senderDisplay || parts.a : parts.a
      const b = isChatHistoryTitlePartyPlaceholder(parts.b) ? otherParty || parts.b : parts.b
      if (a.trim() && b.trim()) return buildChatHistoryTitleFromPartyNames(a, b)
    }
    return fallback
  }

  if (orderedSenders.length >= 2) {
    return buildChatHistoryTitleFromPartyNames(orderedSenders[0]!, orderedSenders[1]!)
  }
  return '聊天记录'
}
