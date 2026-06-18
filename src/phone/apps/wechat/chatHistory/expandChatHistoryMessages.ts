import type { WeChatForwardedMessageItem } from '../newFriendsPersona/types'

const SPLIT_GAP_MS = 60_000

function cloneSenderFields(m: WeChatForwardedMessageItem): Omit<WeChatForwardedMessageItem, 'content' | 'timestamp' | 'timeHint'> {
  const {
    content: _c,
    timestamp: _t,
    timeHint: _th,
    ...rest
  } = m
  return rest
}

/** 单条 content 内误用换行写多句 → 拆成多条独立消息 */
function splitMultilineContent(m: WeChatForwardedMessageItem): WeChatForwardedMessageItem[] {
  const raw = m.content ?? ''
  if (!raw.includes('\n')) return [m]

  const parts = raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  if (parts.length <= 1) return [m]

  const baseTs =
    typeof m.timestamp === 'number' && Number.isFinite(m.timestamp) ? m.timestamp : undefined
  const shared = cloneSenderFields(m)

  return parts.map((content, i) => ({
    ...shared,
    content: content.slice(0, 500),
    ...(baseTs != null ? { timestamp: baseTs + i * SPLIT_GAP_MS } : {}),
  }))
}

/** 展开伪造/转发记录：禁止「一条里换行写多句」 */
export function expandChatHistoryMessages(
  messages: readonly WeChatForwardedMessageItem[],
): WeChatForwardedMessageItem[] {
  const out: WeChatForwardedMessageItem[] = []
  for (const m of messages) {
    out.push(...splitMultilineContent(m))
  }
  return out
}
