import type {
  WeChatMiniGameAcceptPayload,
  WeChatMiniGameInvitePayload,
  WeChatMiniGameMatchResult,
  WeChatMiniGamePayload,
} from '../newFriendsPersona/types'
import {
  parseGomokuSessionSetupFromModelJson,
  GOMOKU_DIFFICULTY_PERSONA_GUIDE,
  type GomokuSessionSetup,
} from './gomokuReactionBank'
import { enrichMiniGamePayloadMatchResult, resolveMiniGameThreadLink } from './miniGameMatchHelpers'

function normalizeMiniGameDirectiveLine(raw: string): string {
  return String(raw ?? '')
    .trim()
    .replace(/^`+|`+$/g, '')
    .trim()
    .replace(/\r\n/g, '\n')
    .replace(/［/g, '[')
    .replace(/］/g, ']')
    .replace(/【/g, '[')
    .replace(/】/g, ']')
}

export type MiniGameInviteMsgLike = {
  id: string
  from: 'self' | 'other'
  miniGameInvite?: {
    kind: string
    inviteId: string
    gameTitle?: string
    gameType?: string
    reactionEnabled?: boolean
  }
}

export function formatMiniGameInviteTranscriptLine(
  messageId: string,
  data: WeChatMiniGameInvitePayload,
): string {
  const mid = messageId.trim() || data.inviteId
  return `（用户向你发来游戏邀约：《${data.gameTitle}》；messageId=${mid}；inviteId=${data.inviteId}）`
}

/** 角色视角：本局胜负（写入 AI 聊天记录，供后续口语引用） */
export function formatMiniGameMatchResultSuffixForCharacter(
  result: WeChatMiniGameMatchResult,
  gameTitle?: string,
): string {
  const game = gameTitle?.trim() || '小游戏'
  if (result === 'char_win') return `（本局《${game}》已结束：你赢了）`
  if (result === 'player_win') return `（本局《${game}》已结束：用户赢了）`
  return `（本局《${game}》已结束：和棋）`
}

export function formatMiniGameAcceptTranscriptLine(data: WeChatMiniGameAcceptPayload): string {
  const reply = data.replyText?.trim() || ''
  const base = reply ? `（已接受游戏邀请）${reply}` : '（已接受游戏邀请）'
  if (!data.matchResult) return base
  return `${base}${formatMiniGameMatchResultSuffixForCharacter(data.matchResult, data.gameTitle)}`
}

/** 无接受卡时（仅邀约卡带 matchResult）在邀约 transcript 上补胜负 */
export function formatMiniGameInviteTranscriptLineWithResult(
  messageId: string,
  data: WeChatMiniGameInvitePayload,
  opts?: { appendMatchResult?: boolean },
): string {
  const base = formatMiniGameInviteTranscriptLine(messageId, data)
  if (!opts?.appendMatchResult || !data.matchResult || data.charResponded !== 'accepted') return base
  return `${base}${formatMiniGameMatchResultSuffixForCharacter(data.matchResult, data.gameTitle)}`
}

type ChatRowForMiniGameEnrich = {
  kind: string
  id: string
  from: 'self' | 'other'
  miniGameInvite?: WeChatMiniGamePayload
}

/** 构建 AI transcript 前：补全 charResponded / matchResult（与聊天气泡 enrich 同源） */
export function enrichChatRowsMiniGameForAiTranscript<T extends ChatRowForMiniGameEnrich>(rows: readonly T[]): T[] {
  const msgs: MiniGameInviteMsgLike[] = rows
    .filter((it) => it.kind === 'msg' && it.miniGameInvite)
    .map((m) => ({ id: m.id, from: m.from, miniGameInvite: m.miniGameInvite }))
  return rows.map((it) => {
    if (it.kind !== 'msg' || !it.miniGameInvite) return it
    let mg = it.miniGameInvite
    mg = enrichMiniGamePayloadMatchResult(mg, msgs, it.id)
    if (mg.kind === 'game_invite') {
      mg = enrichMiniGameInviteCharResponded(mg, msgs, it.id)
    }
    return mg === it.miniGameInvite ? it : { ...it, miniGameInvite: mg }
  })
}

/** 接受卡是否应单独携带胜负后缀（避免与邀约卡重复） */
export function shouldAppendMiniGameMatchResultOnAccept(
  inviteId: string,
  msgs: readonly MiniGameInviteMsgLike[],
): boolean {
  const id = inviteId.trim()
  if (!id) return true
  return msgs.some((m) => m.from === 'other' && m.miniGameInvite?.kind === 'game_accept' && m.miniGameInvite.inviteId === id)
}

