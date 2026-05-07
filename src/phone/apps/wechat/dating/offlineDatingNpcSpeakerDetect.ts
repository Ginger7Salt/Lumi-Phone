import type { Character } from '../newFriendsPersona/types'
import { textMentionsAnyToken } from './offlineDatingArchiveResolve'

/** 用于「姓名：」对白行的说话人前缀匹配（不含【名】占位，避免与旁白误配） */
function collectNpcDialogueSpeakerTokens(ch: Character | null): string[] {
  if (!ch) return []
  const s = new Set<string>()
  const add = (raw?: string | null) => {
    const t = String(raw ?? '').trim()
    if (t.length >= 2) s.add(t)
  }
  add(ch.name)
  add(ch.wechatNickname)
  add(ch.remark)
  const name = String(ch.name ?? '').trim()
  if (name.length === 1) s.add(name)
  return [...s].sort((a, b) => b.length - a.length)
}

function stripYouSuffix(s: string): string {
  return s.replace(/（\s*你\s*）|\(\s*你\s*\)/gu, '').replace(/\s+/g, ' ').trim()
}

/** 「内心｜」右侧、竖线前的主名（如 沈若琳·紧张 → 沈若琳） */
function innerBracketDeclaredSpeaker(raw: string): string {
  const m = String(raw ?? '')
    .trim()
    .match(/^【\s*(?:内心|心声|OS|os)\s*[｜|]\s*([^】]+?)\s*】/su)
  if (!m?.[1]) return ''
  return stripYouSuffix(String(m[1]).split(/[·•]/)[0] ?? '')
}

function speakerPrefixMatchesTokens(speakerRaw: string, tokens: string[]): boolean {
  const sp = stripYouSuffix(speakerRaw)
  if (!sp) return false
  for (const tok of tokens) {
    const t = tok.trim()
    if (t.length < 1) continue
    if (sp === t) return true
    if (t.length >= 2 && (sp.startsWith(`${t}（`) || sp.startsWith(`${t}(`) || sp.startsWith(`${t}·`))) return true
  }
  return false
}

/** `【对白】` 之后、行内第一套「某某：」的说话人 */
function taggedDialogueSpeakerPrefix(rest: string): string {
  const r = String(rest ?? '').trim()
  const m = r.match(/^([^：:\n]{1,48}(?:（\s*你\s*）|\(\s*你\s*\))?)[：:]/su)
  return m?.[1] ? stripYouSuffix(m[1]) : ''
}

/**
 * 无三标签时：行首「姓名：」旧稿对白（排除已是【…】开头的控制行）。
 */
function legacyLineLooksLikeNameColonDialogue(trimmed: string): boolean {
  const t = trimmed.replace(/^[-*•\d.)\s]+/, '').trim()
  if (!t || /^【/u.test(t)) return false
  if (/^【\s*旁白\s*】/u.test(t)) return false
  return /^[^：:\n]{1,48}(?:（\s*你\s*）|\(\s*你\s*\))?[：:]\s*\S/u.test(t)
}

function legacyDialogueSpeakerPrefix(trimmed: string): string {
  const t = trimmed.replace(/^[-*•\d.)\s]+/, '').trim()
  const m = t.match(/^([^：:\n]{1,48}(?:（\s*你\s*）|\(\s*你\s*\))?)[：:]/su)
  return m?.[1] ? stripYouSuffix(m[1]) : ''
}

function lineAttributesSpeechToNpc(line: string, speakerTokens: string[]): boolean {
  const t = line.trim()
  if (!t) return false

  const dia = t.match(/^【\s*对白\s*】\s*(.*)$/su)
  if (dia) {
    const pref = taggedDialogueSpeakerPrefix(String(dia[1] ?? ''))
    return speakerPrefixMatchesTokens(pref, speakerTokens)
  }

  const innNamed = t.match(/^【\s*(?:内心|心声|OS|os)\s*[｜|]\s*[^】]+?\s*】/su)
  if (innNamed) {
    const declared = innerBracketDeclaredSpeaker(t)
    return speakerPrefixMatchesTokens(declared, speakerTokens)
  }

  /** 无竖线的【内心】在约会规则里默认归主角，不记为 NPC 本人内心条 */
  if (/^【\s*(?:内心|心声|OS|os)\s*】/u.test(t)) return false

  if (/^【\s*旁白\s*】/u.test(t)) return false

  if (legacyLineLooksLikeNameColonDialogue(t)) {
    return speakerPrefixMatchesTokens(legacyDialogueSpeakerPrefix(t), speakerTokens)
  }

  return false
}

/**
 * 正文里是否出现「结构化对白/带名内心」行（有则优先按姓名框过滤，避免仅靠旁白提及）。
 */
export function offlinePlotBodyHasStructuredDialogueLines(body: string): boolean {
  const lines = String(body ?? '').split(/\r?\n/)
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    if (/^【\s*对白\s*】/u.test(t)) return true
    if (/^【\s*(?:内心|心声|OS|os)\s*[｜|]/u.test(t)) return true
    if (/^【\s*旁白\s*】/u.test(t)) continue
    if (legacyLineLooksLikeNameColonDialogue(t)) return true
  }
  return false
}

/**
 * 线下剧情正文（已去思维链）是否包含 **该 NPC 作为说话人** 的对白/带名内心行。
 * - VN：`【对白】姓名：…`、`【内心｜姓名】…`
 * - 旧稿：行首 `姓名：…`（非【旁白】）
 * 若全文无任何上述结构化对白行，则回退为「全文是否含人设名/昵称」（兼容非 VN 纯旁白稿）。
 */
export function offlinePlotBodyHasNpcSpeakerOrMentionFallback(
  body: string,
  npc: Character | null,
  mentionTokens: string[],
): boolean {
  const speakerTok = collectNpcDialogueSpeakerTokens(npc)
  if (!speakerTok.length && !mentionTokens.length) return false

  if (speakerTok.length && offlinePlotBodyHasStructuredDialogueLines(body)) {
    const lines = String(body ?? '').split(/\r?\n/)
    for (const line of lines) {
      if (lineAttributesSpeechToNpc(line, speakerTok)) return true
    }
    return false
  }

  return textMentionsAnyToken(body, mentionTokens)
}

/**
 * 用于「关联记忆」线下摘录：在已有结构化对白时，若该 NPC 未出现在任何一句的说话人槽位上，仍允许凭全文是否出现其**人设卡可核对**的姓名/昵称（上帝视角 `【旁白】` 常只在此写到配角）。
 * 微信侧注入仍用 {@link offlinePlotBodyHasNpcSpeakerOrMentionFallback}，避免旁白误触过多。
 */
export function offlinePlotBodyRelevantToNpcForLinkedExcerpt(
  body: string,
  npc: Character | null,
  mentionTokens: string[],
): boolean {
  const speakerTok = collectNpcDialogueSpeakerTokens(npc)
  if (!speakerTok.length && !mentionTokens.length) return false

  if (speakerTok.length && offlinePlotBodyHasStructuredDialogueLines(body)) {
    const lines = String(body ?? '').split(/\r?\n/)
    for (const line of lines) {
      if (lineAttributesSpeechToNpc(line, speakerTok)) return true
    }
    if (mentionTokens.length) return textMentionsAnyToken(body, mentionTokens)
    return false
  }

  return textMentionsAnyToken(body, mentionTokens)
}
