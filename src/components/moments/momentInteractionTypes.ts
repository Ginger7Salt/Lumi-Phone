/** 角色异步互动（仅存 charId，渲染时查通讯录） */
import { alignCharacterInteractionTiming, realignInteractionVisibleAt } from './momentInteractionTiming'
import type { PublisherSelfCommentDraft } from './momentCharacterPublishTypes'

export interface MomentInteraction {
  id: string
  charId: string
  type: 'like' | 'comment' | 'viewed'
  content?: string
  /** 解锁时间戳：发表时 Date.now() + delaySeconds * 1000 */
  visibleAt: number
  replyToCharId?: string
  /** 回复的目标评论互动 id */
  replyToInteractionId?: string
  /** 回复 stored 用户评论 id（唤起回应） */
  replyToCommentId?: string
  /** 发布者本人对评论的回复 */
  isAuthorReply?: boolean
  /** 发布者在自己动态下的评论区自评补充（非回复他人） */
  isPublisherSelfComment?: boolean
  /** 仅 viewed：停留秒数 */
  dwellSeconds?: number
}

export type AiMomentInteractionDraft = {
  charId: string
  type: 'like' | 'comment' | 'viewed'
  content?: string
  delaySeconds: number
  replyToCharId?: string
  dwellSeconds?: number
}

export function createInteractionId(): string {
  return `ix-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

export function materializeInteractions(
  drafts: AiMomentInteractionDraft[],
  publishedAt: number,
  immediate = false,
): MomentInteraction[] {
  const aligned = alignCharacterInteractionTiming(drafts)
  return aligned.map((d) => ({
    id: createInteractionId(),
    charId: d.charId,
    type: d.type,
    content: d.type === 'comment' ? d.content?.trim() : undefined,
    visibleAt: immediate
      ? publishedAt
      : publishedAt + Math.max(0, d.delaySeconds) * 1000,
    replyToCharId: d.replyToCharId,
    dwellSeconds: d.type === 'viewed' ? d.dwellSeconds : undefined,
  }))
}

export type ElicitReplyInteractionDraft = {
  authorCharId: string
  content: string
  replyToCommentId: string
  replyToCharId?: string
  delaySeconds?: number
  /** 发布者本人回复为 true；共同好友评区回复为 false */
  isAuthorReply?: boolean
}

/** 唤起回应：将 AI 回复写入 interactions，支持延时解锁 */
export function materializeElicitReplyInteractions(
  drafts: ElicitReplyInteractionDraft[],
  startedAt: number,
  immediate = false,
): MomentInteraction[] {
  return drafts
    .map((d) => ({
      ...d,
      content: d.content.trim(),
    }))
    .filter((d) => d.content)
    .map((d, index) => {
      const baseDelay = d.delaySeconds ?? 35 + index * 30
      const delay = immediate ? 0 : clampInteractionDelay(baseDelay)
      return {
        id: createInteractionId(),
        charId: d.authorCharId,
        type: 'comment' as const,
        content: d.content,
        visibleAt: immediate ? startedAt : startedAt + delay * 1000,
        replyToCommentId: d.replyToCommentId,
        ...(d.replyToCharId ? { replyToCharId: d.replyToCharId } : {}),
        isAuthorReply: d.isAuthorReply ?? true,
      }
    })
}

/** 用户新发评论后，将尚未解锁的互动顺延到其之后（保持底部时序） */
export function reanchorPendingInteractionsAfterUserComment(
  interactions: MomentInteraction[],
  userCommentCreatedAt: number,
): MomentInteraction[] {
  const now = Date.now()
  let pendingIndex = 0
  return interactions.map((ix) => {
    if (ix.visibleAt <= now) return ix
    pendingIndex += 1
    const minVisibleAt = userCommentCreatedAt + 1200 + pendingIndex * 900
    if (ix.visibleAt >= minVisibleAt) return ix
    return { ...ix, visibleAt: minVisibleAt }
  })
}

export function getUnlockedInteractions(
  interactions: MomentInteraction[] | undefined,
  now: number,
): MomentInteraction[] {
  return (interactions ?? []).filter((i) => i.visibleAt <= now)
}

function clampInteractionDelay(seconds: number): number {
  const n = Number.isFinite(seconds) ? Math.floor(seconds) : 60
  return Math.max(30, Math.min(300, n))
}

/** 瞬时生成：一次性物化点赞、评论与发布者回复（回复解锁 = 评论 visibleAt + reply.delaySeconds） */
export type InstantGenInteractionInput = {
  type: 'like' | 'comment'
  authorId: string
  delaySeconds: number
  id?: string
  content?: string
  replyTo?: string
  reply?: { content: string; delaySeconds: number }
}

export function materializeInstantGenInteractions(
  drafts: InstantGenInteractionInput[],
  publishedAt: number,
  authorCharId: string,
): MomentInteraction[] {
  const out: MomentInteraction[] = []
  const draftIdToInteraction = new Map<string, { id: string; charId: string }>()

  for (const d of drafts) {
    if (d.type === 'like') {
      out.push({
        id: createInteractionId(),
        charId: d.authorId,
        type: 'like',
        visibleAt: publishedAt + clampInteractionDelay(d.delaySeconds) * 1000,
      })
      continue
    }

    const commentId = d.id?.trim() || createInteractionId()
    const commentVisibleAt = publishedAt + clampInteractionDelay(d.delaySeconds) * 1000
    const replyToRef = d.replyTo?.trim()
    const parent = replyToRef ? draftIdToInteraction.get(replyToRef) : undefined
    const replyContent = d.reply?.content?.trim()
    const isPublisherSelfComment =
      d.authorId.trim() === authorCharId.trim() && !replyToRef && !replyContent

    out.push({
      id: commentId,
      charId: d.authorId,
      type: 'comment',
      content: d.content?.trim(),
      visibleAt: commentVisibleAt,
      ...(isPublisherSelfComment ? { isPublisherSelfComment: true } : {}),
      ...(parent
        ? {
            replyToInteractionId: parent.id,
            replyToCharId: parent.charId,
          }
        : {}),
    })
    if (d.id?.trim()) {
      draftIdToInteraction.set(d.id.trim(), { id: commentId, charId: d.authorId })
    }
    draftIdToInteraction.set(commentId, { id: commentId, charId: d.authorId })

    if (replyContent) {
      const replyDelay = clampInteractionDelay(d.reply?.delaySeconds ?? 90)
      out.push({
        id: createInteractionId(),
        charId: authorCharId,
        type: 'comment',
        content: replyContent,
        visibleAt: commentVisibleAt + replyDelay * 1000,
        replyToInteractionId: commentId,
        replyToCharId: d.authorId,
        isAuthorReply: true,
      })
    }
  }

  return realignInteractionVisibleAt(out, publishedAt)
}

/** 发布者在自己动态下的评论区自评补充 */
export function materializePublisherSelfComments(
  drafts: PublisherSelfCommentDraft[],
  publisherCharId: string,
  publishedAt: number,
  immediate = false,
): MomentInteraction[] {
  const publisherId = publisherCharId.trim()
  if (!publisherId) return []

  return drafts
    .map((d) => ({
      content: d.content.trim(),
      delaySeconds: d.delaySeconds ?? 45,
    }))
    .filter((d) => d.content)
    .map((d, index) => {
      const delay = immediate ? 0 : clampInteractionDelay(d.delaySeconds + index * 20)
      return {
        id: createInteractionId(),
        charId: publisherId,
        type: 'comment' as const,
        content: d.content,
        visibleAt: immediate ? publishedAt : publishedAt + delay * 1000,
        isPublisherSelfComment: true,
      }
    })
}
