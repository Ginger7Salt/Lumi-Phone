import type { PulseGeneratedSocialAccount } from './pulseTypes'
import { sanitizePulseProfileSignature } from './pulseWeiboFace'

function parseIntLoose(raw: string | undefined, fallback = 0): number {
  if (!raw) return fallback
  const cleaned = raw.replace(/[,，\s]/g, '')
  const m = cleaned.match(/([\d.]+)\s*(亿|万|w|k)?/i)
  if (!m) {
    const n = Number.parseInt(cleaned.replace(/\D/g, ''), 10)
    return Number.isFinite(n) ? Math.max(0, n) : fallback
  }
  const base = Number.parseFloat(m[1]!)
  if (!Number.isFinite(base)) return fallback
  const unit = (m[2] ?? '').toLowerCase()
  if (unit === '亿') return Math.round(base * 100_000_000)
  if (unit === '万' || unit === 'w') return Math.round(base * 10_000)
  if (unit === 'k') return Math.round(base * 1_000)
  return Math.round(base)
}

function normalizeFieldKeyLine(line: string): string {
  return line
    .replace(/^\s*[-*•]+\s*/, '')
    .replace(/\*\*/g, '')
    .replace(/`/g, '')
    .trim()
}

function fieldLine(block: string, keys: string[]): string {
  const lines = block.split(/\r?\n/)
  for (const key of keys) {
    const re = new RegExp(`^\\s*${key}\\s*[:：]\\s*(.*)$`, 'i')
    for (let i = 0; i < lines.length; i++) {
      const line = normalizeFieldKeyLine(lines[i]!)
      const m = re.exec(line)
      if (!m) continue
      const same = (m[1] ?? '').trim()
      if (same) return same
      // 「粉丝：」单独成行，数值在下一行
      for (let j = i + 1; j < lines.length && j <= i + 2; j++) {
        const next = normalizeFieldKeyLine(lines[j]!)
        if (!next) continue
        if (/^[\d.]+/.test(next.replace(/[,，\s]/g, ''))) return next
        break
      }
      return ''
    }
  }
  return ''
}

function multilineField(block: string, keys: string[]): string {
  const lines = block.split(/\r?\n/)
  const keyRe = new RegExp(`^\\s*(?:${keys.join('|')})\\s*[:：]\\s*(.*)$`, 'i')
  const otherFieldRe =
    /^\s*(?:key|账号|昵称|微博昵称|微信昵称|简介|认证|身份|粉丝|获赞|关注|圈外关注)\s*[:：]/i

  for (let i = 0; i < lines.length; i++) {
    const m = keyRe.exec(lines[i]!)
    if (!m) continue
    const parts: string[] = []
    const first = (m[1] ?? '').trim()
    if (first) parts.push(first)
    for (let j = i + 1; j < lines.length; j++) {
      const line = lines[j]!
      if (/^\s*\[ACCOUNT\]/i.test(line)) break
      if (otherFieldRe.test(line) && !keyRe.test(line)) break
      parts.push(line)
    }
    return parts.join('\n').trim()
  }
  return ''
}

function parseExtraFollowing(block: string): Array<{ name: string; bio?: string }> {
  const text = multilineField(block, ['圈外关注', '额外关注', '关注列表', 'extraFollowing'])
  if (!text) return []
  const out: Array<{ name: string; bio?: string }> = []
  for (const line of text.split(/\r?\n/)) {
    const t = line
      .replace(/^\s*(?:[-*•]|\d+[\.．、:：)]\s*)/, '')
      .trim()
    if (!t) continue
    // 昵称｜简介  或  昵称 / 简介
    const parts = t.split(/\s*[|｜/／]\s*/)
    const name = (parts[0] ?? '').trim().slice(0, 24)
    if (!name) continue
    const bio = (parts[1] ?? '').trim().slice(0, 60) || undefined
    out.push({
      name,
      bio: bio ? sanitizePulseProfileSignature(bio).slice(0, 60) || undefined : undefined,
    })
  }
  return out.slice(0, 8)
}

function parseAccountBlock(raw: string): PulseGeneratedSocialAccount | null {
  const keyRaw = fieldLine(raw, ['key', '账号', 'id']).slice(0, 80)
  const key = keyRaw.replace(/^char:/i, '').trim()
  if (!key) return null
  const weiboNickname =
    fieldLine(raw, ['微博昵称', '昵称', 'weiboNickname', 'screenName']) || undefined
  const bio =
    fieldLine(raw, ['简介', '签名', 'bio']) ||
    multilineField(raw, ['简介', '签名', 'bio']) ||
    undefined
  const verifyLabel =
    fieldLine(raw, ['认证', '身份', '认证身份', 'verifyLabel', 'badge']) || undefined
  const followers = Math.min(
    99_000_000,
    Math.max(0, parseIntLoose(fieldLine(raw, ['粉丝', '粉丝数', 'followers']), 0)),
  )
  const likesReceived = 0
  return {
    key,
    weiboNickname: weiboNickname?.replace(/\s+/g, ' ').trim().slice(0, 24) || undefined,
    bio: bio
      ? sanitizePulseProfileSignature(bio).replace(/\s+/g, ' ').trim().slice(0, 120) || undefined
      : undefined,
    verifyLabel: verifyLabel?.replace(/\s+/g, ' ').trim().slice(0, 48) || undefined,
    followers,
    likesReceived,
    extraFollowing: parseExtraFollowing(raw),
  }
}

/**
 * 解析社交账号 markup：
 *
 * [ACCOUNT]
 * key：player
 * 微博昵称：……
 * 认证：普通用户
 * 简介：……
 * 粉丝：123
 * 获赞：456
 * 圈外关注：
 * - 昵称｜简介
 */
export function parseSocialAccountsMarkup(raw: string): PulseGeneratedSocialAccount[] {
  const t = raw.trim()
  if (!t) return []
  const fence = /```(?:[\w-]*)?\s*([\s\S]*?)```/i.exec(t)
  const body = fence ? fence[1]!.trim() : t
  const parts = body.split(/\[ACCOUNT\]/i)
  const out: PulseGeneratedSocialAccount[] = []
  const seen = new Set<string>()
  for (let i = 1; i < parts.length; i++) {
    const row = parseAccountBlock(parts[i] ?? '')
    if (!row || seen.has(row.key)) continue
    seen.add(row.key)
    out.push(row)
  }
  return out
}
