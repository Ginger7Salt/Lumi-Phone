import {
  applyCharacterMomentPinDirectives,
  type CharacterMomentPinDirective,
} from '../../../components/moments/momentPinService'

const PIN_DIRECTIVE_RE =
  /^\[(?:置顶朋友圈|PIN_MOMENT|MOMENT_PIN)\](?:\s*(\{[\s\S]*\}))?\s*$/i
const UNPIN_DIRECTIVE_RE =
  /^\[(?:取消置顶朋友圈|UNPIN_MOMENT|MOMENT_UNPIN)\](?:\s*(\{[\s\S]*\}))?\s*$/i

function parseDirectivePayload(raw?: string | null): Pick<
  CharacterMomentPinDirective,
  'momentId' | 'hint' | 'index'
> {
  const jsonRaw = String(raw ?? '').trim()
  if (!jsonRaw) return {}
  try {
    const j = JSON.parse(jsonRaw) as {
      momentId?: unknown
      id?: unknown
      hint?: unknown
      content?: unknown
      index?: unknown
      nth?: unknown
    }
    const momentId = String(j.momentId ?? j.id ?? '').trim() || undefined
    const hint = String(j.hint ?? j.content ?? '').trim() || undefined
    const indexRaw = Number(j.index ?? j.nth)
    const index =
      Number.isFinite(indexRaw) && indexRaw >= 1 ? Math.round(indexRaw) : undefined
    return { momentId, hint, index }
  } catch {
    return {}
  }
}

export function parseCharacterMomentPinDirective(line: string): CharacterMomentPinDirective | null {
  const t = String(line ?? '').trim()
  if (!t) return null
  const pinMatch = PIN_DIRECTIVE_RE.exec(t)
  if (pinMatch) {
    return { action: 'pin', ...parseDirectivePayload(pinMatch[1]) }
  }
  const unpinMatch = UNPIN_DIRECTIVE_RE.exec(t)
  if (unpinMatch) {
    return { action: 'unpin', ...parseDirectivePayload(unpinMatch[1]) }
  }
  return null
}

export function filterCharacterMomentPinDirectives(bubbles: string[]): {
  bubbles: string[]
  directives: CharacterMomentPinDirective[]
} {
  const directives: CharacterMomentPinDirective[] = []
  const next = bubbles.filter((line) => {
    const directive = parseCharacterMomentPinDirective(line)
    if (!directive) return true
    directives.push(directive)
    return false
  })
  return { bubbles: next, directives }
}

export { applyCharacterMomentPinDirectives }

export async function stripAndApplyCharacterMomentPinDirectives(params: {
  accountId: string | null | undefined
  characterId: string
  bubbles: string[]
}): Promise<string[]> {
  const filtered = filterCharacterMomentPinDirectives(params.bubbles)
  if (filtered.directives.length) {
    await applyCharacterMomentPinDirectives({
      accountId: params.accountId,
      characterId: params.characterId,
      directives: filtered.directives,
    })
  }
  return filtered.bubbles
}

export const WECHAT_CHARACTER_MOMENT_PIN_APPENDIX = `
---------------------
【朋友圈置顶 / 取消置顶（可选 · 每轮可用）】
---------------------
你可在**任意一轮**私聊中，自行决定是否把**你自己**已发布的某条朋友圈设为置顶，或取消置顶。**默认不必每轮都动**——置顶一般代表「最想让人先看到的那几条」，真人也不会频繁换顶；只有某条动态特别重要、关系节点、或用户明确要求时再改。

■ 怎么输出
- 先像真人一样用 **0～2 句**口语回应（可犹豫、确认、调侃），**不要**写成教程；也可静默直接改。
- 若你**决定**操作：在可见回复中**另起一行**，整行**只**输出以下指令之一（不要加引号或多余字）：
  - 置顶：\`[置顶朋友圈]{"momentId":"…"}\`（momentId 见上方「你的朋友圈 · 置顶参考」）
  - 用户只说「最新一条/刚发的那条」：用参考列表第 1 条的 momentId
  - 用户描述正文关键词：选最匹配的一条 momentId，或 \`{"hint":"关键词"}\`
  - 取消置顶：\`[取消置顶朋友圈]{"momentId":"…"}\`；若未指明哪条，取消**最近置顶**的那条
- 若你不愿、找不到对应动态、或用户指的是**用户自己**的朋友圈：只文字回应，**禁止**输出上述指令。
- 没有充分理由时保持现有置顶不变，**不要**为了刷存在感频繁换顶。
`.trim()

/** 用户消息里提及置顶时，帮助模型识别意图 */
export function buildUserMomentPinRequestBias(message?: string | null): string {
  const t = String(message ?? '').trim()
  if (!t) return ''
  const mentionsMoments = /朋友圈|动态|moment/i.test(t)
  const mentionsPin = /置顶|取消置顶|顶置|pin/i.test(t)
  if (!mentionsMoments || !mentionsPin) return ''
  return `[系统提示] 用户本轮在私聊中提到了**朋友圈置顶/取消置顶**。若用户是在请你操作**你自己的**朋友圈：查看上方「你的朋友圈 · 置顶参考」，愿意则先口语回应，再**单独一行**输出 \`[置顶朋友圈]{"momentId":"…"}\` 或 \`[取消置顶朋友圈]{"momentId":"…"}\`；找不到合适动态或你不愿则只文字婉拒，不要输出指令。`
}
