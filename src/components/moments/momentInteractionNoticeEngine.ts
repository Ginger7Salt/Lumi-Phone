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

/**
 * 用户在该条动态上「开始追更」的时刻：取其首次评论与首次点赞中较早者。
 * Rule C 仅通知 visibleAt 严格晚于此时刻的互动（点赞前已出现的评论不再提醒）。
 */
export function resolveUserMomentWatchCutoffMs(
  moment: MomentItemModel,
  userDisplayName: string,
  now: number,
): number | null {
  const player = userDisplayName.trim()
  if (!player) return null

  let cutoff: number | null = null

  for (const c of moment.comments ?? []) {
    if (c.author.trim() !== player) continue
    const t = c.createdAt
    if (typeof t === 'number' && Number.isFinite(t) && t > 0) {
      cutoff = cutoff == null ? t : Math.min(cutoff, t)
    }
  }

  const liked = moment.likes?.some((name) => name.trim() === player) ?? false
  if (liked) {
    const likeAt = moment.userEngagementAtMs
    if (typeof likeAt === 'number' && Number.isFinite(likeAt) && likeAt > 0) {
      cutoff = cutoff == null ? likeAt : Math.min(cutoff, likeAt)
    } else if (cutoff == null) {
      // 旧存档：已赞但未记录时刻，视为当前已解锁互动均发生在参与之前
      const unlocked = (moment.interactions ?? []).filter((ix) => ix.visibleAt <= now)
      const maxVisible = unlocked.length ? Math.max(...unlocked.map((ix) => ix.visibleAt)) : now
      cutoff = Math.max(now, maxVisible)
    }
  }

  return cutoff
}

/** 点赞/取消点赞时同步 likes 与 userEngagementAtMs */
export function buildUserMomentLikePatch(
  moment: MomentItemModel,
  displayNickname: string,
  liked: boolean,
): { likes: string[] | undefined; userEngagementAtMs?: number } {
  const player = displayNickname.trim()
  const likes = [...(moment.likes ?? [])]
  const idx = likes.indexOf(displayNickname)
  if (liked && idx < 0) likes.push(displayNickname)
  if (!liked && idx >= 0) likes.splice(idx, 1)
  const nextLikes = likes.length ? likes : undefined
  const hasComment = (moment.comments ?? []).some((c) => c.author.trim() === player)

  let userEngagementAtMs = moment.userEngagementAtMs
  if (liked && idx < 0) {
    userEngagementAtMs = userEngagementAtMs ?? Date.now()
  } else if (!liked && idx >= 0 && !hasComment) {
    userEngagementAtMs = undefined
  } else if (!liked && idx >= 0) {
    userEngagementAtMs = undefined
  }

  return { likes: nextLikes, userEngagementAtMs }
}

/** 共同好友追更：该互动是否发生在用户参与之前（不应再提醒） */
export function isInteractionBeforeUserMomentWatch(
  moment: MomentItemModel,
  interaction: MomentInteraction,
  userDisplayName: string,
  now: number,
): boolean {
  const cutoff = resolveUserMomentWatchCutoffMs(moment, userDisplayName, now)
  if (cutoff == null) return false
  return (interaction.visibleAt ?? 0) <= cutoff
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

  // Rule C：共同好友机制 — 用户参与后的追更互动才纳入（参与前已出现的点赞/评论不再提醒）
  if (userHasInteractedOnMoment(moment, userDisplayName)) {
    if (noticeType === 'like' || noticeType === 'comment' || noticeType === 'reply') {
      const watchNow = input.now ?? Date.now()
      if (isInteractionBeforeUserMomentWatch(moment, interaction, userDisplayName, watchNow)) {
        return { dispatch: false, unread: false }
      }
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

  if (
    userHasInteractedOnMoment(moment, userDisplayName) &&
    !isDirectReplyToUser(interaction, moment, userDisplayName, playerIdentityId)
  ) {
    const watchNow = input.now ?? Date.now()
    if (isInteractionBeforeUserMomentWatch(moment, interaction, userDisplayName, watchNow)) {
      return true
    }
  }

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
