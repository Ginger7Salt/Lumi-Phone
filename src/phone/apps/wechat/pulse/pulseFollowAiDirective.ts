import { toCharPovId, toPlayerPovId } from '../../lumiPulse/pulseTypes'
import { usePulseStore } from '../../lumiPulse/usePulseStore'
import { loadAccountsBundle } from '../wechatAccountPersistence'

/**
 * 私聊：角色同意关注用户微博时输出的机器指令。
 * 支持单行 JSON、以及多行字段块。
 */
export type AiPulseFollowDirective = {
  /** 固定：角色关注当前会话玩家微博 */
  followUser: true
}

const BLOCK_START_RE = /^\[(?:微博关注|PULSE_FOLLOW)\]\s*$/i
const BLOCK_END_RE = /^\[\/(?:微博关注|PULSE_FOLLOW)\]\s*$/i
const BLOCK_OPEN_PREFIX_RE = /^\[(?:微博关注|PULSE_FOLLOW)\]/i
const LEGACY_JSON_LINE_RE = /^\[(?:微博关注|PULSE_FOLLOW)\]\s*(\{[\s\S]*\})$/i
const FIELD_LINE_RE = /^\s*(?:目标|target|对象|关注)\s*[:：]/i

function readPulseFollowJson(raw: string): AiPulseFollowDirective | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    // 空对象 / followUser=true / target=用户 均视为「关注当前用户」
    const target =
      (typeof j.target === 'string' ? j.target.trim() : '') ||
      (typeof j.to === 'string' ? j.to.trim() : '') ||
      (typeof j.who === 'string' ? j.who.trim() : '')
    if (target) {
      const t = target.toLowerCase()
      const ok =
        t === 'user' ||
        t === 'player' ||
        t === 'me' ||
        t.includes('用户') ||
        t.includes('玩家') ||
        t.includes('你') ||
        t.includes('我')
      if (!ok) return null
    }
    if (j.followUser === false) return null
    return { followUser: true }
  } catch {
    return null
  }
}

function parsePulseFollowMarkup(block: string): AiPulseFollowDirective | null {
  const normalized = String(block ?? '').trim()
  if (!normalized) return null

  const legacy = LEGACY_JSON_LINE_RE.exec(normalized)
  if (legacy) return readPulseFollowJson(legacy[1]!)

  // 必须带微博关注标签，禁止把普通聊天气泡误判成指令
  if (!BLOCK_OPEN_PREFIX_RE.test(normalized) && !BLOCK_START_RE.test(normalized)) {
    return null
  }

  // 裸标签：`[微博关注]` / `[PULSE_FOLLOW]`
  if (/^\[(?:微博关注|PULSE_FOLLOW)\]\s*$/i.test(normalized)) {
    return { followUser: true }
  }

  const inner = normalized
    .replace(/^\[(?:微博关注|PULSE_FOLLOW)\]\s*/i, '')
    .replace(/\s*\[\/(?:微博关注|PULSE_FOLLOW)\]\s*$/i, '')
    .trim()
  if (!inner) return { followUser: true }
  if (inner.startsWith('{') && inner.endsWith('}')) return readPulseFollowJson(inner)

  for (const line of inner.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    const m = /^\s*(?:目标|target|对象|关注)\s*[:：]\s*(.+)$/i.exec(t)
    if (m) {
      const v = m[1]!.trim().toLowerCase()
      const ok =
        !v ||
        v === 'user' ||
        v === 'player' ||
        v.includes('用户') ||
        v.includes('玩家') ||
        v.includes('你') ||
        v.includes('我')
      return ok ? { followUser: true } : null
    }
  }
  // 已有开闭标签、块内无字段：默认关注用户
  return { followUser: true }
}

export function parsePulseFollowDirective(raw: string): AiPulseFollowDirective | null {
  return parsePulseFollowMarkup(raw)
}

/** 指令行 / 整块：不得进聊天气泡（仅匹配明确的微博关注标签） */
export function isPulseFollowDirectiveArtifactLine(line: string): boolean {
  const t = String(line ?? '').trim()
  if (!t) return false
  if (BLOCK_START_RE.test(t) || BLOCK_END_RE.test(t)) return true
  if (!BLOCK_OPEN_PREFIX_RE.test(t) && !LEGACY_JSON_LINE_RE.test(t)) return false
  if (BLOCK_OPEN_PREFIX_RE.test(t)) return true
  return Boolean(parsePulseFollowMarkup(t))
}

/**
 * 把拆散的 `[微博关注] … [/微博关注]` 行重新收成整块；
 * 兼容单行 `[微博关注]{}` / `[PULSE_FOLLOW]{}`。
 */
