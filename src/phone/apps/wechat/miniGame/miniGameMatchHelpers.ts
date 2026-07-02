import type {
  WeChatMiniGameInvitePayload,
  WeChatMiniGameMatchResult,
  WeChatMiniGamePayload,
} from '../newFriendsPersona/types'
import type { MiniGameInviteMsgLike } from './wechatMiniGameInviteAi'

export type MiniGameSideOutcome = 'win' | 'lose' | 'draw'

export type MiniGameThreadLink = {
  inviteId: string
  userInviteMessageId?: string
  acceptMessageId?: string
}

type MiniGameMsgLike = MiniGameInviteMsgLike & {
  miniGameInvite?: {
    kind: string
    inviteId: string
    matchResult?: WeChatMiniGameMatchResult
    charResponded?: string
  }
}

/** 解析与 inviteId 关联的发起卡 / 接受卡消息 id（兼容 inviteId 不一致） */
export function resolveMiniGameThreadLink(
  inviteId: string,
  msgs: readonly MiniGameInviteMsgLike[],
): MiniGameThreadLink {
  const id = inviteId.trim()
  const link: MiniGameThreadLink = { inviteId: id }

  for (const msg of msgs) {
    const mg = msg.miniGameInvite
    if (!mg) continue
    if (mg.kind === 'game_invite' && mg.inviteId === id) link.userInviteMessageId = msg.id
    if (mg.kind === 'game_accept' && mg.inviteId === id) link.acceptMessageId = msg.id
  }

  if (link.acceptMessageId && !link.userInviteMessageId) {
    const acceptIdx = msgs.findIndex((m) => m.id === link.acceptMessageId)
    if (acceptIdx >= 0) {
      for (let i = acceptIdx - 1; i >= 0; i -= 1) {
        const row = msgs[i]
        if (!row) continue
        const mg = row.miniGameInvite
        if (row.from === 'self' && mg?.kind === 'game_invite') {
          link.userInviteMessageId = row.id
          break
        }
      }
    }
  }

  if (link.userInviteMessageId && !link.acceptMessageId) {
    const inviteIdx = msgs.findIndex((m) => m.id === link.userInviteMessageId)
    if (inviteIdx >= 0) {
      for (let i = inviteIdx + 1; i < msgs.length; i += 1) {
        const row = msgs[i]
        if (!row) continue
        const mg = row.miniGameInvite
        if (row.from === 'self' && mg?.kind === 'game_invite') break
        if (row.from === 'other' && mg?.kind === 'game_accept') {
          link.acceptMessageId = row.id
          break
        }
      }
    }
  }

  if (!link.acceptMessageId) {
    for (let i = msgs.length - 1; i >= 0; i -= 1) {
      const row = msgs[i]
      const mg = row?.miniGameInvite
      if (!row || row.from !== 'other' || mg?.kind !== 'game_accept') continue
      if (id && mg.inviteId !== id) continue
      link.acceptMessageId = row.id
      if (!link.userInviteMessageId) {
        for (let j = i - 1; j >= 0; j -= 1) {
          const prev = msgs[j]
          if (!prev) continue
          const prevMg = prev.miniGameInvite
          if (prev.from === 'self' && prevMg?.kind === 'game_invite') {
            link.userInviteMessageId = prev.id
            break
          }
        }
      }
      break
    }
  }

  return link
}

export function collectMiniGameThreadMessageIds(
  link: MiniGameThreadLink,
  msgs: readonly MiniGameInviteMsgLike[],
): Set<string> {
  const ids = new Set<string>()
  const inviteId = link.inviteId.trim()

  if (link.userInviteMessageId?.trim()) ids.add(link.userInviteMessageId.trim())
  if (link.acceptMessageId?.trim()) ids.add(link.acceptMessageId.trim())

  for (const msg of msgs) {
    const mg = msg.miniGameInvite
    if (!mg || (mg.kind !== 'game_invite' && mg.kind !== 'game_accept')) continue
    if (inviteId && mg.inviteId === inviteId) ids.add(msg.id)
  }

  const resolved = resolveMiniGameThreadLink(inviteId, msgs)
  if (resolved.userInviteMessageId) ids.add(resolved.userInviteMessageId)
  if (resolved.acceptMessageId) ids.add(resolved.acceptMessageId)

  return ids
}

