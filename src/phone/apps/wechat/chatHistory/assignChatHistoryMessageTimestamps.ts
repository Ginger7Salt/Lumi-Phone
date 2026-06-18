import type { WeChatForwardedMessageItem } from '../newFriendsPersona/types'
import { expandChatHistoryMessages } from './expandChatHistoryMessages'
import { resolveChatHistoryEndAnchorMs } from './parseChatHistoryTimeHint'

const DEFAULT_GAP_MS = 2 * 60 * 1000

function hasTimestamp(m: WeChatForwardedMessageItem): boolean {
  return typeof m.timestamp === 'number' && Number.isFinite(m.timestamp)
}

/** 在已有时间戳之间线性插值，补全缺失行 */
function fillMissingTimestamps(messages: WeChatForwardedMessageItem[]): WeChatForwardedMessageItem[] {
  const out = messages.map((m) => ({ ...m }))
  const known = out
    .map((m, i) => (hasTimestamp(m) ? i : -1))
    .filter((i) => i >= 0)
  if (!known.length) return out
  if (known.length === out.length) return out

  const first = known[0]!
  const last = known[known.length - 1]!
  const firstTs = out[first]!.timestamp!

  for (let i = first - 1; i >= 0; i -= 1) {
    out[i] = { ...out[i]!, timestamp: firstTs - (first - i) * DEFAULT_GAP_MS }
  }

  for (let k = 0; k < known.length - 1; k += 1) {
    const i0 = known[k]!
    const i1 = known[k + 1]!
    const t0 = out[i0]!.timestamp!
    const t1 = out[i1]!.timestamp!
    const span = i1 - i0
    for (let j = i0 + 1; j < i1; j += 1) {
      const ratio = (j - i0) / span
      out[j] = { ...out[j]!, timestamp: Math.round(t0 + (t1 - t0) * ratio) }
    }
  }

  const lastTs = out[last]!.timestamp!
  for (let i = last + 1; i < out.length; i += 1) {
    out[i] = { ...out[i]!, timestamp: lastTs + (i - last) * DEFAULT_GAP_MS }
  }

  return out
}

export type AssignChatHistoryTimestampsOptions = {
  historyWhenHint?: string
  titleHint?: string
}

/**
 * 为伪造/补全聊天记录行生成时间戳：
 * - 模型已写时间 → 保留并补全缺失行
 * - 有 when= / 标题语境 → 锚定到剧情内「曾经某刻」，而非发送当下
 */
export function assignChatHistoryMessageTimestamps(
  messages: readonly WeChatForwardedMessageItem[],
  anchorMs: number = Date.now(),
  opts?: AssignChatHistoryTimestampsOptions,
): WeChatForwardedMessageItem[] {
  if (!messages.length) return []

  const expanded = expandChatHistoryMessages(messages)
  const withTs = expanded.filter(hasTimestamp)
  if (withTs.length === expanded.length) {
    return fillMissingTimestamps(expanded.map((m) => ({ ...m })))
  }
  if (withTs.length > 0) {
    return fillMissingTimestamps(expanded.map((m) => ({ ...m })))
  }

  const endMs = resolveChatHistoryEndAnchorMs({
    anchorMs,
    historyWhenHint: opts?.historyWhenHint,
    titleHint: opts?.titleHint,
  })
  const start = endMs - Math.max(0, expanded.length - 1) * DEFAULT_GAP_MS
  return expanded.map((m, i) => ({
    ...m,
    timestamp: start + i * DEFAULT_GAP_MS,
  }))
}
