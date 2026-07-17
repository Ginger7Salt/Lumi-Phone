import {
  buildPulseMentionAliasMap,
  buildPulseMentionNicknameByPov,
  type PulseMentionDirectoryEntry,
  pulseMentionExprInnerToPovId,
} from './pulseMentionExpr'

/** 表达式艾特或纯文本艾特（与 pulseWeiboRichText 一致） */
const MENTION_RE =
  /@\{\{(char|player):([^}]+)\}\}|@([^\s@【】\[\]\n#＃\{\}]{1,40})(?=\s|$)/g

export function extractPulseMentionNames(text: string): string[] {
  const out: string[] = []
  const seen = new Set<string>()
  const src = String(text ?? '')
  MENTION_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MENTION_RE.exec(src)) !== null) {
    const exprKind = m[1]
    const exprId = m[2]
    const plain = m[3]
    const name =
      exprKind && exprId
        ? `${exprKind}:${exprId.trim()}`
        : (plain ?? '').trim()
    if (!name) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    out.push(name)
  }
  return out
}

/**
 * 是否 @ 到当前玩家：表达式命中 player pov，或纯文本命中别名。
 */
export function textMentionsAnyAlias(
  text: string,
  aliases: string[],
  opts?: {
    playerPovId?: string | null
    directory?: readonly PulseMentionDirectoryEntry[]
  },
): boolean {
  const src = String(text ?? '')
  if (!src.includes('@')) return false

  const playerPovId = opts?.playerPovId?.trim()
  const aliasKeys = aliases
    .map((a) => a.trim().toLowerCase())
    .filter(Boolean)

  const nickByPov = opts?.directory?.length
    ? buildPulseMentionNicknameByPov(opts.directory)
    : null
  const aliasMap = opts?.directory?.length
    ? buildPulseMentionAliasMap(opts.directory)
    : null

  MENTION_RE.lastIndex = 0
  let m: RegExpExecArray | null
  while ((m = MENTION_RE.exec(src)) !== null) {
    if (m[1] && m[2]) {
      const povId = pulseMentionExprInnerToPovId(m[1], m[2])
      if (playerPovId && povId === playerPovId) return true
      const nick = povId && nickByPov ? nickByPov.get(povId)?.toLowerCase() : ''
      if (nick && aliasKeys.includes(nick)) return true
      continue
    }
    const plain = (m[3] ?? '').trim().toLowerCase()
    if (!plain) continue
    if (aliasKeys.includes(plain)) return true
    if (playerPovId && aliasMap?.get(plain) === playerPovId) return true
  }
  return false
}

/** 热搜帖正文前是否已有所属话题 #标题# */
export function contentHasLeadingTopicHashtag(content: string, topicTitle?: string): boolean {
  const t = content.trim()
  if (!t.startsWith('#') && !t.startsWith('＃')) return false
  if (!topicTitle?.trim()) return /^[#＃]/.test(t)
  const title = topicTitle.trim()
  const bare = title.replace(/^[#＃]+|[#＃]+$/g, '')
  return t.startsWith(title) || (bare.length > 0 && (t.startsWith(`#${bare}#`) || t.startsWith(`＃${bare}＃`)))
}

/** 确保热搜帖以话题标签开头（已有则不重复） */
export function ensureTrendingTopicPrefix(content: string, topicTitle: string): string {
  const body = content.trim()
  const title = topicTitle.trim()
  if (!title) return body
  if (!body) return title
  if (contentHasLeadingTopicHashtag(body, title)) return body
  return `${title} ${body}`
}

function escapeRegExpLiteral(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * 把正文里散落的 #话题# 提到最前面（去重、保持首次出现顺序），正文主体紧随其后。
 */
export function movePulseTopicHashtagsToFront(content: string): string {
  const text = String(content ?? '').trim()
  if (!text) return text
  const re = /[#＃]([^#＃\n]{1,40}?)[#＃]/g
  const tags: string[] = []
  const seen = new Set<string>()
  let m: RegExpExecArray | null
  while ((m = re.exec(text)) !== null) {
    const bare = (m[1] ?? '').trim()
    if (!bare) continue
    const key = bare.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    tags.push(`#${bare}#`)
  }
  if (!tags.length) return text

  let rest = text
  for (const tag of tags) {
    const bare = tag.slice(1, -1)
    rest = rest.replace(new RegExp(`[#＃]${escapeRegExpLiteral(bare)}[#＃]`, 'g'), ' ')
  }
  rest = rest.replace(/[ \t]{2,}/g, ' ').replace(/\n{3,}/g, '\n\n').trim()
  if (!rest) return tags.join('')
  return `${tags.join('')} ${rest}`
}
