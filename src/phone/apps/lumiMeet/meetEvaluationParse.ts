/**
 * 遇见临时会话：解析模型输出的 <evaluation> 情感判定块（须在所有气泡解析之前剔除）
 */

export type MeetReplyEvaluation = {
  /** -5 … +5 */
  affectionChange: number
  proactiveSwap: boolean
  swapInstruction: string
  /** 模型侧确认可完成互换（可选） */
  swapConfirm: boolean
}

function parseBoolish(s: string | undefined): boolean {
  const t = String(s ?? '').trim().toLowerCase()
  return t === 'true' || t === '1' || t === 'yes'
}

function parseInnerTag(inner: string, tag: string): string {
  const re = new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i')
  const m = inner.match(re)
  return (m?.[1] ?? '').trim()
}

export function parseEvaluationInner(inner: string): MeetReplyEvaluation {
  const acRaw = parseInnerTag(inner, 'affection_change')
  const n = Number.parseInt(String(acRaw).replace(/[^\d+-]/g, '').slice(0, 4), 10)
  let affectionChange = Number.isFinite(n) ? n : 0
  affectionChange = Math.max(-5, Math.min(5, affectionChange))

  const proactiveSwap = parseBoolish(parseInnerTag(inner, 'proactive_swap'))
  const swapConfirm = parseBoolish(parseInnerTag(inner, 'swap_confirm'))
  const swapInstruction = parseInnerTag(inner, 'swap_instruction').slice(0, 280)

  return {
    affectionChange,
    proactiveSwap,
    swapInstruction,
    swapConfirm,
  }
}

/** 从完整模型输出中移除 <evaluation>…</evaluation>，返回剩余正文供气泡解析 */
export function stripMeetEvaluationBlock(raw: string): { visible: string; evaluation: MeetReplyEvaluation | null } {
  const src = String(raw ?? '')
  const m = src.match(/<evaluation\b[^>]*>([\s\S]*?)<\/evaluation>/i)
  if (!m) return { visible: src, evaluation: null }
  const inner = m[1] ?? ''
  if (!inner.trim()) {
    const visible = src.replace(m[0], '').trim()
    return { visible, evaluation: null }
  }
  const evaluation = parseEvaluationInner(inner)
  const visible = src.replace(m[0], '').trim()
  return { visible, evaluation }
}

/** 合并 strip evaluation + 供 parseMeetNpcReplyBubbles 使用的正文 */
export function prepareMeetNpcReplyForParsing(raw: string): {
  evaluation: MeetReplyEvaluation | null
  bodyForBubbles: string
} {
  const { visible, evaluation } = stripMeetEvaluationBlock(raw)
  return { evaluation, bodyForBubbles: visible }
}
