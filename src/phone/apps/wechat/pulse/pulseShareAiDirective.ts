import { pickStablePulseNetizenAvatarPath } from '../../lumiPulse/pulseNetizenAvatar'
import { toCharPovId } from '../../lumiPulse/pulseTypes'
import type { PulseComment, PulsePovId } from '../../lumiPulse/pulseTypes'
import { usePulseStore } from '../../lumiPulse/usePulseStore'
import { loadAccountsBundle } from '../wechatAccountPersistence'
import type { WeChatPulseSharePayload } from '../newFriendsPersona/types'

export function pulseShareContentFallback(card: WeChatPulseSharePayload): string {
  return `[微博] ${card.authorName}`
}

export function parseWeChatPulseSharePayloadFromDb(raw: unknown): WeChatPulseSharePayload | undefined {
  if (!raw || typeof raw !== 'object') return undefined
  const r = raw as Record<string, unknown>
  const kind = typeof r.kind === 'string' ? r.kind.trim() : ''
  if (kind !== 'pulse_share') return undefined
  const shareId = typeof r.shareId === 'string' ? r.shareId.trim() : ''
  const postId = typeof r.postId === 'string' ? r.postId.trim() : ''
  const authorName = typeof r.authorName === 'string' ? r.authorName.trim().slice(0, 64) : ''
  const content = typeof r.content === 'string' ? r.content.trim().slice(0, 2000) : ''
  if (!shareId || !postId || !authorName || !content) return undefined
  const excerpt = typeof r.excerpt === 'string' ? r.excerpt.trim().slice(0, 280) : undefined
  const trendingTitle =
    typeof r.trendingTitle === 'string' ? r.trendingTitle.trim().slice(0, 120) : undefined
  return {
    kind: 'pulse_share',
    shareId,
    postId,
    authorName,
    content,
    ...(excerpt ? { excerpt } : {}),
    ...(trendingTitle ? { trendingTitle } : {}),
  }
}

export function formatPulseShareAiTranscriptLine(
  card: WeChatPulseSharePayload,
  from: 'self' | 'other',
): string {
  const who = from === 'self' ? '用户' : '你'
  const body = card.excerpt?.trim() || card.content.trim()
  const topic = card.trendingTitle?.trim()
  return [
    `【系统事件】${who}把一条**微博广场公开动态**转发到了微信。`,
    `博主「${card.authorName}」正文：【${body}】${topic ? `（关联话题：${topic}）` : ''}`,
    `id：${card.postId}（若你决定去评论，\`[微博评论]\` 块里的 id 行须原样复制）。`,
    `背景：这是网上公开可刷到的网友帖，你默认也会刷微博/热搜，能看见同类内容；不要纠结「我不认识这个网友」或质疑「内容从哪来的」。`,
    `例外：若帖子属于诽谤、造谣、抹黑你本人的不实负面绯闻，可以否认、生气、追究来源。`,
    `请结合人设真实回复用户；强烈建议同轮用自己微博账号下去评该帖（见输出协议中的 [微博评论] 块）。`,
  ].join('')
}

export type AiPulseCommentReply = {
  authorName: string
  content: string
  parentHint?: string
  likeCount?: number
}

export type AiPulseCommentDirective = {
  postId: string
  text: string
  replies: AiPulseCommentReply[]
}

const BLOCK_START_RE = /^\[(?:微博评论|PULSE_COMMENT)\]\s*$/i
const BLOCK_END_RE = /^\[\/(?:微博评论|PULSE_COMMENT)\]\s*$/i
const BLOCK_OPEN_PREFIX_RE = /^\[(?:微博评论|PULSE_COMMENT)\]/i
const LEGACY_JSON_LINE_RE = /^\[PULSE_COMMENT\]\s*(\{[\s\S]*\})$/i
const FIELD_LINE_RE =
  /^\s*(?:id|postId|帖id|帖子|评|评论|text|comment|内容|回|回复|reply)\s*[:：]/i

