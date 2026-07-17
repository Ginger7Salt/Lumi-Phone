import type { PulsePovId } from './pulseTypes'
import { parsePulsePovId, toCharPovId, toPlayerPovId } from './pulseTypes'

/** 持久化艾特：`@{{char:角色id}}` / `@{{player:身份id}}`；展示时解析为当前昵称 */
export const PULSE_MENTION_EXPR_RE = /@\{\{?(char|player):([^}]+)\}\}?/g

export type PulseMentionExprRef = {
  kind: 'char' | 'player'
  rawId: string
  povId: PulsePovId
  /** 完整 token，含 @ */
  token: string
}

export type PulseMentionDirectoryEntry = {
  povId: PulsePovId
  /** 当前展示昵称（微博昵称优先） */
  nickname: string
  /** 用于把 AI/旧正文里的纯文本 @ 回收成表达式 */
  aliases: string[]
}

export function encodePulseMentionExpr(povId: PulsePovId): string | null {
  const parsed = parsePulsePovId(povId)
  if (!parsed) return null
  return `@{{${parsed.kind}:${parsed.rawId}}}`
}

export function parsePulseMentionExprToken(raw: string): PulseMentionExprRef | null {
  const t = String(raw ?? '').trim()
  const m = /^@\{\{?(char|player):([^}]+)\}\}?$/i.exec(t)
  if (!m) return null
  const kind = m[1]!.toLowerCase() === 'player' ? 'player' : 'char'
  const rawId = m[2]!.trim()
  if (!rawId) return null
  const povId = kind === 'player' ? toPlayerPovId(rawId) : toCharPovId(rawId)
  return { kind, rawId, povId, token: `@{{${kind}:${rawId}}}` }
}

export function pulseMentionExprInnerToPovId(kind: string, rawId: string): PulsePovId | null {
  const id = rawId.trim()
  if (!id) return null
  if (kind.toLowerCase() === 'player') return toPlayerPovId(id)
  if (kind.toLowerCase() === 'char') return toCharPovId(id)
  return null
}

export function buildPulseMentionAliasMap(
  entries: readonly PulseMentionDirectoryEntry[],
): Map<string, PulsePovId> {
  const map = new Map<string, PulsePovId>()
  for (const entry of entries) {
    const nick = entry.nickname.trim()
    if (nick) map.set(nick.toLowerCase(), entry.povId)
    for (const alias of entry.aliases) {
      const key = alias.trim().toLowerCase()
      if (!key) continue
      if (!map.has(key)) map.set(key, entry.povId)
    }
  }
  return map
}

export function buildPulseMentionNicknameByPov(
  entries: readonly PulseMentionDirectoryEntry[],
): Map<string, string> {
  const map = new Map<string, string>()
  for (const entry of entries) {
    const nick = entry.nickname.trim()
    if (nick) map.set(entry.povId, nick)
  }
  return map
}

/**
 * 把正文里的纯文本 `@昵称` 改成 `@{{char|player:id}}`；
 * 已是表达式的保持不动。
 */
export function rewritePlainMentionsToPulseExpr(
  text: string,
  entries: readonly PulseMentionDirectoryEntry[],
): string {
  const src = String(text ?? '')
  if (!src.includes('@')) return src
  const aliasMap = buildPulseMentionAliasMap(entries)

  return src.replace(
    /@\{\{(char|player):([^}]+)\}\}|@([^\s@【】\[\]\n#＃\{\}]{1,40})(?=\s|$)/g,
    (full, kind?: string, rawId?: string, plain?: string) => {
      if (kind && rawId) return full
      const name = (plain ?? '').trim()
      if (!name) return full
      const povId = aliasMap.get(name.toLowerCase())
      if (!povId) return full
      return encodePulseMentionExpr(povId) ?? full
    },
  )
}

/** 展示用：表达式 → 当前昵称；未知 player 表达式回退目录中的玩家昵称；纯文本保留 */
export function resolvePulseMentionDisplayName(
  mentionInner: string,
  nicknameByPov: ReadonlyMap<string, string>,
  aliasMap?: ReadonlyMap<string, PulsePovId>,
): string {
  const expr = parsePulseMentionExprToken(mentionInner.startsWith('@') ? mentionInner : `@${mentionInner}`)
  if (expr) {
    const hit = nicknameByPov.get(expr.povId)?.trim()
    if (hit) return hit
    if (expr.kind === 'player') {
      for (const [povId, nick] of nicknameByPov) {
        if (povId.startsWith('player:') && nick.trim()) return nick.trim()
      }
      return '用户'
    }
    return '角色'
  }
  const plain = mentionInner.replace(/^@/, '').trim()
  if (!plain) return '用户'
  if (aliasMap) {
    const povId = aliasMap.get(plain.toLowerCase())
    if (povId) {
      const nick = nicknameByPov.get(povId)?.trim()
      if (nick) return nick
    }
  }
  // AI 偶发写「@用户」当占位：映射到当前目录中的玩家微博昵称
  if (plain === '用户' || plain === '玩家' || plain === '你') {
    for (const [povId, nick] of nicknameByPov) {
      if (povId.startsWith('player:') && nick.trim()) return nick.trim()
    }
  }
  // 勿把未解析的表达式残片直接铺到预览上
  if (/^\{?\{?(char|player):/i.test(plain) || /^@\{\{?(char|player):/i.test(mentionInner)) {
    return /player:/i.test(plain + mentionInner) ? '用户' : '角色'
  }
  return plain
}

/**
 * 解析艾特对应的可打开主页 povId（仅 char: / player:）。
 * 网友纯文本 @ 若不在目录中则返回 null。
 */
export function resolvePulseMentionPovId(
  mentionInner: string,
  nicknameByPov: ReadonlyMap<string, string>,
  aliasMap?: ReadonlyMap<string, PulsePovId>,
): PulsePovId | null {
  const expr = parsePulseMentionExprToken(mentionInner.startsWith('@') ? mentionInner : `@${mentionInner}`)
  if (expr) {
    if (nicknameByPov.has(expr.povId)) return expr.povId
    if (expr.kind === 'player') {
      for (const povId of nicknameByPov.keys()) {
        if (povId.startsWith('player:')) return povId
      }
    }
    // 表达式已指明角色/用户 id，即便目录暂缺昵称也可进主页
    return expr.povId
  }
  const plain = mentionInner.replace(/^@/, '').trim()
  if (!plain) return null
  if (aliasMap) {
    const povId = aliasMap.get(plain.toLowerCase())
    if (povId) return povId
  }
  if (plain === '用户' || plain === '玩家' || plain === '你') {
    for (const povId of nicknameByPov.keys()) {
      if (povId.startsWith('player:')) return povId
    }
  }
  const needle = plain.toLowerCase()
  for (const [povId, nick] of nicknameByPov) {
    if (nick.trim().toLowerCase() === needle) return povId
  }
  return null
}

export function formatPulseMentionDisplay(displayName: string): string {
  const name = displayName.trim() || '用户'
  return `@${name}`
}

/** 角色对外微博昵称：优先微信/线上昵称，其次姓名 */
export function pulseCharacterWeiboNickname(ch: {
  wechatNickname?: string | null
  name?: string | null
}): string {
  return ch.wechatNickname?.trim() || ch.name?.trim() || '未命名'
}
