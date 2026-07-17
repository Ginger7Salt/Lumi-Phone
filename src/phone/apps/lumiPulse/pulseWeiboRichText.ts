import { resolveWeiboFaceUrl } from './pulseWeiboFace'
import { PUBLISH_SYNTAX_COLORS } from './pulsePublishSyntax'

/**
 * 微博方括号表情 + #话题# + @艾特（含 `@{{char|player:id}}` / 容错 `@{char|player:id}`）+ 【超话】
 * 优先匹配成对 #内容#（内容可含空格），再匹配「#词 后接空格」的未闭合话题。
 */
const RICH_TOKEN =
  /\[([\u4e00-\u9fa5a-z0-9_]+?)\]|[#＃]([^#＃\n\[\]]{1,40})[#＃]|[#＃]\s*([^#＃\[\]\s\n]{1,32})(?=\s)|@\{\{?(char|player):([^}]+)\}\}?|@([^\s@【】\[\]\n#＃\{\}]{1,40})(?=\s|$)|【([^】]{1,32})】/gi

export type PulseWeiboRichPart =
  | { type: 'text'; value: string }
  | { type: 'face'; name: string; url: string }
  | { type: 'hashtag'; tag: string; raw: string }
  /** name：表达式内层或纯文本昵称；raw：正文原样（可能含表达式） */
  | { type: 'mention'; name: string; raw: string; exprKind?: 'char' | 'player'; exprId?: string }
  | { type: 'supertopic'; name: string; raw: string }

/** 解析正文中的 [doge]、#话题#、@艾特、【超话】 */
export function parsePulseWeiboRichText(text: string): PulseWeiboRichPart[] {
  if (!text) return []

  // 模型常写出全角方括号，先归一成半角再解析表情
  // 艾特容错：@{char:id} / @{{char:id}} 统一成双花括号再匹配
  const normalized = String(text)
    .replace(/\uFF3B/g, '[') // ［
    .replace(/\uFF3D/g, ']') // ］
    .replace(/@\{(char|player):([^}]+)\}/gi, (_m, kind: string, id: string) => {
      const k = String(kind).toLowerCase() === 'player' ? 'player' : 'char'
      return `@{{${k}:${String(id).trim()}}}`
    })

  const hits: Array<{ start: number; end: number; part: PulseWeiboRichPart }> = []
  let match: RegExpExecArray | null

  const token = new RegExp(RICH_TOKEN.source, RICH_TOKEN.flags)
  while ((match = token.exec(normalized)) !== null) {
    const faceName = match[1]
    const tagPaired = match[2]
    const tagLoose = match[3]
    const mentionExprKind = match[4]
    const mentionExprId = match[5]
    const mentionPlain = match[6]
    const superName = match[7]

    if (faceName) {
      const face = resolveWeiboFaceUrl(faceName)
      hits.push({
        start: match.index,
        end: match.index + match[0].length,
        part: face
          ? { type: 'face', name: face.name, url: face.url }
          : { type: 'text', value: match[0] },
      })
    } else if (tagPaired || tagLoose) {
      hits.push({
        start: match.index,
        end: match.index + match[0].length,
        part: { type: 'hashtag', tag: (tagPaired ?? tagLoose)!.trim(), raw: match[0] },
      })
    } else if (mentionExprKind && mentionExprId) {
      const kind = mentionExprKind.toLowerCase() === 'player' ? 'player' : 'char'
      const id = mentionExprId.trim()
      hits.push({
        start: match.index,
        end: match.index + match[0].length,
        part: {
          type: 'mention',
          name: `${kind}:${id}`,
          raw: match[0],
          exprKind: kind,
          exprId: id,
        },
      })
    } else if (mentionPlain) {
      hits.push({
        start: match.index,
        end: match.index + match[0].length,
        part: { type: 'mention', name: mentionPlain.trim(), raw: match[0] },
      })
    } else if (superName) {
      hits.push({
        start: match.index,
        end: match.index + match[0].length,
        part: { type: 'supertopic', name: superName.trim(), raw: match[0] },
      })
    }
  }

  hits.sort((a, b) => a.start - b.start)

  const parts: PulseWeiboRichPart[] = []
  let cursor = 0
  for (const hit of hits) {
    if (hit.start < cursor) continue
    if (hit.start > cursor) {
      parts.push({ type: 'text', value: normalized.slice(cursor, hit.start) })
    }
    parts.push(hit.part)
    cursor = hit.end
  }
  if (cursor < normalized.length) {
    parts.push({ type: 'text', value: normalized.slice(cursor) })
  }

  return parts.length ? parts : [{ type: 'text', value: normalized }]
}


/** 在输入框光标处插入文本；`cursorOffsetInInsert` 控制插入后光标相对插入串的位置（默认在末尾） */
export function insertAtTextareaCursor(
  current: string,
  insert: string,
  el: HTMLTextAreaElement | HTMLInputElement | null,
  cursorOffsetInInsert: number = insert.length,
): { next: string; cursor: number } {
  if (!el) {
    const offset = Math.min(Math.max(0, cursorOffsetInInsert), insert.length)
    return { next: current + insert, cursor: current.length + offset }
  }
  const start = el.selectionStart ?? current.length
  const end = el.selectionEnd ?? current.length
  const next = current.slice(0, start) + insert + current.slice(end)
  const offset = Math.min(Math.max(0, cursorOffsetInInsert), insert.length)
  return { next, cursor: start + offset }
}

export { PUBLISH_SYNTAX_COLORS }
