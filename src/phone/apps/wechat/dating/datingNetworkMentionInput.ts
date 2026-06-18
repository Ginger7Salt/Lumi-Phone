/** 输入框内人脉提及：id 全零宽编码 + 可见姓名，便于整段删除并与标签同步 */

const MENTION_HEAD = '\u2060\u2063'
const MENTION_MID = '\u2063\u2060'
const MENTION_TAIL = '\u2060'

/** 零宽二进制编码 id，避免 UUID 在输入框里可见 */
const ZW0 = '\u200B'
const ZW1 = '\u200C'

const LEGACY_MENTION_RE = /\u2060\u2063([^\u2063]+)\u2063\u2060([^\u2060]+)\u2060/g

export type DatingNetworkMentionSpan = {
  id: string
  displayName: string
  start: number
  end: number
}

function encodeInvisibleId(id: string): string {
  let out = ''
  for (let i = 0; i < id.length; i++) {
    const code = id.charCodeAt(i)!
    for (let bit = 7; bit >= 0; bit--) {
      out += (code >> bit) & 1 ? ZW1 : ZW0
    }
  }
  return out
}

function decodeInvisibleId(encoded: string): string {
  const bits: number[] = []
  for (const ch of encoded) {
    if (ch === ZW0) bits.push(0)
    else if (ch === ZW1) bits.push(1)
    else break
  }
  const chars: string[] = []
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    let code = 0
    for (let j = 0; j < 8; j++) code = (code << 1) | bits[i + j]!
    chars.push(String.fromCharCode(code))
  }
  return chars.join('')
}

function isInvisibleIdPayload(payload: string): boolean {
  return payload.length > 0 && /^[\u200B\u200C]+$/.test(payload)
}

function parseMentionAt(text: string, start: number): DatingNetworkMentionSpan | null {
  if (!text.startsWith(MENTION_HEAD, start)) return null
  const idStart = start + MENTION_HEAD.length
  const midIdx = text.indexOf(MENTION_MID, idStart)
  if (midIdx === -1) return null
  const idPayload = text.slice(idStart, midIdx)
  const id = isInvisibleIdPayload(idPayload) ? decodeInvisibleId(idPayload).trim() : idPayload.trim()
  const nameStart = midIdx + MENTION_MID.length
  const tailIdx = text.indexOf(MENTION_TAIL, nameStart)
  if (tailIdx === -1) return null
  const displayName = text.slice(nameStart, tailIdx).trim()
  if (!id || !displayName) return null
  return { id, displayName, start, end: tailIdx + MENTION_TAIL.length }
}

export function encodeDatingNetworkMention(id: string, displayName: string): string {
  const cid = id.trim()
  const name = displayName.trim() || '未命名'
  return `${MENTION_HEAD}${encodeInvisibleId(cid)}${MENTION_MID}${name}${MENTION_TAIL}`
}

export function listDatingNetworkMentions(text: string): DatingNetworkMentionSpan[] {
  const out: DatingNetworkMentionSpan[] = []
  let i = 0
  while (i < text.length) {
    const span = parseMentionAt(text, i)
    if (span) {
      out.push(span)
      i = span.end
      continue
    }
    i += 1
  }
  return out
}

export function collectDatingNetworkMentionIds(text: string): string[] {
  return [...new Set(listDatingNetworkMentions(text).map((m) => m.id))]
}

/** 将旧版「可见 UUID + 姓名」提及重写为仅姓名可见的新格式 */
export function migrateLegacyDatingNetworkMentions(text: string): string {
  const mentions = listDatingNetworkMentions(text)
  if (!mentions.length) return text
  let out = text
  for (const m of [...mentions].reverse()) {
    const segment = text.slice(m.start, m.end)
    const idStart = MENTION_HEAD.length
    const midIdx = segment.indexOf(MENTION_MID, idStart)
    const idPayload = midIdx === -1 ? '' : segment.slice(idStart, midIdx)
    if (isInvisibleIdPayload(idPayload)) continue
    const nextToken = encodeDatingNetworkMention(m.id, m.displayName)
    out = out.slice(0, m.start) + nextToken + out.slice(m.end)
  }
  return out
}

/** 落库 / 展示用：去掉零宽标记，仅保留可见姓名 */
export function stripDatingNetworkMentionMarkers(text: string): string {
  const mentions = listDatingNetworkMentions(text)
  if (!mentions.length) {
    return text.replace(LEGACY_MENTION_RE, (_full, _id, name) => String(name ?? ''))
  }
  let out = text
  for (const m of [...mentions].reverse()) {
    out = out.slice(0, m.start) + m.displayName + out.slice(m.end)
  }
  return out
}

export function removeDatingNetworkMentionById(text: string, characterId: string): string {
  const cid = characterId.trim()
  if (!cid) return text
  const mentions = listDatingNetworkMentions(text)
  if (!mentions.length) {
    const escaped = cid.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\u2060\\u2063${escaped}\\u2063\\u2060[^\\u2060]+\\u2060`, 'g')
    return text.replace(re, '')
  }
  let out = text
  for (const m of [...mentions].reverse()) {
    if (m.id !== cid) continue
    out = out.slice(0, m.start) + out.slice(m.end)
  }
  return out
}

export function insertDatingNetworkMentionAtCursor(params: {
  text: string
  id: string
  displayName: string
  selectionStart?: number | null
  selectionEnd?: number | null
}): { nextText: string; cursor: number } {
  const token = encodeDatingNetworkMention(params.id, params.displayName)
  const start = params.selectionStart ?? params.text.length
  const end = params.selectionEnd ?? params.text.length
  const nextText = params.text.slice(0, start) + token + params.text.slice(end)
  return { nextText, cursor: start + token.length }
}

export function handleDatingNetworkMentionKeyDown(
  e: { key: string; preventDefault: () => void; currentTarget: HTMLTextAreaElement },
  text: string,
  apply: (nextText: string, cursor: number) => void,
): boolean {
  if (e.key !== 'Backspace' && e.key !== 'Delete') return false

  const el = e.currentTarget
  const selStart = el.selectionStart ?? 0
  const selEnd = el.selectionEnd ?? 0
  if (selStart !== selEnd) return false

  const mentions = listDatingNetworkMentions(text)
  for (const m of mentions) {
    if (e.key === 'Backspace' && selStart > m.start && selStart <= m.end) {
      e.preventDefault()
      apply(text.slice(0, m.start) + text.slice(m.end), m.start)
      return true
    }
    if (e.key === 'Delete' && selStart >= m.start && selStart < m.end) {
      e.preventDefault()
      apply(text.slice(0, m.start) + text.slice(m.end), m.start)
      return true
    }
  }
  return false
}