export function shouldAppendMiniGameMatchResultOnInvite(
  invite: WeChatMiniGameInvitePayload,
  msgs: readonly MiniGameInviteMsgLike[],
): boolean {
  if (!invite.matchResult || invite.charResponded !== 'accepted') return false
  return !shouldAppendMiniGameMatchResultOnAccept(invite.inviteId, msgs)
}

export function hasMiniGameResponseForInvite(msgs: readonly MiniGameInviteMsgLike[], inviteId: string): boolean {
  const id = inviteId.trim()
  if (!id) return false
  return msgs.some(
    (m) =>
      m.miniGameInvite?.inviteId === id &&
      (m.miniGameInvite.kind === 'game_accept' || m.miniGameInvite.kind === 'game_decline'),
  )
}

export function resolveMiniGameInviteCharResponded(
  inviteId: string,
  msgs: readonly MiniGameInviteMsgLike[],
): 'accepted' | 'declined' | undefined {
  const id = inviteId.trim()
  if (!id) return undefined
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const mg = msgs[i]?.miniGameInvite
    if (!mg || mg.inviteId !== id) continue
    if (mg.kind === 'game_accept') return 'accepted'
    if (mg.kind === 'game_decline') return 'declined'
  }
  return undefined
}

/** 按聊天顺序：本条邀约之后、下一条用户邀约之前，是否已有接受/拒绝卡 */
export function resolveMiniGameInviteCharRespondedByProximity(
  invite: WeChatMiniGameInvitePayload,
  msgs: readonly MiniGameInviteMsgLike[],
  inviteMessageId?: string,
): 'accepted' | 'declined' | undefined {
  const inviteMsgId = inviteMessageId?.trim()
  let startIdx = inviteMsgId ? msgs.findIndex((m) => m.id === inviteMsgId) : -1
  if (startIdx < 0) {
    startIdx = msgs.findIndex(
      (m) =>
        m.from === 'self' &&
        m.miniGameInvite?.kind === 'game_invite' &&
        m.miniGameInvite.inviteId === invite.inviteId,
    )
  }
  if (startIdx < 0) return undefined

  for (let i = startIdx + 1; i < msgs.length; i += 1) {
    const row = msgs[i]
    if (!row) continue
    const mg = row.miniGameInvite
    if (row.from === 'self' && mg?.kind === 'game_invite') break
    if (row.from !== 'other' || !mg) continue
    if (mg.kind === 'game_accept') return 'accepted'
    if (mg.kind === 'game_decline') {
      if (!mg.inviteId || mg.inviteId === invite.inviteId) return 'declined'
    }
  }
  return undefined
}

/** 渲染用户邀约卡时：若持久化未写入 charResponded，从同 inviteId 的接受/拒绝卡推导 */
export function enrichMiniGameInviteCharResponded(
  invite: WeChatMiniGameInvitePayload,
  msgs: readonly MiniGameInviteMsgLike[],
  inviteMessageId?: string,
): WeChatMiniGameInvitePayload {
  if (invite.charResponded === 'accepted' || invite.charResponded === 'declined') return invite
  const derived =
    resolveMiniGameInviteCharResponded(invite.inviteId, msgs) ??
    resolveMiniGameInviteCharRespondedByProximity(invite, msgs, inviteMessageId)
  if (derived) return { ...invite, charResponded: derived }
  const link = resolveMiniGameThreadLink(invite.inviteId, msgs)
  if (link.acceptMessageId) return { ...invite, charResponded: 'accepted' }
  return invite
}

export function resolvePendingMiniGameInviteMessageId(params: {
  messageIdHint?: string
  msgs: readonly MiniGameInviteMsgLike[]
}): string | null {
  const hint = params.messageIdHint?.trim()
  const msgs = params.msgs
  const isPendingInvite = (m: MiniGameInviteMsgLike): boolean =>
    m.from === 'self' && m.miniGameInvite?.kind === 'game_invite' && !!m.miniGameInvite.inviteId.trim()

  const hintMatches = (m: MiniGameInviteMsgLike): boolean => {
    if (!hint) return false
    return m.id === hint || m.miniGameInvite?.inviteId === hint
  }

  if (hint) {
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]!
      if (!hintMatches(m)) continue
      if (!isPendingInvite(m)) return null
      if (hasMiniGameResponseForInvite(msgs, m.miniGameInvite!.inviteId)) return null
      return m.id
    }
    // 模型可能写错 messageId，回退到最近一条待回应邀约
    for (let i = msgs.length - 1; i >= 0; i--) {
      const m = msgs[i]!
      if (!isPendingInvite(m)) continue
      const inviteId = m.miniGameInvite!.inviteId
      if (!hasMiniGameResponseForInvite(msgs, inviteId)) return m.id
      return null
    }
    return null
  }

  for (let i = msgs.length - 1; i >= 0; i--) {
    const m = msgs[i]!
    if (!isPendingInvite(m)) continue
    const inviteId = m.miniGameInvite!.inviteId
    if (!hasMiniGameResponseForInvite(msgs, inviteId)) return m.id
    return null
  }
  return null
}

