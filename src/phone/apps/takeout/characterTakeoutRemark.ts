/** 角色点外卖时 remark 的语义：主要是写在小票上给用户的悄悄话，而非厨房备注。 */

export type ParsedCharacterTakeoutRemark = {
  /** 写在小票上、用户拆封时会看到的寄语 */
  userMessage: string
  /** 仅当原文含「对商家：」等前缀时才有，才是跟商家说的口播/口味要求 */
  merchantInstruction?: string
}

const MERCHANT_SPLIT = /(?:对商家|给商家|商家备注|厨房备注)\s*[：:]\s*/i

export function parseCharacterTakeoutRemark(remark: string): ParsedCharacterTakeoutRemark {
  const raw = remark.trim()
  if (!raw) return { userMessage: '' }

  const parts = raw.split(MERCHANT_SPLIT)
  if (parts.length < 2) {
    return { userMessage: raw }
  }

  const userMessage = parts[0]!.trim().replace(/[，,、]\s*$/, '')
  const merchantInstruction = parts.slice(1).join('').trim()

  return {
    userMessage,
    merchantInstruction: merchantInstruction || undefined,
  }
}

export function formatCharacterRemarkForObserverPrompt(
  remark: string,
  recipientLabel: string,
): string {
  const { userMessage, merchantInstruction } = parseCharacterTakeoutRemark(remark)

  const lines = [
    '【小票寄语 · 系统已处理】',
    '角色下单时写入的 remark 会随寻味订单**自动出票打印**在小票上，用户拆封时才看到。',
    '**禁止**在角色↔商家/骑手微信对话里：确认或要求打印小票、复读 remark 正文、讨论「订单备注会不会印上去」等。',
  ]

  if (userMessage) {
    lines.push(
      `（内部参考，勿写入对话）给收件人「${recipientLabel}」的寄语已写入订单，对话中**不得出现其原文或转述**。`,
    )
  } else if (!merchantInstruction) {
    lines.push('（角色未写小票寄语）')
  }

  if (merchantInstruction) {
    lines.push(
      `【需在微信里口头转告商家】${merchantInstruction}`,
      '（仅此部分可在与商家对话中自然提及，仍不要提小票打印。）',
    )
  }

  return lines.join('\n')
}