function readPulseCommentJson(raw: string): AiPulseCommentDirective | null {
  try {
    const j = JSON.parse(raw) as Record<string, unknown>
    const postId =
      (typeof j.postId === 'string' ? j.postId.trim() : '') ||
      (typeof j.id === 'string' ? j.id.trim() : '')
    const text =
      (typeof j.text === 'string' ? j.text.trim() : '') ||
      (typeof j.content === 'string' ? j.content.trim() : '') ||
      (typeof j.comment === 'string' ? j.comment.trim() : '')
    if (!postId || !text) return null

    const replies: AiPulseCommentReply[] = []
    const rawReplies = Array.isArray(j.replies) ? j.replies : []
    for (const row of rawReplies) {
      if (!row || typeof row !== 'object') continue
      const r = row as Record<string, unknown>
      const authorName =
        (typeof r.authorName === 'string' ? r.authorName.trim() : '') ||
        (typeof r.name === 'string' ? r.name.trim() : '')
      const content =
        (typeof r.content === 'string' ? r.content.trim() : '') ||
        (typeof r.text === 'string' ? r.text.trim() : '')
      if (!authorName || !content) continue
      const parentHint =
        typeof r.parentHint === 'string'
          ? r.parentHint.trim().slice(0, 24)
          : typeof r.replyTo === 'string'
            ? r.replyTo.trim().slice(0, 24)
            : undefined
      const likeRaw = r.likeCount
      const likeCount =
        typeof likeRaw === 'number' && Number.isFinite(likeRaw)
          ? Math.max(0, Math.min(9999, Math.round(likeRaw)))
          : undefined
      replies.push({
        authorName: authorName.slice(0, 24),
        content: content.slice(0, 280),
        ...(parentHint ? { parentHint } : {}),
        ...(likeCount != null ? { likeCount } : {}),
      })
    }

    return {
      postId: postId.slice(0, 120),
      text: text.slice(0, 280),
      replies: replies.slice(0, 8),
    }
  } catch {
    return null
  }
}

function parseReplyField(raw: string): AiPulseCommentReply | null {
  const parts = raw
    .split(/[｜|]/)
    .map((s) => s.trim())
    .filter(Boolean)
  if (parts.length < 2) return null
  const authorName = parts[0]!.slice(0, 24)
  const content = parts[1]!.slice(0, 280)
  if (!authorName || !content) return null
  const parentHint = parts[2]?.slice(0, 24)
  return {
    authorName,
    content,
    ...(parentHint ? { parentHint } : {}),
  }
}

function parsePulseCommentMarkup(block: string): AiPulseCommentDirective | null {
  const normalized = String(block ?? '').trim()
  if (!normalized) return null

  const legacy = LEGACY_JSON_LINE_RE.exec(normalized)
  if (legacy) return readPulseCommentJson(legacy[1]!)

  const inner = normalized
    .replace(/^\[(?:微博评论|PULSE_COMMENT)\]\s*/i, '')
    .replace(/\s*\[\/(?:微博评论|PULSE_COMMENT)\]\s*$/i, '')
    .trim()
  if (!inner) return null
  if (inner.startsWith('{') && inner.endsWith('}')) return readPulseCommentJson(inner)

  let postId = ''
  let text = ''
  const replies: AiPulseCommentReply[] = []

  for (const line of inner.split(/\r?\n/)) {
    const t = line.trim()
    if (!t) continue
    const idM = /^\s*(?:id|postId|帖id|帖子)\s*[:：]\s*(.+)$/i.exec(t)
    if (idM) {
      postId = idM[1]!.trim().slice(0, 120)
      continue
    }
    const textM = /^\s*(?:评|评论|text|comment|内容)\s*[:：]\s*(.*)$/i.exec(t)
    if (textM) {
      text = (textM[1] ?? '').trim().slice(0, 280)
      continue
    }
    const replyM = /^\s*(?:回|回复|reply)\s*[:：]\s*(.+)$/i.exec(t)
    if (replyM) {
      const row = parseReplyField(replyM[1]!)
      if (row) replies.push(row)
    }
  }

  if (!postId || !text) return null
  return { postId, text, replies: replies.slice(0, 8) }
}

