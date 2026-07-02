import { getGameLabel } from './gameCatalog'
import type { GomokuSessionSetup } from './gomokuReactionBank'
import { gomokuSessionSetupToPayload } from './gomokuReactionBank'
import type { MiniGameType } from './types'
import type {
  WeChatMiniGameAcceptPayload,
  WeChatMiniGameDeclinePayload,
  WeChatMiniGameInvitePayload,
} from '../newFriendsPersona/types'

export type SendMiniGameInviteParams = {
  characterId: string
  playerIdentityId: string
  conversationKey: string
  gameType: MiniGameType
}

export type SendMiniGameInviteResult = {
  inviteId: string
  messageId: string
  invite: WeChatMiniGameInvitePayload
}

export function buildMiniGameInvitePayload(params: {
  gameType: MiniGameType
  inviteId?: string
}): WeChatMiniGameInvitePayload {
  const nowMs = Date.now()
  return {
    kind: 'game_invite',
    inviteId: params.inviteId ?? `mgi-${nowMs}-${Math.random().toString(36).slice(2, 8)}`,
    gameType: params.gameType,
    gameTitle: getGameLabel(params.gameType),
    reactionEnabled: true,
  }
}

/** 角色主动发出的游戏邀约卡 */
export function buildCharacterMiniGameInvitePayload(params: {
  gameType: MiniGameType
  inviteId?: string
  replyText?: string
  gomokuSession?: GomokuSessionSetup
}): WeChatMiniGameInvitePayload {
  const base = buildMiniGameInvitePayload({
    gameType: params.gameType,
    inviteId: params.inviteId,
  })
  const replyText = params.replyText?.trim().slice(0, 500)
  return {
    ...base,
    ...(replyText ? { replyText } : {}),
    ...(params.gomokuSession ? { gomokuSession: gomokuSessionSetupToPayload(params.gomokuSession) } : {}),
  }
}

export function buildMiniGameAcceptPayload(params: {
  invite: WeChatMiniGameInvitePayload
  replyText: string
  gomokuSession?: GomokuSessionSetup
}): WeChatMiniGameAcceptPayload {
  return {
    kind: 'game_accept',
    inviteId: params.invite.inviteId,
    replyText: params.replyText.trim() || '好啊，来！',
    gameType: params.invite.gameType,
    gameTitle: params.invite.gameTitle,
    reactionEnabled: true,
    ...(params.gomokuSession ? { gomokuSession: gomokuSessionSetupToPayload(params.gomokuSession) } : {}),
  }
}

/** 从接受卡还原进入对局所需的邀约载荷 */
export function invitePayloadFromAcceptPayload(
  data: WeChatMiniGameAcceptPayload,
): WeChatMiniGameInvitePayload {
  return {
    kind: 'game_invite',
    inviteId: data.inviteId,
    gameType: data.gameType,
    gameTitle: data.gameTitle,
    reactionEnabled: data.reactionEnabled ?? true,
    charResponded: 'accepted',
    userResponded: 'accepted',
    ...(data.gomokuSession ? { gomokuSession: data.gomokuSession } : {}),
    ...(data.matchResult ? { matchResult: data.matchResult } : {}),
  }
}

export function buildMiniGameDeclinePayload(params: {
  invite: WeChatMiniGameInvitePayload
  replyText: string
}): WeChatMiniGameDeclinePayload {
  return {
    kind: 'game_decline',
    inviteId: params.invite.inviteId,
    replyText: params.replyText.trim() || '现在没空，下次吧。',
    gameType: params.invite.gameType,
    gameTitle: params.invite.gameTitle,
  }
}

export function shouldSyncMiniGameInviteCharResponded(
  msg: { id: string; miniGameInvite?: { kind?: string; inviteId?: string } },
  userInviteMsgId: string,
  inviteId: string,
): boolean {
  const mg = msg.miniGameInvite
  if (mg?.kind !== 'game_invite') return false
  const targetMsgId = userInviteMsgId.trim()
  if (targetMsgId && msg.id === targetMsgId) return true
  const id = inviteId.trim()
  return !!id && mg.inviteId === id
}
