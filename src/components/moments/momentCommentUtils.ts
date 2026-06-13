import type { ThreadReplyDraft } from './momentCommentThreadReplyAi'
import { resolveMomentCharacterIdByDisplayName } from './momentCommentThreadContext'
import type { ElicitReplyInteractionDraft } from './momentInteractionTypes'
import type { MomentComment, MomentItemModel } from './mockMoments'
import type { MomentsContactDirectory } from './momentsContactDirectory'
import type { MomentContactRef } from './newMomentTypes'

export const ELICIT_REPLY_ALREADY_PENDING_MESSAGE =
  '已触发回应，相关评论将稍后显示，请稍候。\n\n若希望评论立即出现，可在「朋友圈法则」中关闭「异步延时互动」。'

export function hasPendingElicitReplyUnlocks(
  moment: Pick<MomentItemModel, 'comments' | 'interactions'>,
  userName: string,
  now: number,
): boolean {
  const player = userName.trim()
  const elicitedCommentIds = new Set(
    (moment.comments ?? [])
      .filter((c) => !c.isAuthorReply && c.author.trim() === player && c.elicited)
      .map((c) => c.id),
  )
  if (!elicitedCommentIds.size) return false

  return (moment.interactions ?? []).some(
    (ix) =>
      ix.type === 'comment' &&
      ix.replyToCommentId &&
      elicitedCommentIds.has(ix.replyToCommentId) &&
      ix.visibleAt > now,
  )
}

export function getUnrepliedUserComments(
  comments: MomentComment[] | undefined,
  userName: string,
): MomentComment[] {
  const name = userName.trim()
  return (comments ?? []).filter(
    (c) => !c.isAuthorReply && c.author.trim() === name && !c.elicited,
  )
}

/** 当前动态是否允许「唤起回应」（角色动态或自己动态下回复 NPC 的楼中楼） */
export function canElicitMomentReply(
  moment: MomentItemModel | null | undefined,
  userName: string,
  contactDirectory: MomentsContactDirectory,
  momentContacts: MomentContactRef[],
): boolean {
  if (!moment) return false
  const unreplied = getUnrepliedUserComments(moment.comments, userName)
  if (!unreplied.length) return false

  if (!moment.isUserAuthored && moment.authorCharacterId?.trim()) {
    return true
  }

  if (!moment.isUserAuthored) return false

  const player = userName.trim()
  return unreplied.some((c) => {
    const target = c.replyTo?.trim()
    if (!target || target === player) return false
    return !!resolveMomentCharacterIdByDisplayName(
      target,
      moment,
      contactDirectory,
      momentContacts,
    )
  })
}

export function markCommentsElicited(
  comments: MomentComment[],
  ids: Set<string>,
): MomentComment[] {
  return comments.map((c) => (ids.has(c.id) ? { ...c, elicited: true } : c))
}

export function insertAuthorRepliesAfterPending(
  comments: MomentComment[],
  pending: MomentComment[],
  replies: string[],
  authorName: string,
  createId: () => string,
): { comments: MomentComment[]; newReplyIds: string[] } {
  const pendingIds = new Set(pending.map((c) => c.id))
  const replyByCommentId = new Map(
    pending.map((c, i) => [c.id, (replies[i] ?? replies[replies.length - 1] ?? '').trim()]),
  )

  const next: MomentComment[] = []
  const newReplyIds: string[] = []

  for (const c of comments) {
    next.push(pendingIds.has(c.id) ? { ...c, elicited: true } : c)
    if (!pendingIds.has(c.id)) continue

    const replyText = replyByCommentId.get(c.id) ?? ''
    if (!replyText) continue

    const replyId = createId()
    newReplyIds.push(replyId)
    next.push({
      id: replyId,
      author: authorName,
      content: replyText,
      isAuthorReply: true,
      replyToCommentId: c.id,
    })
  }

  return { comments: next, newReplyIds }
}

export function insertThreadRepliesAfterPending(
  comments: MomentComment[],
  userComment: MomentComment,
  drafts: ThreadReplyDraft[],
  resolveAuthorName: (charId: string) => string,
  resolveReplyToName: (commentId: string) => string,
  createId: () => string,
): { comments: MomentComment[]; newReplyIds: string[] } {
  const newReplyIds: string[] = []
  const next: MomentComment[] = []

  for (const c of comments) {
    if (c.id !== userComment.id) {
      next.push(c)
      continue
    }

    next.push({ ...c, elicited: true })

    for (const draft of drafts) {
      const replyId = createId()
      newReplyIds.push(replyId)
      next.push({
        id: replyId,
        author: resolveAuthorName(draft.authorCharId),
        authorCharacterId: draft.authorCharId,
        content: draft.content,
        isAuthorReply: true,
        replyToCommentId: draft.replyToCommentId,
        replyTo: resolveReplyToName(draft.replyToCommentId),
      })
    }
  }

  return { comments: next, newReplyIds }
}

export function buildPublisherElicitDrafts(
  userComment: MomentComment,
  replyTexts: string[],
  publisherCharId: string,
  delayOffset = 0,
): ElicitReplyInteractionDraft[] {
  const drafts: ElicitReplyInteractionDraft[] = []
  for (const [index, text] of replyTexts.entries()) {
    const content = text.trim()
    if (!content) continue
    drafts.push({
      authorCharId: publisherCharId,
      content,
      replyToCommentId: userComment.id,
      delaySeconds: 35 + (delayOffset + index) * 30,
      isAuthorReply: true,
    })
  }
  return drafts
}

export function buildThreadElicitDrafts(
  drafts: ThreadReplyDraft[],
  delayOffset = 0,
): ElicitReplyInteractionDraft[] {
  return drafts
    .filter((d) => d.content.trim())
    .map((d, index) => ({
      authorCharId: d.authorCharId,
      content: d.content.trim(),
      replyToCommentId: d.replyToCommentId,
      delaySeconds: 40 + (delayOffset + index) * 35,
      isAuthorReply: false,
    }))
}
