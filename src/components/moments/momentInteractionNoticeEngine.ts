import type { MomentComment, MomentItemModel } from './mockMoments'
import type { MomentInteraction } from './momentInteractionTypes'

import { buildMomentPostThumbnail } from './momentPostThumbnail'
import type { InteractionNotice } from './interactionNoticeTypes'

export type NoticeDispatchInput = {
  moment: MomentItemModel
  interaction: MomentInteraction
  userDisplayName: string
  playerIdentityId?: string | null
  onlyDirectInteraction: boolean
  contactCharIds: Set<string>
  resolveDisplayName: (charId: string) => string
  now?: number
}

export function resolveInteractionReplyToName(
  interaction: MomentInteraction,
  moment: MomentItemModel,
  userDisplayName: string,
  playerIdentityId: string | null | undefined,
  resolveDisplayName: (charId: string) => string,
): string | undefined {
  if (interaction.type !== 'comment') return undefined

  const player = userDisplayName.trim()
  const pid = playerIdentityId?.trim()

  if (interaction.replyToCommentId?.trim()) {
    const targetId = interaction.replyToCommentId.trim()
    const target = moment.comments?.find((c) => c.id === targetId)
    if (target) {
      const author = target.author.trim()
      if (player && author === player) return '你'
      return author || undefined
    }
    const parentIx = moment.interactions?.find((ix) => ix.id === targetId && ix.type === 'comment')
    if (parentIx) {
      const author = resolveDisplayName(parentIx.charId)
      if (pid && parentIx.charId === pid) return '你'
      return author || undefined
    }
  }

  if (interaction.replyToInteractionId?.trim()) {
    const parent = moment.interactions?.find((ix) => ix.id === interaction.replyToInteractionId?.trim())
    if (parent?.type === 'comment') {
      return resolveDisplayName(parent.charId)
    }
  }

  if (interaction.replyToCharId?.trim()) {
    const targetId = interaction.replyToCharId.trim()
    if (pid && targetId === pid) return '你'
    return resolveDisplayName(targetId)
  }

  return undefined
}

export function userHasInteractedOnMoment(
  moment: MomentItemModel,
  userDisplayName: string,
): boolean {
  const player = userDisplayName.trim()
  if (!player) return false
  if (moment.likes?.some((name) => name.trim() === player)) return true
  if (moment.comments?.some((c) => c.author.trim() === player)) return true
  return false
}

function findUserCommentById(
  comments: MomentComment[] | undefined,
  commentId: string | undefined,
  userDisplayName: string,
): MomentComment | undefined {
  if (!commentId?.trim()) return undefined
  const player = userDisplayName.trim()
  return comments?.find((c) => c.id === commentId && c.author.trim() === player)
}

export function isDirectReplyToUser(
  interaction: MomentInteraction,
  moment: MomentItemModel,
  userDisplayName: string,
  playerIdentityId?: string | null,
): boolean {
  if (interaction.type !== 'comment') return false

  if (findUserCommentById(moment.comments, interaction.replyToCommentId, userDisplayName)) {
    return true
  }

  const pid = playerIdentityId?.trim()
  if (pid && interaction.replyToCharId?.trim() === pid) return true

  const player = userDisplayName.trim()
  if (player && interaction.replyToInteractionId) {
    const targetIx = moment.interactions?.find((ix) => ix.id === interaction.replyToInteractionId)
    if (targetIx?.type === 'comment') {
      const replyName = interaction.replyToCharId
      if (replyName && replyName === pid) return true
    }
  }

  return false
}

export function classifyInteractionNoticeType(
  interaction: MomentInteraction,
  moment: MomentItemModel,
  userDisplayName: string,
  playerIdentityId?: string | null,
): 'like' | 'comment' | 'reply' {
  if (interaction.type === 'like') return 'like'
  if (isDirectReplyToUser(interaction, moment, userDisplayName, playerIdentityId)) return 'reply'
  return 'comment'
}

/** Rule A / B / C 路由判定 — 返回是否写入消息列表，以及是否计入未读提醒 */
export function evaluateInteractionNoticeRoute(input: NoticeDispatchInput): {
  dispatch: boolean
  unread: boolean
} {
  const {
    moment,
    interaction,
    userDisplayName,
    playerIdentityId,
    onlyDirectInteraction,
    contactCharIds,
  } = input

  if (interaction.type === 'viewed') return { dispatch: false, unread: false }

  if (interaction.isPublisherSelfComment) return { dispatch: false, unread: false }

  const actorId = interaction.charId.trim()
  if (!actorId || !contactCharIds.has(actorId)) return { dispatch: false, unread: false }

  const noticeType = classifyInteractionNoticeType(
    interaction,
    moment,
    userDisplayName,
    playerIdentityId,
  )

  // Rule A：对用户发表的朋友圈点赞/评论
  if (moment.isUserAuthored && (noticeType === 'like' || noticeType === 'comment' || noticeType === 'reply')) {
    return { dispatch: true, unread: true }
  }

  // Rule B：直接回复用户评论
  if (noticeType === 'reply') return { dispatch: true, unread: true }

  // Rule C：共同好友机制 — 用户曾互动过的动态，其他好友的点赞/评论/评区回复均纳入
  if (userHasInteractedOnMoment(moment, userDisplayName)) {
    if (noticeType === 'like' || noticeType === 'comment' || noticeType === 'reply') {
      if (onlyDirectInteraction) return { dispatch: true, unread: false }
      return { dispatch: true, unread: true }
    }
  }

  return { dispatch: false, unread: false }
}

/** 互动尚不具备通知条件、但用户后续点赞/评论后可能生效时，不要提前标记已处理 */
export function shouldPermanentlySkipInteractionNotice(input: NoticeDispatchInput): boolean {
  const { moment, interaction, userDisplayName, playerIdentityId, contactCharIds } = input

  if (interaction.type === 'viewed') return true

  if (interaction.isPublisherSelfComment) return true

  const actorId = interaction.charId.trim()
  if (!actorId || !contactCharIds.has(actorId)) return true

  const route = evaluateInteractionNoticeRoute(input)
  if (route.dispatch) return false

  if (moment.isUserAuthored) return true

  const mayBecomeEligibleLater =
    !userHasInteractedOnMoment(moment, userDisplayName) &&
    !isDirectReplyToUser(interaction, moment, userDisplayName, playerIdentityId)

  return !mayBecomeEligibleLater
}

/** @deprecated 使用 evaluateInteractionNoticeRoute */
export function shouldDispatchInteractionNotice(input: NoticeDispatchInput): boolean {
  return evaluateInteractionNoticeRoute(input).dispatch
}

export function buildNoticeFromInteraction(input: NoticeDispatchInput): InteractionNotice | null {
  const route = evaluateInteractionNoticeRoute(input)
  if (!route.dispatch) return null

  const {
    moment,
    interaction,
    userDisplayName,
    playerIdentityId,
    resolveDisplayName,
    now = Date.now(),
  } = input
  const type = classifyInteractionNoticeType(
    interaction,
    moment,
    userDisplayName,
    playerIdentityId,
  )
  const replyToName = resolveInteractionReplyToName(
    interaction,
    moment,
    userDisplayName,
    playerIdentityId,
    resolveDisplayName,
  )

  return {
    id: `notice-${interaction.id}`,
    momentId: moment.id,
    actorId: interaction.charId,
    type,
    content: type === 'like' ? undefined : interaction.content?.trim(),
    timestamp: interaction.visibleAt || now,
    isRead: !route.unread,
    postThumbnail: buildMomentPostThumbnail(moment),
    replyToName,
    sourceInteractionId: interaction.id,
  }
}