export function findLatestPendingMiniGameInvite(
  msgs: readonly MiniGameInviteMsgLike[],
): { messageId: string; invite: WeChatMiniGameInvitePayload } | null {
  const messageId = resolvePendingMiniGameInviteMessageId({ msgs })
  if (!messageId) return null
  const row = msgs.find((m) => m.id === messageId)
  if (!row?.miniGameInvite || row.miniGameInvite.kind !== 'game_invite') return null
  const invite = row.miniGameInvite as WeChatMiniGameInvitePayload
  return { messageId, invite }
}

/** 会话里仍有未回应的游戏邀约时，应注入裁决 bias / 解析指令 / 口语兜底 */
export function shouldEngageMiniGameInviteFlow(msgs: readonly MiniGameInviteMsgLike[]): boolean {
  return findLatestPendingMiniGameInvite(msgs) !== null
}

export function parseMiniGameInviteActionDirective(
  raw: string,
): {
  kind: 'accept' | 'decline'
  messageId?: string
  replyText?: string
  gomokuSession?: GomokuSessionSetup
} | null {
  const normalized = normalizeMiniGameDirectiveLine(raw)
  const tryOne = (tag: string, kind: 'accept' | 'decline') => {
    const tagOnly = new RegExp(`^\\[${tag}\\]$`, 'i').exec(normalized)
    if (tagOnly) return { kind }

    const inline = new RegExp(`^\\[${tag}\\]\\s*(\\{[\\s\\S]*\\})$`, 'i').exec(normalized)
    if (!inline) return null
    try {
      const j = JSON.parse(inline[1]!) as Record<string, unknown>
      const messageId =
        (typeof j.messageId === 'string' ? j.messageId.trim() : '') ||
        (typeof j.inviteId === 'string' ? j.inviteId.trim() : '')
      const replyText = typeof j.replyText === 'string' ? j.replyText.trim().slice(0, 500) : ''
      let gomokuSession: GomokuSessionSetup | undefined
      if (kind === 'accept' && j.gomokuSession && typeof j.gomokuSession === 'object' && !Array.isArray(j.gomokuSession)) {
        gomokuSession = parseGomokuSessionSetupFromModelJson(j.gomokuSession as Record<string, unknown>)
      }
      return { kind, messageId: messageId || undefined, replyText: replyText || undefined, gomokuSession }
    } catch {
      return { kind }
    }
  }
  return tryOne('MINI_GAME_ACCEPT', 'accept') ?? tryOne('MINI_GAME_DECLINE', 'decline')
}

export function mergeMiniGameDirectiveBubbleLines(currentLine: string, nextLine?: string): string {
  const current = normalizeMiniGameDirectiveLine(currentLine)
  const next = normalizeMiniGameDirectiveLine(nextLine ?? '')
  if (/^\[MINI_GAME_(ACCEPT|DECLINE)\]$/i.test(current) && next.startsWith('{') && next.endsWith('}')) {
    return `${current}${next}`
  }
  return current
}

export function isMiniGameDirectiveArtifactLine(line: string): boolean {
  const t = normalizeMiniGameDirectiveLine(line)
  if (!t) return false
  if (parseMiniGameInviteActionDirective(t)) return true
  if (/^\[MINI_GAME_(ACCEPT|DECLINE)\]/i.test(t)) return true
  if (/^\[MINI_GAME_INVITE\]/i.test(t)) return true
  if (!t.startsWith('{') || !t.endsWith('}')) return false
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    if (!j || typeof j !== 'object' || Array.isArray(j)) return false
    const keys = Object.keys(j)
    if (keys.length === 0) return false
    return keys.every(
      (k) =>
        k === 'messageId' ||
        k === 'inviteId' ||
        k === 'replyText' ||
        k === 'gomokuSession',
    )
  } catch {
    return false
  }
}

const GOMOKU_REACTION_KEYS_DOC = [
  'blockFour',
  'blockWin',
  'playerBlockFour',
  'playerBlockWin',
  'aiOpenFour',
  'aiOpenThree',
  'playerOpenFour',
  'playerMove',
  'brilliant',
  'routine',
  'thinking',
  'firstMove',
  'win',
  'lose',
  'draw',
].join(', ')

