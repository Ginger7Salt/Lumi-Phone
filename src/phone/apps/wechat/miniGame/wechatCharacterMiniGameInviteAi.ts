import type { WeChatMiniGameInvitePayload } from '../newFriendsPersona/types'
import { GAME_CATALOG, getGameLabel } from './gameCatalog'
import {
  GOMOKU_DIFFICULTY_PERSONA_GUIDE,
  GOMOKU_PREGEN_REACTION_KEYS_DOC,
  GOMOKU_REACTION_SITUATION_RULES,
  parseGomokuSessionSetupFromModelJson,
  type GomokuSessionSetup,
} from './gomokuReactionBank'
import { buildCharacterMiniGameInvitePayload } from './miniGameInviteHelpers'
import type { MiniGameType } from './types'

function normalizeDirectiveLine(raw: string): string {
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

const AVAILABLE_GAME_TYPES = new Set(
  GAME_CATALOG.filter((g) => g.available !== false).map((g) => g.id),
)

function normalizeGameType(raw?: string): MiniGameType | null {
  const id = String(raw ?? '').trim() as MiniGameType
  if (AVAILABLE_GAME_TYPES.has(id)) return id
  return AVAILABLE_GAME_TYPES.has('gomoku') ? 'gomoku' : null
}

export type CharacterMiniGameInviteDirective = {
  gameType: MiniGameType
  replyText?: string
  gomokuSession?: GomokuSessionSetup
}

export type PendingCharacterMiniGameInvite = {
  insertAfterBubbleStep: number
  invite: WeChatMiniGameInvitePayload
  replyText?: string
}

export type CharacterMiniGameInviteLookupRow = {
  id: string
  from: 'self' | 'other'
  miniGameInvite?: { kind?: string; inviteId?: string; userResponded?: string; gameTitle?: string }
}

function parseInviteJson(j: Record<string, unknown>): CharacterMiniGameInviteDirective | null {
  const gameType = normalizeGameType(
    typeof j.gameType === 'string'
      ? j.gameType
      : typeof j.game === 'string'
        ? j.game
        : undefined,
  )
  if (!gameType) return null
  const replyText = typeof j.replyText === 'string' ? j.replyText.trim().slice(0, 500) : ''
  let gomokuSession: GomokuSessionSetup | undefined
  if (gameType === 'gomoku' && j.gomokuSession && typeof j.gomokuSession === 'object' && !Array.isArray(j.gomokuSession)) {
    gomokuSession = parseGomokuSessionSetupFromModelJson(j.gomokuSession as Record<string, unknown>)
  }
  return {
    gameType,
    replyText: replyText || undefined,
    gomokuSession,
  }
}

export function parseCharacterMiniGameInviteDirective(raw: string): CharacterMiniGameInviteDirective | null {
  const normalized = normalizeDirectiveLine(raw)
  const tagOnly = /^\[MINI_GAME_INVITE\]$/i.exec(normalized)
  if (tagOnly) return { gameType: 'gomoku' }

  const inline = /^\[MINI_GAME_INVITE\]\s*(\{[\s\S]*\})$/i.exec(normalized)
  if (!inline) return null
  try {
    const j = JSON.parse(inline[1]!) as Record<string, unknown>
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null
    return parseInviteJson(j)
  } catch {
    return { gameType: 'gomoku' }
  }
}

export function parseCharacterMiniGameInviteDirectiveFromArtifactLine(
  raw: string,
): CharacterMiniGameInviteDirective | null {
  const parsed = parseCharacterMiniGameInviteDirective(raw)
  if (parsed) return parsed
  const t = normalizeDirectiveLine(raw)
  if (!t.startsWith('{') || !t.endsWith('}')) return null
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    if (!j || typeof j !== 'object' || Array.isArray(j)) return null
    if (!('gameType' in j) && !('game' in j) && !('gomokuSession' in j)) return null
    return parseInviteJson(j)
  } catch {
    return null
  }
}

export function mergeCharacterMiniGameInviteDirectiveLines(currentLine: string, nextLine?: string): string {
  const current = normalizeDirectiveLine(currentLine)
  const next = normalizeDirectiveLine(nextLine ?? '')
  if (/^\[MINI_GAME_INVITE\]$/i.test(current) && next.startsWith('{') && next.endsWith('}')) {
    return `${current}${next}`
  }
  return current
}

export function mergeCharacterMiniGameInviteDirectiveBubbles(bubbles: string[]): string[] {
  const merged = [...bubbles]
  for (let i = 0; i < merged.length; i += 1) {
    const next = mergeCharacterMiniGameInviteDirectiveLines(
      merged[i]!,
      merged[i + 1] != null ? String(merged[i + 1] ?? '') : undefined,
    )
    if (next !== merged[i]) {
      merged[i] = next
      merged.splice(i + 1, 1)
    }
  }
  return merged
}

export function isCharacterMiniGameInviteDirectiveArtifactLine(line: string): boolean {
  const t = normalizeDirectiveLine(line)
  if (!t) return false
  if (parseCharacterMiniGameInviteDirective(t)) return true
  if (/^\[MINI_GAME_INVITE\]/i.test(t)) return true
  if (!t.startsWith('{') || !t.endsWith('}')) return false
  try {
    const j = JSON.parse(t) as Record<string, unknown>
    if (!j || typeof j !== 'object' || Array.isArray(j)) return false
    const keys = Object.keys(j)
    if (!keys.length) return false
    return keys.every((k) =>
      ['gameType', 'game', 'replyText', 'gomokuSession', 'messageId', 'inviteId'].includes(k),
    )
  } catch {
    return false
  }
}