export function coalescePulseFollowBlocksInLines(lines: readonly string[]): string[] {
  const out: string[] = []
  let buf: string[] | null = null

  const flushBuf = () => {
    if (!buf?.length) {
      buf = null
      return
    }
    out.push(buf.join('\n'))
    buf = null
  }

  for (const raw of lines) {
    const line = String(raw ?? '')
    const t = line.trim()
    if (!t) continue

    if (buf) {
      buf.push(t)
      if (BLOCK_END_RE.test(t)) flushBuf()
      else if (!FIELD_LINE_RE.test(t) && !BLOCK_START_RE.test(t) && !BLOCK_END_RE.test(t)) {
        flushBuf()
        out.push(t)
      }
      continue
    }

    if (LEGACY_JSON_LINE_RE.test(t)) {
      out.push(t)
      continue
    }

    if (BLOCK_START_RE.test(t) || (BLOCK_OPEN_PREFIX_RE.test(t) && !LEGACY_JSON_LINE_RE.test(t))) {
      buf = [t]
      if (/\[\/(?:微博关注|PULSE_FOLLOW)\]\s*$/i.test(t) && t.includes('\n')) {
        flushBuf()
      }
      continue
    }

    out.push(t)
  }
  flushBuf()
  return out
}

/** 从气泡列表抽出微博关注指令并清洗对白 */
export function stripPulseFollowDirectivesFromBubbles(bubbles: readonly string[]): {
  bubbles: string[]
  directives: AiPulseFollowDirective[]
} {
  const coalesced = coalescePulseFollowBlocksInLines(
    bubbles.flatMap((raw) => {
      const text = String(raw ?? '')
      if (!text.includes('\n')) {
        const t = text.trim()
        return t ? [t] : []
      }
      return text
        .split(/\n/)
        .map((l) => l.trim())
        .filter(Boolean)
    }),
  )

  const kept: string[] = []
  const directives: AiPulseFollowDirective[] = []
  for (const line of coalesced) {
    const parsed = parsePulseFollowMarkup(line)
    if (parsed) {
      directives.push(parsed)
      continue
    }
    if (isPulseFollowDirectiveArtifactLine(line)) continue
    kept.push(line)
  }
  return { bubbles: kept, directives }
}

/** 把角色→用户的微博关注边写入本地（幂等） */
export async function applyPulseFollowDirective(
  _directive: AiPulseFollowDirective,
  ctx: {
    characterId: string
    characterName: string
    characterAvatarUrl?: string
    /** 当前会话玩家身份 id */
    playerIdentityId: string
    playerDisplayName?: string
    playerAvatarUrl?: string
    accountId?: string
  },
): Promise<boolean> {
  const characterId = ctx.characterId.trim()
  const playerIdentityId = ctx.playerIdentityId.trim()
  if (!characterId || !playerIdentityId || playerIdentityId === '__none__') return false

  let accountId = ctx.accountId?.trim() || ''
  if (!accountId) {
    const bundle = await loadAccountsBundle()
    accountId = bundle?.currentAccountId?.trim() || ''
  }
  if (!accountId) return false

  await usePulseStore.getState().bindAccount(accountId)
  const fromPovId = toCharPovId(characterId)
  const toPovId = toPlayerPovId(playerIdentityId)
  const playerName = ctx.playerDisplayName?.trim().slice(0, 64) || '用户'

  return usePulseStore.getState().ensureFollowEdge({
    fromPovId,
    target: {
      povId: toPovId,
      name: playerName,
      avatarUrl: ctx.playerAvatarUrl?.trim() || undefined,
      verified: false,
    },
  })
}

export function buildWeChatPulseFollowOutputBlock(): string {
  return `
---------------------
【Lumi Pulse · 微博关注用户】
---------------------
- 当 {{user}} 在私聊里要求你：**关注 TA 的微博**、**回关**、**互关**、**互相关注**、把微博关注一下等，且你**愿意照做**时：
  1) 用正常微信气泡口语答应/回应（可嘴硬、别扭、干脆，符合人设）；
  2) **同轮必须**再输出机器指令，系统才会真的把「你的微博关注 {{user}}」写进微博广场。
- 不愿关注时：只口头拒绝或扯开，**不要**写指令。
- 已经在关注、或口头说「早就关了」且无需再操作时：可不写指令。
- **唯一**发出指令（用户看不到；勿与口语混在同一行），任选一种写法：

单行：
\`[微博关注]{}\`
或 \`[PULSE_FOLLOW]{}\`

多行字段块：
\`\`\`
[微博关注]
目标：用户
[/微博关注]
\`\`\`

- 指令含义固定为：**当前角色微博账号关注当前会话玩家微博**；不要填别人的昵称当目标。
- 「互关」场景：你只能完成「你关注对方」这一侧；对方是否关注你由对方操作，勿假装已替对方点关注。
- 禁止自创 \`[关注]\` \`[FOLLOW]\` 等标签；须用上方标签之一。
`.trim()
}