export function resolveMiniGameMatchResult(
  inviteId: string,
  msgs: readonly MiniGameInviteMsgLike[],
): WeChatMiniGameMatchResult | undefined {
  const id = inviteId.trim()
  if (!id) return undefined
  for (let i = msgs.length - 1; i >= 0; i -= 1) {
    const mg = msgs[i]?.miniGameInvite as { inviteId?: string; matchResult?: WeChatMiniGameMatchResult } | undefined
    if (!mg || mg.inviteId !== id || !mg.matchResult) continue
    return mg.matchResult
  }
  return undefined
}

function resolveMiniGameMatchResultByProximity(
  data: WeChatMiniGamePayload,
  msgs: readonly MiniGameInviteMsgLike[],
  messageId?: string,
): WeChatMiniGameMatchResult | undefined {
  const inviteId = data.inviteId.trim()
  if (!inviteId) return undefined

  const msgId = messageId?.trim()
  let startIdx = msgId ? msgs.findIndex((m) => m.id === msgId) : -1
  if (startIdx < 0) {
    startIdx = msgs.findIndex(
      (m) =>
        m.miniGameInvite?.inviteId === inviteId &&
        (m.miniGameInvite.kind === 'game_invite' || m.miniGameInvite.kind === 'game_accept'),
    )
  }
  if (startIdx < 0) return undefined

  const scan = (from: number, to: number, step: number): WeChatMiniGameMatchResult | undefined => {
    for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
      const row = msgs[i] as MiniGameMsgLike | undefined
      const mg = row?.miniGameInvite
      if (!mg) continue
      if (mg.kind === 'game_invite' && mg.inviteId !== inviteId) break
      if (mg.kind === 'game_accept' && mg.inviteId !== inviteId) continue
      if (mg.kind !== 'game_invite' && mg.kind !== 'game_accept') continue
      if (mg.inviteId !== inviteId || !mg.matchResult) continue
      return mg.matchResult
    }
    return undefined
  }

  return scan(startIdx + 1, msgs.length - 1, 1) ?? scan(startIdx - 1, 0, -1)
}

export function canMiniGameInviteHaveMatchResult(
  invite: WeChatMiniGameInvitePayload,
): boolean {
  return invite.charResponded === 'accepted' || invite.userResponded === 'accepted'
}

export function enrichMiniGamePayloadMatchResult<T extends WeChatMiniGamePayload>(
  data: T,
  msgs: readonly MiniGameInviteMsgLike[],
  messageId?: string,
): T {
  if (data.kind !== 'game_decline' && data.matchResult) return data
  if (data.kind === 'game_invite' && !canMiniGameInviteHaveMatchResult(data)) return data
  const derived =
    resolveMiniGameMatchResult(data.inviteId, msgs) ??
    resolveMiniGameMatchResultByProximity(data, msgs, messageId)
  return derived ? { ...data, matchResult: derived } : data
}

/** 用户（发起方）视角的胜负 */
export function playerSideMatchOutcome(
  matchResult?: WeChatMiniGameMatchResult,
): MiniGameSideOutcome | null {
  if (!matchResult) return null
  if (matchResult === 'player_win') return 'win'
  if (matchResult === 'char_win') return 'lose'
  return 'draw'
}

/** 角色（接受方）视角的胜负 */
export function charSideMatchOutcome(
  matchResult?: WeChatMiniGameMatchResult,
): MiniGameSideOutcome | null {
  if (!matchResult) return null
  if (matchResult === 'char_win') return 'win'
  if (matchResult === 'player_win') return 'lose'
  return 'draw'
}

export function matchOutcomeTitle(outcome: MiniGameSideOutcome, _peerName?: string): string {
  if (outcome === 'win') return '赢了'
  if (outcome === 'lose') return '输了'
  return '和棋'
}

export function settlementTitleForPlayer(
  result: WeChatMiniGameMatchResult,
  peerName?: string,
): string {
  if (result === 'player_win') return '你赢了'
  if (result === 'char_win') return peerName?.trim() ? `${peerName.trim()} 赢了` : '对方赢了'
  return '和棋'
}

export function settlementSubtitle(result: WeChatMiniGameMatchResult, peerName?: string): string {
  if (result === 'player_win') return '这局棋下得不错'
  if (result === 'char_win') return peerName?.trim() ? `${peerName.trim()} 险胜一筹` : '下次再来'
  return '旗鼓相当，不分胜负'
}

export function miniGameInviteSnapshotKey(m: {
  miniGameInvite?: {
    kind?: string
    inviteId?: string
    charResponded?: string
    matchResult?: string
  }
}): string {
  const mg = m.miniGameInvite
  if (!mg) return ''
  return [
    mg.kind ?? '',
    mg.inviteId ?? '',
    mg.charResponded ?? '',
    mg.matchResult ?? '',
  ].join('\0')
}