function expandCharacterMiniGameInviteBubbleLines(raw: string): string[] {
  const normalized = String(raw ?? '')
    .trim()
    .replace(/\\n/g, '\n')
    .trim()
  if (!normalized) return []
  const parts = normalized
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  return parts.length > 1 ? parts : [normalized]
}

export function preprocessCharacterMiniGameInviteBubblesForChat(params: {
  bubbles: string[]
}): { bubbles: string[]; pendingInvites: PendingCharacterMiniGameInvite[] } {
  const merged = mergeCharacterMiniGameInviteDirectiveBubbles(params.bubbles)
  const next: string[] = []
  const pendingInvites: PendingCharacterMiniGameInvite[] = []
  let bubbleStep = 0

  for (const raw of merged) {
    for (const line of expandCharacterMiniGameInviteBubbleLines(raw)) {
      const act = parseCharacterMiniGameInviteDirectiveFromArtifactLine(line)
      if (act) {
        const invite = buildCharacterMiniGameInvitePayload({
          gameType: act.gameType,
          replyText: act.replyText,
          gomokuSession: act.gomokuSession,
        })
        pendingInvites.push({
          insertAfterBubbleStep: bubbleStep,
          invite,
          replyText: act.replyText,
        })
        continue
      }
      if (isCharacterMiniGameInviteDirectiveArtifactLine(line)) continue
      next.push(line)
      bubbleStep += 1
    }
  }

  return { bubbles: next, pendingInvites }
}

export function formatCharacterMiniGameInviteTranscriptLine(
  messageId: string,
  data: WeChatMiniGameInvitePayload,
): string {
  const mid = messageId.trim() || data.inviteId
  const reply = data.replyText?.trim()
  const head = reply
    ? `（你向用户发来游戏邀约：《${data.gameTitle}》；${reply}；messageId=${mid}；inviteId=${data.inviteId}）`
    : `（你向用户发来游戏邀约：《${data.gameTitle}》；messageId=${mid}；inviteId=${data.inviteId}）`
  if (data.userResponded === 'accepted') {
    return `${head}；用户已通过邀约卡接受，可开局`
  }
  if (data.userResponded === 'declined') {
    return `${head}；**用户已拒绝本次游戏邀约**（勿假装已开局；下次须重新发 MINI_GAME_INVITE）`
  }
  if (data.matchResult) {
    const result =
      data.matchResult === 'char_win'
        ? '本局你赢了'
        : data.matchResult === 'player_win'
          ? '本局用户赢了'
          : '本局和棋'
    return `${head}；${result}`
  }
  return `${head}；用户尚未回应邀约卡（等待接受/拒绝）`
}

export function findLatestCharacterMiniGameInvite(
  msgs: readonly CharacterMiniGameInviteLookupRow[],
): { messageId: string; invite: WeChatMiniGameInvitePayload } | null {
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const m = msgs[i]
    if (!m || m.from !== 'other') continue
    const mg = m.miniGameInvite
    if (mg?.kind === 'game_invite') {
      return { messageId: m.id, invite: mg as WeChatMiniGameInvitePayload }
    }
  }
  return null
}

export function buildCharacterMiniGameInviteStateBias(
  msgs: readonly CharacterMiniGameInviteLookupRow[],
): string {
  const latest = findLatestCharacterMiniGameInvite(msgs)
  if (!latest) return ''
  const title = latest.invite.gameTitle?.trim() || getGameLabel('gomoku')
  if (!latest.invite.userResponded) {
    return `[小游戏·状态] 你已向用户发出《${title}》邀约，用户尚未接受/拒绝。等待回应，勿重复刷屏发邀约。`
  }
  if (latest.invite.userResponded === 'accepted' && !latest.invite.matchResult) {
    return `[小游戏·状态] 用户已接受《${title}》邀约，可随时开局；口语可自然接话或调侃，勿再发 MINI_GAME_INVITE。`
  }
  if (latest.invite.userResponded === 'declined') {
    return `[小游戏·状态] 用户已拒绝《${title}》邀约。勿假装正在对局；想再约须新口语 + 新 MINI_GAME_INVITE。`
  }
  return ''
}

export const WECHAT_CHARACTER_MINI_GAME_INVITE_OUTPUT_BLOCK = `
---------------------
【小游戏：角色主动邀约（对用户不可见）】
---------------------
- 想约用户开局时，先有 1～3 句符合人设的口语，再**单独一行**输出：
  - \`[MINI_GAME_INVITE]{"gameType":"gomoku","replyText":"收束语","gomokuSession":{…}}\`
- 当前仅 **五子棋（gomoku）** 可玩；\`gameType\` 须为 \`gomoku\`。
- 五子棋邀约时 **gomokuSession 必填**，须与口语、指令**同一次回复一并输出**（各局面台词、开局对白、难度等）；**difficulty 仅写在 JSON 内，禁止在口语/replyText/台词里提及**。
  - difficulty: 整数 1～5
  - thinkDelayMinSec / thinkDelayMaxSec: 每步落子前思考秒数 1～10，min≤max
  - gameStartLines: 开局进入棋盘前的角色反应，5 句不同对白
  - reactions: 对象，键为 ${GOMOKU_PREGEN_REACTION_KEYS_DOC}，每个键对应 5 句口语对白
  ${GOMOKU_DIFFICULTY_PERSONA_GUIDE}
  ${GOMOKU_REACTION_SITUATION_RULES}
- 指令行会生成**游戏邀约卡**；用户点击接受/拒绝后状态写入聊天记录，你再据此接话。
- **禁止**只用口语说「来下棋」却不输出 \`[MINI_GAME_INVITE]\`；禁止在用户**未接受**时假装已对局。
- 用户主动发来的邀约仍用 \`[MINI_GAME_ACCEPT]\` / \`[MINI_GAME_DECLINE]\` 回应，与本节不同。
`.trim()
