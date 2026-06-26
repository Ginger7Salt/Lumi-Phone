import type { ChatTranscriptTurn } from '../wechatChatAi'
import type { WeChatChatMessage } from '../newFriendsPersona/types'
import { extractStickerRefFromContent, parseCharacterStickerLine } from './stickerStore'

/** 注入 prompt：列出最近若干条角色表情引用名 */
export const RECENT_CHARACTER_STICKER_REF_LIMIT = 8
/** 与最近 N 条角色表情引用名相同则客户端丢弃该条 */
export const STICKER_REPEAT_SKIP_IF_IN_LAST_N = 2

export function collectRecentCharacterStickerRefsFromTranscript(
  transcript: ChatTranscriptTurn[],
  maxCount = RECENT_CHARACTER_STICKER_REF_LIMIT,
): string[] {
  const refs: string[] = []
  for (let i = transcript.length - 1; i >= 0 && refs.length < maxCount; i -= 1) {
    const t = transcript[i]
    if (!t || t.from !== 'other') continue
    const ref = extractStickerRefFromContent(String(t.text ?? ''))
    if (!ref) continue
    refs.unshift(ref)
  }
  return refs
}

export function collectRecentCharacterStickerRefsFromMessages(
  messages: Array<Pick<WeChatChatMessage, 'type' | 'content' | 'stickerRef' | 'isRecalled' | 'timestamp'>>,
  maxCount = RECENT_CHARACTER_STICKER_REF_LIMIT,
): string[] {
  const refs: string[] = []
  const sorted = [...messages]
    .filter((m) => !m.isRecalled)
    .sort((a, b) => (a.timestamp ?? 0) - (b.timestamp ?? 0))
  for (let i = sorted.length - 1; i >= 0 && refs.length < maxCount; i -= 1) {
    const m = sorted[i]
    if (!m || m.type !== 'character') continue
    const ref = m.stickerRef?.trim() || extractStickerRefFromContent(m.content)
    if (!ref) continue
    refs.unshift(ref)
  }
  return refs
}

export function normalizeStickerRefKey(ref: string): string {
  return String(ref ?? '')
    .normalize('NFKC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\(/g, '（')
    .replace(/\)/g, '）')
    .replace(/\s+/g, ' ')
    .trim()
}

export function wasCharacterStickerRefUsedRecently(
  ref: string,
  recentRefs: string[],
  lookback = STICKER_REPEAT_SKIP_IF_IN_LAST_N,
): boolean {
  const key = normalizeStickerRefKey(ref)
  if (!key || !recentRefs.length) return false
  const tail = recentRefs.slice(-Math.max(1, lookback))
  return tail.some((r) => normalizeStickerRefKey(r) === key)
}

export function formatStickerTranscriptLine(ref?: string | null): string {
  const r = String(ref ?? '').trim()
  return r ? `[表情包]${r}` : '[表情包]'
}

/** 从 ChatMsg 字段拼 transcript 用表情包行 */
export function stickerTranscriptTextFromFields(text: string | undefined, stickerRef?: string): string | null {
  const ref = stickerRef?.trim() || extractStickerRefFromContent(text ?? '')
  if (ref) return formatStickerTranscriptLine(ref)
  const t = String(text ?? '').trim()
  if (t.startsWith('[表情包]')) return t
  return null
}

export function shouldSkipDuplicateCharacterSticker(
  line: string,
  recentRefs: string[],
): { skip: boolean; ref: string | null } {
  const hit = parseCharacterStickerLine(line)
  if (!hit?.ref) return { skip: false, ref: null }
  return {
    skip: wasCharacterStickerRefUsedRecently(hit.ref, recentRefs),
    ref: hit.ref,
  }
}
