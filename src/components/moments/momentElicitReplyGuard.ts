import type { MomentItemModel } from './mockMoments'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import {
  canElicitMomentReply,
  ELICIT_REPLY_ALREADY_PENDING_MESSAGE,
  getUnrepliedUserComments,
  hasPendingElicitReplyUnlocks,
} from './momentCommentUtils'
import type { MomentContactRef } from './newMomentTypes'

const inFlightMomentIds = new Set<string>()

export function isElicitReplyInFlight(momentId: string): boolean {
  const id = momentId.trim()
  return !!id && inFlightMomentIds.has(id)
}

/** 同步占位，防止连点或并行触发同一动态的唤起回应 */
export function tryAcquireElicitReplyLock(momentId: string): boolean {
  const id = momentId.trim()
  if (!id || inFlightMomentIds.has(id)) return false
  inFlightMomentIds.add(id)
  return true
}

export function releaseElicitReplyLock(momentId: string): void {
  const id = momentId.trim()
  if (!id) return
  inFlightMomentIds.delete(id)
}

export type ElicitReplyBlockReason = 'in_flight' | 'pending_unlocks' | 'nothing_to_elicit'

export function resolveElicitReplyBlockReason(params: {
  momentId?: string
  moment: Pick<MomentItemModel, 'comments' | 'interactions' | 'isUserAuthored' | 'authorCharacterId' | 'authorName'> | null | undefined
  userName: string
  now?: number
  contactDirectory: MomentsContactDirectory
  momentContacts: MomentContactRef[]
  replyingMomentId?: string | null
}): ElicitReplyBlockReason | null {
  const momentId = params.momentId?.trim() ?? ''
  const now = params.now ?? Date.now()

  if (momentId && (isElicitReplyInFlight(momentId) || params.replyingMomentId === momentId)) {
    return 'in_flight'
  }

  if (!params.moment) return 'nothing_to_elicit'

  if (hasPendingElicitReplyUnlocks(params.moment, params.userName, now)) {
    return 'pending_unlocks'
  }

  if (
    !canElicitMomentReply(
      params.moment as MomentItemModel,
      params.userName,
      params.contactDirectory,
      params.momentContacts,
    )
  ) {
    return 'nothing_to_elicit'
  }

  return null
}

export function notifyElicitReplyBlocked(reason: ElicitReplyBlockReason): void {
  if (reason === 'nothing_to_elicit') return
  window.alert(ELICIT_REPLY_ALREADY_PENDING_MESSAGE)
}

export function canShowElicitReplyAction(params: {
  momentId?: string
  moment: MomentItemModel | null | undefined
  userName: string
  now?: number
  contactDirectory: MomentsContactDirectory
  momentContacts: MomentContactRef[]
  replyingMomentId?: string | null
}): boolean {
  return resolveElicitReplyBlockReason(params) === null
}

/** 发帖后再次校验：若无未唤起评论但仍有延时解锁，视为重复触发 */
export function shouldAlertElicitDuplicateAfterPost(params: {
  moment: Pick<MomentItemModel, 'comments' | 'interactions'>
  userName: string
  comments: MomentItemModel['comments']
  interactions: MomentItemModel['interactions']
  now?: number
}): boolean {
  const pending = getUnrepliedUserComments(params.comments, params.userName)
  if (pending.length) return false
  return hasPendingElicitReplyUnlocks(
    { ...params.moment, comments: params.comments, interactions: params.interactions },
    params.userName,
    params.now ?? Date.now(),
  )
}
