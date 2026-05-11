/**
 * 遇见临时会话：解析模型输出为多条气泡（与微信私聊解析规则对齐的精简版）。
 * 独立于 wechatChatAi，避免 lumiMeet 拉取整棵微信 AI 依赖树。
 */

function stripAssistantFence(s: string): string {
  return s
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

function extractThinkingBlock(raw: string): { visible: string; thinking?: string } {
  const src = String(raw ?? '')
  const tagMatch = src.match(/<(thinking|think)\b[^>]*>([\s\S]*?)<\/\1>/i)
  if (tagMatch) {
    const thinking = String(tagMatch[2] ?? '').trim()
    const visible = src.replace(tagMatch[0], '').trim()
    return { visible, thinking: thinking || undefined }
  }
  const fencedMatch = src.match(/```(?:thinking|think|analysis)\s*([\s\S]*?)```/i)
  if (fencedMatch) {
    const thinking = String(fencedMatch[1] ?? '').trim()
    const visible = src.replace(fencedMatch[0], '').trim()
    return { visible, thinking: thinking || undefined }
  }
  return { visible: src }
}

function stripMessageIdMeta(line: string): string {
  return line
    .replace(/^\s*(?:\[消息ID[:：][^\]]+\]|【消息ID[:：][^】]+】)\s*/g, '')
    .trim()
}

function splitByInlineMessageIds(line: string): string[] {
  const t = String(line ?? '').trim()
  if (!t) return []
  const re = /\s*(?:\[消息ID[:：][^\]]+\]|【消息ID[:：][^】]+】)\s*/g
  const parts = t
    .split(re)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
  return parts.length ? parts : [t]
}

function splitSingleLineWechatBubble(line: string): string[] {
  const src = line.trim()
  if (!src) return []
  if (src.length <= 26) return [src]

  const parts = src
    .split(/(?<=[。！？；!?]|……)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length <= 1) return [src]

  const out: string[] = []
  let acc = ''
  for (const p of parts) {
    const next = acc ? `${acc}${p}` : p
    if (next.length <= 24) {
      acc = next
      continue
    }
    if (acc) out.push(acc)
    acc = p
  }
  if (acc) out.push(acc)
  return out.length ? out : [src]
}

/** 将模型原始输出拆成多条口语气泡文本（已移除思维链块）。 */
export function parseMeetNpcReplyBubbles(raw: string): string[] {
  const t0 = stripAssistantFence(raw)
  if (!t0) return []
  const { visible: noThinking } = extractThinkingBlock(t0)
  const t = noThinking.replace(/\\n/g, '\n').trim()
  if (!t) return []

  const lines = t
    .split(/\r?\n/)
    .flatMap((rawLine) => {
      const trimmed = rawLine.trim()
      if (!trimmed) return []
      return splitByInlineMessageIds(trimmed)
        .map((seg) => stripMessageIdMeta(seg).trim())
        .filter((s) => s.length > 0)
    })

  const base = lines.length ? lines : []
  const bubbles =
    base.length !== 1 ? base : base[0] ? splitSingleLineWechatBubble(base[0]) : []

  return bubbles.map((s) => s.trim()).filter((s) => s.length > 0)
}