export function buildMiniGameInviteReplyBias(params: {
  messageId: string
  invite: WeChatMiniGameInvitePayload
}): string {
  const gomokuBlock =
    params.invite.gameType === 'gomoku'
      ? `
3) 若接受且为五子棋，须在 [MINI_GAME_ACCEPT] 的 JSON 内**同一次回复一并**包含 gomokuSession 对象（与口语、指令同轮输出，勿另起请求）：
   - difficulty: 整数 1～5（**仅 JSON 内字段，禁止出现在任何可见对白**）
   - thinkDelayMinSec / thinkDelayMaxSec: 每步落子前思考秒数 1～10，min≤max
   - gameStartLines: 开局进入棋盘前的角色反应，5 句不同对白
   - reactions: 对象，键为 ${GOMOKU_REACTION_KEYS_DOC}，每个键对应 5 句口语对白
   ${GOMOKU_DIFFICULTY_PERSONA_GUIDE}
   **禁止**在口语对白、replyText、各局面台词中提及难度数字或放水/全力/商务局等；difficulty 仅写在 gomokuSession JSON 内，用户不可见。`
      : ''

  return `[系统裁决·小游戏邀约] 用户刚向你发来《${params.invite.gameTitle}》游戏邀请（messageId=${params.messageId}）。
你必须在本轮回复中：
1) 输出 1～4 行符合人设的口语对白（是否愿意玩、对游戏的看法等）；
2) 在口语对白之间的任意位置单独占一行输出以下指令之一（缺一不可）：
   - 愿意玩：\`[MINI_GAME_ACCEPT]{"messageId":"${params.messageId}","replyText":"收束语"}\`
   - 拒绝玩：\`[MINI_GAME_DECLINE]{"messageId":"${params.messageId}","replyText":"收束语"}\`
${gomokuBlock}
禁止只回复口语而不输出指令行；禁止在未输出 [MINI_GAME_ACCEPT] 时假装已接受开局。`
}

export function adjudicateMiniGameFromCharacterText(combinedText: string): 'accept' | 'decline' | null {
  const t = combinedText.trim()
  if (!t) return null

  const decline =
    /(?:没空|不想玩|不玩|拒绝|算了吧|下次吧|先不了|不要了|懒得|没兴趣|忙着呢|在忙|没心情|不太想|算了|免了|别了吧|不想下)/u.test(
      t,
    )
  const acceptExplicit =
    /(?:好啊|好呀|行啊|可以啊|没问题|来吧|陪你玩|下一盘|五子棋|放马过来|开局|开一局|走起|当然要|陪你下|来一局)/u.test(
      t,
    )
  const acceptPlayful =
    /(?:不手滑|手滑了|不掉链|认真|盯着|这局|那局|再下|下棋|对弈|就来)/u.test(t) ||
    /(?:绝对|这次).*(?:盯|认真|不手滑)/u.test(t)

  if (decline && !acceptExplicit && !acceptPlayful) return 'decline'
  if (acceptExplicit || acceptPlayful) return 'accept'
  if (/(?:棋|盘|下子|先手|后手)/u.test(t) && !decline) return 'accept'
  return null
}

export const WECHAT_MINI_GAME_INVITE_OUTPUT_BLOCK = `
---------------------
【用户发来的小游戏邀约】
---------------------
- 会话里若出现「（用户向你发来游戏邀约：《游戏名》…）」或用户刚发来**游戏邀请卡**，表示对方想与你开局小游戏。
- 你必须结合人设、好感、当下是否方便，**自主决定接受或拒绝**；不要无脑答应，也不要无视邀约。
- **接受**时：先有自然口语（可多条），在口语之间的任意位置单独一行输出：
  - \`[MINI_GAME_ACCEPT]{}\` 或 \`[MINI_GAME_ACCEPT]{"messageId":"邀约消息id","replyText":"…","gomokuSession":{…}}\`
  - 五子棋接受时 **gomokuSession 必填**，须与口语、指令**同一次回复一并输出**（各局面台词、开局对白、难度等）；**difficulty 仅写在 JSON 内，禁止在口语/replyText/台词里提及**。
  - difficulty 须结合人设与近期聊天：默认正常（3）；棋类高手/脑子灵光/有此爱好且无放水意图时可 4～5；提供情绪价值或让用户赢时可 1～2，但 win/lose 等台词**不要戳破放水**，优先夸用户。
- **拒绝**时：先有符合人设的口语，再单独一行：
  - \`[MINI_GAME_DECLINE]{}\` 或 \`[MINI_GAME_DECLINE]{"messageId":"…","replyText":"…"}\`
- **禁止**用普通文字假装已接受却不输出对应指令行；不写指令则界面不会生成接受/拒绝卡片。
- 若你的接受卡或用户邀约卡 transcript 末尾出现「本局《游戏名》已结束：你赢了 / 用户赢了 / 和棋」，表示**小游戏已对局结束**；后续口语须与此结果一致，可自然吐槽、夸奖、撒娇或约再战，**禁止**假装没下过或否认该胜负。
`.trim()