export function parsePulseCommentDirective(raw: string): AiPulseCommentDirective | null {
  return parsePulseCommentMarkup(raw)
}

/** 指令行 / 整块 / 起缩略行：不得进聊天气泡 */
export function isPulseCommentDirectiveArtifactLine(line: string): boolean {
  const t = String(line ?? '').trim()
  if (!t) return false
  if (BLOCK_START_RE.test(t) || BLOCK_END_RE.test(t)) return true
  if (BLOCK_OPEN_PREFIX_RE.test(t)) return true
  if (parsePulseCommentMarkup(t)) return true
  return false
}

/**
 * 把拆散的 `[微博评论] … [/微博评论]` 行重新收成整块；
 * 兼容旧版单行 `[PULSE_COMMENT]{...}`。
 */
export function coalescePulseCommentBlocksInLines(lines: readonly string[]): string[] {
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
        // 块未闭合又窜出口语：先落块再吐口语
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
      if (/\[\/(?:微博评论|PULSE_COMMENT)\]\s*$/i.test(t) && t.includes('\n')) {
        flushBuf()
      }
      continue
    }

    out.push(t)
  }
  flushBuf()
  return out
}

/** 从气泡列表抽出微博评论指令并清洗对白 */
export function stripPulseCommentDirectivesFromBubbles(bubbles: readonly string[]): {
  bubbles: string[]
  directives: AiPulseCommentDirective[]
} {
  const coalesced = coalescePulseCommentBlocksInLines(
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
  const directives: AiPulseCommentDirective[] = []
  for (const line of coalesced) {
    const parsed = parsePulseCommentMarkup(line)
    if (parsed) {
      directives.push(parsed)
      continue
    }
    if (isPulseCommentDirectiveArtifactLine(line)) continue
    kept.push(line)
  }
  return { bubbles: kept, directives }
}

function findWorldPovForPost(
  accountId: string,
  postId: string,
  preferredPovId?: string,
): PulsePovId | null {
  const { root } = usePulseStore.getState()
  const acc = root.byAccount[accountId]
  if (!acc) return null
  const preferred = preferredPovId?.trim()
  if (preferred) {
    const world = acc.worldByPov[preferred]
    if (world?.posts.some((p) => p.id === postId)) return preferred
  }
  for (const [povId, world] of Object.entries(acc.worldByPov ?? {})) {
    if (world.posts.some((p) => p.id === postId)) return povId
  }
  return null
}

/** 把角色评论 + 同轮网友接话写入微博广场（无聊天气泡） */
export async function applyPulseCommentDirective(
  directive: AiPulseCommentDirective,
  ctx: {
    characterId: string
    characterName: string
    characterAvatarUrl?: string
    accountId?: string
  },
): Promise<boolean> {
  const characterId = ctx.characterId.trim()
  const characterName = ctx.characterName.trim() || 'TA'
  if (!characterId || !directive.postId || !directive.text.trim()) return false

  let accountId = ctx.accountId?.trim() || ''
  if (!accountId) {
    const bundle = await loadAccountsBundle()
    accountId = bundle?.currentAccountId?.trim() || ''
  }
  if (!accountId) return false

  await usePulseStore.getState().bindAccount(accountId)
  const preferred = toCharPovId(characterId)
  const worldPov = findWorldPovForPost(accountId, directive.postId, preferred)
  if (!worldPov) return false

  const charPov = toCharPovId(characterId)
  const now = Date.now()
  const charCommentId = `pc-char-${now}-${Math.random().toString(36).slice(2, 6)}`
  const comments: PulseComment[] = [
    {
      id: charCommentId,
      postId: directive.postId,
      authorPovId: charPov,
      authorName: characterName.slice(0, 64),
      authorAvatarUrl: ctx.characterAvatarUrl?.trim() || undefined,
      content: directive.text.trim().slice(0, 280),
      createdAt: now,
      isAiGenerated: true,
      likeCount: 3 + Math.floor(Math.random() * 40),
    },
  ]

  const nameToId = new Map<string, string>([[characterName, charCommentId]])
  for (const row of directive.replies) {
    if (row.authorName === characterName) continue
    const id = `pc-char-r-${now}-${Math.random().toString(36).slice(2, 6)}`
    const hint = row.parentHint?.trim() || characterName
    const hit =
      nameToId.get(hint) ??
      [...nameToId.entries()].find(([n]) => n.toLowerCase() === hint.toLowerCase())?.[1]
    const parentId = hit ?? charCommentId
    nameToId.set(row.authorName, id)
    comments.push({
      id,
      postId: directive.postId,
      authorPovId: `ai:${row.authorName}`,
      authorName: row.authorName,
      authorAvatarUrl: pickStablePulseNetizenAvatarPath(`ai:${row.authorName}`),
      content: row.content,
      createdAt: now + comments.length * 8_000,
      parentId,
      isAiGenerated: true,
      likeCount: row.likeCount ?? 2 + Math.floor(Math.random() * 40),
    })
  }

  return usePulseStore.getState().appendCommentsToWorld({
    accountId,
    worldPovId: worldPov,
    postId: directive.postId,
    comments,
  })
}

export function buildWeChatPulseShareOutputBlock(): string {
  return `
---------------------
【Lumi Pulse · 微博动态分享卡】
---------------------
- 若对话中出现「【系统事件】…转发到了微信」或**微博分享卡片**（LUMI PULSE | 微博动态分享），表示用户把一条**微博广场公开动态**转给你看。
- **默认语境（重要）**：这类帖是网上公开内容，你平时也会刷微博/热搜，**默认能看见、也能理解帖子语境**。禁止说「我不认识这个网友」「这是哪来的」「你哪找的陌生人」之类；不要对内容来源过度较真。
- **例外**：若帖子属于诽谤、造谣、抹黑你本人的**不实负面绯闻/污蔑**，可以否认、恼怒、澄清、追究谁在带节奏；普通吃瓜、夸夸、暧昧截图、路人安利等不要装傻装不认识。
- 微信里必须**认真回应内容与情绪**：可吐槽、嘴硬、傻乐、吃醋、假装淡定；禁止假装没收到卡片；禁止只回「收到了」而不谈内容。
- 用户可能用热搜、八卦、暧昧话题「钓鱼」——允许情绪失控、恼羞成怒，符合人设即可。

【同轮用自己微博账号评论该帖 · 推荐】
- 当用户刚转发微博、且你有情绪要宣泄/澄清/蹭热度时：**强烈建议**在同一次线上回复里，一边用微信气泡回话，一边去微博评那条帖。
- 须输出下面这种**多行字段块**（用户看不到；系统写入微博评论区）。不要用 JSON、不要写成一句话：
\`\`\`
[微博评论]
id：系统事件里的id原样复制
评：你用自己微博账号发的评论
回：网友昵称｜接你评论的话
回：另一个网友｜继续接话｜上一条网友昵称
[/微博评论]
\`\`\`
- \`id\` 必须与系统事件中的 id **完全一致**；\`评\` 为你本人口吻（可嘴硬、可宠粉、可否认绯闻），禁止客服腔。
- \`回\` 行：**写 2～6 条**。格式固定为 \`昵称｜内容\`，楼中楼再加 \`｜被回复昵称\`。第一条必须是接你（角色）的评论；分隔符用中文全角 \`｜\` 或英文 \`|\` 均可。禁止 Unicode emoji，可用 [doge][允悲]。
- 冷淡到不想下场时可以不写 \`[微博评论]\` 块，但微信正文仍要谈到帖子内容。
`.trim()
}
